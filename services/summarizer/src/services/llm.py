"""LLM service for video summarization."""

import asyncio
import json
import logging
import queue
import uuid
from pathlib import Path
from typing import AsyncGenerator, Callable, Literal

import anthropic

from src.config import settings

logger = logging.getLogger(__name__)

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"

# Streaming event types
StreamEventType = Literal["token", "complete"]
StreamEvent = tuple[StreamEventType, str | dict | list]


def load_prompt(name: str) -> str:
    """Load prompt template from file."""
    path = PROMPTS_DIR / f"{name}.txt"
    return path.read_text()


def seconds_to_timestamp(seconds: int) -> str:
    """Convert seconds to MM:SS format."""
    mins = seconds // 60
    secs = seconds % 60
    return f"{mins:02d}:{secs:02d}"


def _parse_json_response(text: str, fallback: dict | None = None) -> dict:
    """Parse JSON from LLM response text."""
    try:
        start = text.find("{")
        end = text.rfind("}") + 1
        if start >= 0 and end > start:
            return json.loads(text[start:end])
    except json.JSONDecodeError:
        pass
    return fallback or {}


class LLMService:
    """Service for LLM-based video processing.

    Accepts an Anthropic client via dependency injection for testability.
    All API calls are made async using asyncio.to_thread().
    """

    def __init__(self, client: anthropic.Anthropic):
        self._client = client
        self._model = settings.ANTHROPIC_MODEL

    def _call_llm_sync(self, prompt: str, max_tokens: int = 2000) -> str:
        """Make a synchronous LLM call (internal)."""
        response = self._client.messages.create(
            model=self._model,
            max_tokens=max_tokens,
            messages=[{"role": "user", "content": prompt}]
        )
        return response.content[0].text

    async def _call_llm(self, prompt: str, max_tokens: int = 2000) -> str:
        """Make an async LLM call using thread pool.

        Raises:
            TimeoutError: If LLM call exceeds configured timeout
        """
        async with asyncio.timeout(settings.LLM_TIMEOUT_SECONDS):
            return await asyncio.to_thread(self._call_llm_sync, prompt, max_tokens)

    async def stream_llm(self, prompt: str, max_tokens: int = 2000):
        """Stream LLM response tokens.

        Args:
            prompt: The prompt to send to the LLM
            max_tokens: Maximum tokens in response

        Yields:
            String tokens as they are generated
        """
        import threading

        kwargs = {
            "model": self._model,
            "max_tokens": max_tokens,
            "messages": [{"role": "user", "content": prompt}],
        }

        q: queue.Queue[str | None] = queue.Queue()

        def producer():
            try:
                with self._client.messages.stream(**kwargs) as stream:
                    for text in stream.text_stream:
                        q.put(text)
            except anthropic.APIError as e:
                logger.error(f"Anthropic API error during streaming: {e}")
            finally:
                q.put(None)

        thread = threading.Thread(target=producer, daemon=True)
        thread.start()

        token_timeout = settings.LLM_TIMEOUT_SECONDS
        while True:
            try:
                item = await asyncio.to_thread(q.get, timeout=token_timeout)
                if item is None:
                    break
                yield item
            except (TimeoutError, asyncio.TimeoutError, queue.Empty):
                # Timeout waiting for next token - stream is done or stalled
                logger.warning(
                    f"Stream token timeout after {token_timeout}s - stream may be stalled"
                )
                break
            except asyncio.CancelledError:
                # Task was cancelled - clean exit
                break

    async def detect_sections(self, transcript: str, segments: list[dict], duration: int | None = None) -> list[dict]:
        """Detect logical sections in transcript."""
        # Calculate duration from segments if not provided
        if duration is None and segments:
            last = segments[-1]
            duration = int(last["start"] + last.get("duration", 0))

        duration_formatted = f"{duration // 60}:{duration % 60:02d}" if duration else "unknown"

        prompt = load_prompt("section_detect").format(
            transcript=transcript[:settings.MAX_TRANSCRIPT_CHARS],
            duration=duration or 0,
            duration_formatted=duration_formatted,
        )

        text = await self._call_llm(prompt)
        result = _parse_json_response(text)

        if result.get("sections"):
            return result["sections"]

        # Fallback: single section
        return [{
            "title": "Full Video",
            "startSeconds": 0,
            "endSeconds": duration or 0
        }]

    async def summarize_section(
        self,
        section_text: str,
        title: str,
        has_creator_title: bool = False,
    ) -> dict:
        """Generate summary and bullets for a section.

        Args:
            section_text: The transcript text for this section
            title: The section title (either creator's chapter title or AI-generated)
            has_creator_title: If True, also generates an explanatory subtitle
        """
        # Build dynamic prompt parts based on whether we need an explanation title
        if has_creator_title:
            extra_instruction = (
                "Also generate a short explanatory title that describes what the viewer "
                "will learn from this section (e.g., 'How to configure authentication' "
                "or 'Understanding the caching strategy')."
            )
            generated_title_field = ',\n  "generatedTitle": "short explanatory title for this section"'
        else:
            extra_instruction = ""
            generated_title_field = ""

        prompt = load_prompt("section_summary").format(
            title=title,
            content=section_text[:settings.MAX_SECTION_CHARS],
            extra_instruction=extra_instruction,
            generated_title_field=generated_title_field,
        )

        text = await self._call_llm(prompt, max_tokens=1000)
        return _parse_json_response(text, {"summary": text, "bullets": []})

    async def extract_concepts(self, transcript: str) -> list[dict]:
        """Extract key concepts from transcript."""
        prompt = load_prompt("concept_extract").format(
            transcript=transcript[:settings.MAX_TRANSCRIPT_CHARS]
        )

        text = await self._call_llm(prompt)
        result = _parse_json_response(text)
        return result.get("concepts", [])

    async def synthesize_summary(self, sections: list[dict], concepts: list[dict]) -> dict:
        """Generate TLDR and key takeaways."""
        sections_text = "\n".join([
            f"- {s['title']}: {s.get('summary', '')}" for s in sections
        ])
        concepts_text = ", ".join([c["name"] for c in concepts])

        prompt = load_prompt("global_synthesis").format(
            sections=sections_text,
            concepts=concepts_text
        )

        text = await self._call_llm(prompt, max_tokens=1000)
        return _parse_json_response(text, {"tldr": text[:500], "keyTakeaways": []})

    async def process_video(
        self,
        transcript: str,
        segments: list[dict],
        on_progress: Callable[[int, str], None] | None = None
    ) -> dict:
        """Full LLM processing pipeline.

        Args:
            transcript: Cleaned transcript text
            segments: List of transcript segments with timestamps
            on_progress: Optional callback for progress updates

        Returns:
            dict with tldr, key_takeaways, sections, and concepts
        """
        if on_progress:
            on_progress(10, "Detecting sections...")

        # 1. Detect sections
        raw_sections = await self.detect_sections(transcript, segments)

        if on_progress:
            on_progress(30, "Summarizing sections...")

        # 2. Summarize each section
        sections = []
        for i, raw in enumerate(raw_sections):
            start = raw.get("startSeconds", 0)
            end = raw.get("endSeconds", start + 300)

            section_segments = [
                s for s in segments
                if start <= s["start"] <= end
            ]
            section_text = " ".join([s["text"] for s in section_segments])

            summary_data = await self.summarize_section(section_text, raw["title"])

            sections.append({
                "id": str(uuid.uuid4()),
                "timestamp": seconds_to_timestamp(start),
                "start_seconds": start,
                "end_seconds": end,
                "title": raw["title"],
                "summary": summary_data.get("summary", ""),
                "bullets": summary_data.get("bullets", []),
            })

            if on_progress:
                progress = 30 + int((i + 1) / len(raw_sections) * 40)
                on_progress(progress, f"Summarizing section {i + 1}/{len(raw_sections)}...")

        if on_progress:
            on_progress(70, "Extracting concepts...")

        # 3. Extract concepts
        raw_concepts = await self.extract_concepts(transcript)
        concepts = [
            {
                "id": str(uuid.uuid4()),
                "name": c["name"],
                "definition": c.get("definition"),
                "timestamp": c.get("timestamp"),
            }
            for c in raw_concepts
        ]

        if on_progress:
            on_progress(90, "Generating summary...")

        # 4. Synthesize
        synthesis = await self.synthesize_summary(sections, concepts)

        return {
            "tldr": synthesis.get("tldr", ""),
            "key_takeaways": synthesis.get("keyTakeaways", []),
            "sections": sections,
            "concepts": concepts,
        }

    # ========== STREAMING METHODS ==========

    async def _stream_and_parse(
        self, prompt: str, max_tokens: int = 2000
    ) -> AsyncGenerator[StreamEvent, None]:
        """Stream LLM response and parse JSON at the end.

        Yields:
            ("token", str) for each token
            ("complete", dict) when done with parsed JSON
        """
        full_response = ""

        async for token in self.stream_llm(prompt, max_tokens):
            full_response += token
            yield ("token", token)

        # Parse the final response
        result = _parse_json_response(full_response)
        yield ("complete", result)

    async def stream_detect_sections(
        self, transcript: str, segments: list[dict], duration: int | None = None
    ) -> AsyncGenerator[StreamEvent, None]:
        """Stream section detection with tokens and final result.

        Args:
            transcript: Cleaned transcript text
            segments: List of transcript segments with timestamps
            duration: Video duration in seconds (used to constrain timestamps)

        Yields:
            ("token", str) for each token
            ("complete", list[dict]) with detected sections
        """
        # Calculate duration from segments if not provided
        if duration is None and segments:
            last = segments[-1]
            duration = int(last["start"] + last.get("duration", 0))

        duration_formatted = f"{duration // 60}:{duration % 60:02d}" if duration else "unknown"

        prompt = load_prompt("section_detect").format(
            transcript=transcript[:settings.MAX_TRANSCRIPT_CHARS],
            duration=duration or 0,
            duration_formatted=duration_formatted,
        )

        result = None
        async for event_type, data in self._stream_and_parse(prompt):
            if event_type == "token":
                yield (event_type, data)
            else:
                result = data

        # Process the result (type guard for dict access)
        if isinstance(result, dict) and result.get("sections"):
            sections = result["sections"]
        else:
            # Fallback: single section
            sections = [{
                "title": "Full Video",
                "startSeconds": 0,
                "endSeconds": duration or 0
            }]

        yield ("complete", sections)

    async def stream_summarize_section(
        self, section_text: str, title: str
    ) -> AsyncGenerator[StreamEvent, None]:
        """Stream section summary with tokens and final result.

        Yields:
            ("token", str) for each token
            ("complete", dict) with summary and bullets
        """
        prompt = load_prompt("section_summary").format(
            title=title,
            content=section_text[:settings.MAX_SECTION_CHARS]
        )

        async for event_type, data in self._stream_and_parse(prompt, max_tokens=1000):
            if event_type == "token":
                yield (event_type, data)
            else:
                # Ensure we have required fields (type guard for dict)
                if isinstance(data, dict):
                    summary_data = {
                        "summary": data.get("summary", ""),
                        "bullets": data.get("bullets", [])
                    }
                else:
                    summary_data = {"summary": "", "bullets": []}
                yield ("complete", summary_data)

    async def stream_extract_concepts(
        self, transcript: str
    ) -> AsyncGenerator[StreamEvent, None]:
        """Stream concept extraction with tokens and final result.

        Yields:
            ("token", str) for each token
            ("complete", list[dict]) with concepts
        """
        prompt = load_prompt("concept_extract").format(
            transcript=transcript[:settings.MAX_TRANSCRIPT_CHARS]
        )

        async for event_type, data in self._stream_and_parse(prompt):
            if event_type == "token":
                yield (event_type, data)
            else:
                # Type guard for dict access
                if isinstance(data, dict):
                    concepts = data.get("concepts", [])
                else:
                    concepts = []
                yield ("complete", concepts)

    async def stream_synthesize_summary(
        self, sections: list[dict], concepts: list[dict]
    ) -> AsyncGenerator[StreamEvent, None]:
        """Stream TLDR and key takeaways synthesis.

        Yields:
            ("token", str) for each token
            ("complete", dict) with tldr and keyTakeaways
        """
        sections_text = "\n".join([
            f"- {s['title']}: {s.get('summary', '')}" for s in sections
        ])
        concepts_text = ", ".join([c["name"] for c in concepts])

        prompt = load_prompt("global_synthesis").format(
            sections=sections_text,
            concepts=concepts_text
        )

        async for event_type, data in self._stream_and_parse(prompt, max_tokens=1000):
            if event_type == "token":
                yield (event_type, data)
            else:
                # Type guard for dict access
                if isinstance(data, dict):
                    result = {
                        "tldr": data.get("tldr", ""),
                        "keyTakeaways": data.get("keyTakeaways", [])
                    }
                else:
                    result = {"tldr": "", "keyTakeaways": []}
                yield ("complete", result)

    async def stream_quick_synthesis(
        self, transcript: str, duration: int
    ) -> AsyncGenerator[StreamEvent, None]:
        """Stream quick TLDR directly from transcript (no sections needed).

        This runs BEFORE section detection for faster UX.

        Yields:
            ("token", str) for each token
            ("complete", dict) with tldr and keyTakeaways
        """
        duration_formatted = f"{duration // 60}:{duration % 60:02d}"

        prompt = load_prompt("quick_synthesis").format(
            transcript=transcript[:settings.MAX_TRANSCRIPT_CHARS],
            duration_formatted=duration_formatted,
        )

        async for event_type, data in self._stream_and_parse(prompt, max_tokens=800):
            if event_type == "token":
                yield (event_type, data)
            else:
                # Type guard for dict access
                if isinstance(data, dict):
                    result = {
                        "tldr": data.get("tldr", ""),
                        "keyTakeaways": data.get("keyTakeaways", [])
                    }
                else:
                    result = {"tldr": "", "keyTakeaways": []}
                yield ("complete", result)

    async def generate_metadata_tldr(
        self,
        title: str,
        description: str,
        chapter_titles: list[str],
    ) -> dict:
        """Generate TLDR from metadata only (no transcript needed).

        This is a fast method (~2-3 sec) that generates a summary based on:
        - Video title
        - First 500 chars of description
        - Chapter titles (if available)

        Used in parallel processing to provide quick TLDR while sections
        are being processed.

        Args:
            title: Video title
            description: Video description (will be truncated)
            chapter_titles: List of chapter names

        Returns:
            dict with "tldr" and "keyTakeaways"
        """
        # Format chapters for prompt
        if chapter_titles:
            chapters_text = "\n".join([f"- {ch}" for ch in chapter_titles])
        else:
            chapters_text = "Not available"

        prompt = load_prompt("metadata_tldr").format(
            title=title,
            description=description[:500] if description else "Not available",
            chapters=chapters_text,
        )

        text = await self._call_llm(prompt, max_tokens=500)
        result = _parse_json_response(text, {"tldr": "", "keyTakeaways": []})

        return {
            "tldr": result.get("tldr", ""),
            "keyTakeaways": result.get("keyTakeaways", [])
        }
