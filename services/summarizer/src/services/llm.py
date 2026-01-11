"""LLM service for video summarization."""

import asyncio
import json
import uuid
from pathlib import Path
from typing import Callable

import anthropic

from src.config import settings

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"


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

    async def detect_sections(self, transcript: str, segments: list[dict]) -> list[dict]:
        """Detect logical sections in transcript."""
        prompt = load_prompt("section_detect").format(
            transcript=transcript[:settings.MAX_TRANSCRIPT_CHARS]
        )

        text = await self._call_llm(prompt)
        result = _parse_json_response(text)

        if result.get("sections"):
            return result["sections"]

        # Fallback: single section
        return [{
            "title": "Full Video",
            "startSeconds": 0,
            "endSeconds": int(segments[-1]["start"] + segments[-1]["duration"]) if segments else 0
        }]

    async def summarize_section(self, section_text: str, title: str) -> dict:
        """Generate summary and bullets for a section."""
        prompt = load_prompt("section_summary").format(
            title=title,
            content=section_text[:settings.MAX_SECTION_CHARS]
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
