"""LLM service for video summarization."""

import asyncio
import json
import logging
import queue
import uuid
from functools import lru_cache
from pathlib import Path
from typing import AsyncGenerator, Callable, Literal

import anthropic

from src.config import settings

logger = logging.getLogger(__name__)

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"
PERSONAS_DIR = PROMPTS_DIR / "personas"
EXAMPLES_DIR = PROMPTS_DIR / "examples"

# Valid persona names - whitelist to prevent path traversal attacks
VALID_PERSONAS: frozenset[str] = frozenset([
    'code', 'recipe', 'interview', 'review', 'standard'
])

# Streaming event types
StreamEventType = Literal["token", "complete"]
StreamEvent = tuple[StreamEventType, str | dict | list]


def load_prompt(name: str) -> str:
    """Load prompt template from file."""
    path = PROMPTS_DIR / f"{name}.txt"
    return path.read_text()


@lru_cache(maxsize=8)
def load_persona(name: str) -> str:
    """Load persona guidelines from file.

    Args:
        name: Persona name ('code', 'recipe', 'interview', 'review', 'standard')

    Returns:
        Persona guidelines text. Falls back to 'standard' if invalid or not found.

    Note:
        Results are cached to avoid repeated disk reads.
        Validates name against whitelist to prevent path traversal.
    """
    # Validate against whitelist to prevent path traversal
    if name not in VALID_PERSONAS:
        logger.warning(f"Invalid persona name '{name}', falling back to 'standard'")
        name = 'standard'

    path = PERSONAS_DIR / f"{name}.txt"
    if path.exists():
        return path.read_text()
    return (PERSONAS_DIR / "standard.txt").read_text()


@lru_cache(maxsize=8)
def load_examples(name: str) -> str:
    """Load persona-specific JSON examples from file.

    Args:
        name: Persona name ('code', 'recipe', 'interview', 'review', 'standard')

    Returns:
        JSON examples text. Falls back to 'standard' if invalid or not found.

    Note:
        Results are cached to avoid repeated disk reads.
        Validates name against whitelist to prevent path traversal.
    """
    # Validate against whitelist to prevent path traversal
    if name not in VALID_PERSONAS:
        logger.warning(f"Invalid persona name '{name}', falling back to 'standard'")
        name = 'standard'

    path = EXAMPLES_DIR / f"{name}.txt"
    if path.exists():
        return path.read_text()
    return (EXAMPLES_DIR / "standard.txt").read_text()


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


def _extract_summary_from_content(content: list) -> str:
    """Extract summary text from dynamic content blocks for backward compatibility.

    Priority: paragraphs > definitions > callouts > first bullet item.
    Ensures backward compatibility by always returning meaningful text when content exists.
    """
    paragraphs = []
    definitions = []
    callouts = []
    first_bullet = None

    for block in content:
        if isinstance(block, dict):
            block_type = block.get("type")
            if block_type == "paragraph":
                text = block.get("text", "")
                if text:
                    paragraphs.append(text)
            elif block_type == "definition":
                term = block.get("term", "")
                meaning = block.get("meaning", "")
                if term and meaning:
                    definitions.append(f"{term}: {meaning}")
            elif block_type == "callout":
                text = block.get("text", "")
                if text:
                    callouts.append(text)
            elif block_type in ("bullets", "numbered") and first_bullet is None:
                items = block.get("items", [])
                if items:
                    first_bullet = items[0]

    # Return in priority order
    if paragraphs:
        return " ".join(paragraphs)
    if definitions:
        return " ".join(definitions)
    if callouts:
        return " ".join(callouts)
    if first_bullet:
        return first_bullet
    return ""


def _extract_bullets_from_content(content: list) -> list[str]:
    """Extract bullet points from dynamic content blocks for backward compatibility.

    Collects items from bullets, numbered lists, do/dont blocks, etc.
    """
    bullets = []
    for block in content:
        if isinstance(block, dict):
            block_type = block.get("type")
            if block_type == "bullets":
                bullets.extend(block.get("items", []))
            elif block_type == "numbered":
                bullets.extend(block.get("items", []))
            elif block_type == "do_dont":
                for do_item in block.get("do", []):
                    bullets.append(f"Do: {do_item}")
                for dont_item in block.get("dont", []):
                    bullets.append(f"Don't: {dont_item}")
            elif block_type == "callout":
                style = block.get("style", "note").capitalize()
                text = block.get("text", "")
                if text:
                    bullets.append(f"{style}: {text}")
    return bullets


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
        persona: str = 'standard',
    ) -> dict:
        """Generate dynamic content blocks for a section.

        Args:
            section_text: The transcript text for this section
            title: The section title (either creator's chapter title or AI-generated)
            has_creator_title: If True, also generates an explanatory subtitle
            persona: Content persona for styling ('code', 'recipe', 'standard')

        Returns:
            dict with:
            - "content": array of content blocks
            - "summary": extracted text for backward compatibility
            - "bullets": extracted list items for backward compatibility
            - "generatedTitle": optional explanatory subtitle
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

        # Get persona-specific guidelines and examples from files
        persona_guidelines = load_persona(persona)
        variant_examples = load_examples(persona)

        prompt = load_prompt("section_summary").format(
            title=title,
            content=section_text[:settings.MAX_SECTION_CHARS],
            extra_instruction=extra_instruction,
            generated_title_field=generated_title_field,
            persona_guidelines=persona_guidelines,
            variant_examples=variant_examples,
        )

        text = await self._call_llm(prompt, max_tokens=1500)
        result = _parse_json_response(text, {"content": []})

        # Ensure content is always an array
        content = result.get("content", [])
        if not isinstance(content, list):
            content = []

        # Return with legacy fields for backward compatibility
        return {
            "content": content,
            "summary": _extract_summary_from_content(content),
            "bullets": _extract_bullets_from_content(content),
            "generatedTitle": result.get("generatedTitle"),
        }

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
                "content": summary_data.get("content", []),
                # Legacy fields for backward compatibility
                "summary": _extract_summary_from_content(summary_data.get("content", [])),
                "bullets": _extract_bullets_from_content(summary_data.get("content", [])),
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
        self, section_text: str, title: str, persona: str = 'standard'
    ) -> AsyncGenerator[StreamEvent, None]:
        """Stream section summary with tokens and final result.

        Args:
            section_text: The transcript text for this section
            title: The section title
            persona: Content persona for styling ('code', 'recipe', 'standard')

        Yields:
            ("token", str) for each token
            ("complete", dict) with content blocks and legacy summary/bullets
        """
        # Get persona-specific guidelines and examples from files
        persona_guidelines = load_persona(persona)
        variant_examples = load_examples(persona)

        prompt = load_prompt("section_summary").format(
            title=title,
            content=section_text[:settings.MAX_SECTION_CHARS],
            extra_instruction="",
            generated_title_field="",
            persona_guidelines=persona_guidelines,
            variant_examples=variant_examples,
        )

        async for event_type, data in self._stream_and_parse(prompt, max_tokens=1500):
            if event_type == "token":
                yield (event_type, data)
            else:
                # Ensure we have required fields (type guard for dict)
                if isinstance(data, dict):
                    content = data.get("content", [])
                    if not isinstance(content, list):
                        content = []
                    summary_data = {
                        "content": content,
                        # Legacy fields for backward compatibility
                        "summary": _extract_summary_from_content(content),
                        "bullets": _extract_bullets_from_content(content),
                    }
                else:
                    summary_data = {"content": [], "summary": "", "bullets": []}
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

    async def generate_master_summary(
        self,
        title: str,
        channel: str,
        duration: int,
        persona: str,
        tldr: str,
        key_takeaways: list[str],
        sections: list[dict],
        concepts: list[dict],
    ) -> str:
        """Generate comprehensive master summary from all video data.

        This is the final summarization step that synthesizes all processed
        data into a dense, AI-optimized knowledge document.

        Args:
            title: Video title
            channel: Channel name
            duration: Video duration in seconds
            persona: Content persona ('code', 'recipe', 'standard', etc.)
            tldr: Current TLDR text
            key_takeaways: List of key takeaways
            sections: List of processed sections with content blocks
            concepts: List of extracted concepts with definitions

        Returns:
            Markdown string containing the master summary (500-800 words)
        """
        # Format duration
        mins = duration // 60
        secs = duration % 60
        duration_formatted = f"{mins}:{secs:02d}"

        # Format key takeaways
        if key_takeaways:
            takeaways_text = "\n".join([f"• {t}" for t in key_takeaways])
        else:
            takeaways_text = "Not available"

        # Format sections - include title, summary, and key bullets
        sections_parts = []
        for i, section in enumerate(sections, 1):
            section_title = section.get("title", f"Section {i}")
            section_summary = section.get("summary", "")
            section_bullets = section.get("bullets", [])

            part = f"### {section_title}\n{section_summary}"
            if section_bullets:
                bullets_text = "\n".join([f"  - {b}" for b in section_bullets[:5]])
                part += f"\n{bullets_text}"
            sections_parts.append(part)

        sections_detailed = "\n\n".join(sections_parts) if sections_parts else "No sections available"

        # Format concepts
        if concepts:
            concepts_parts = []
            for c in concepts:
                name = c.get("name", "Unknown")
                definition = c.get("definition", "")
                if definition:
                    concepts_parts.append(f"• **{name}**: {definition}")
                else:
                    concepts_parts.append(f"• **{name}**")
            concepts_detailed = "\n".join(concepts_parts)
        else:
            concepts_detailed = "No key concepts extracted"

        prompt = load_prompt("master_summary").format(
            title=title,
            channel=channel or "Unknown",
            duration_formatted=duration_formatted,
            persona=persona,
            tldr=tldr or "Not available",
            key_takeaways=takeaways_text,
            sections_detailed=sections_detailed,
            concepts_detailed=concepts_detailed,
        )

        # Use higher max_tokens for comprehensive summary
        text = await self._call_llm(prompt, max_tokens=2000)

        # Return raw markdown - no JSON parsing needed
        return text.strip()
