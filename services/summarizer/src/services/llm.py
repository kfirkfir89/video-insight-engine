"""LLM service for video summarization.

Uses LiteLLM via LLMProvider for multi-provider support (Anthropic, OpenAI, Gemini).

Prompt-building helpers, Pydantic request models, and utility functions live in
``prompt_builders.py`` (prompt construction) and ``concept_processing.py``
(concept extraction/dedup). Both are re-exported here for backward compatibility.
"""

import asyncio
import logging
import uuid
from typing import Any, AsyncGenerator, Callable, Literal

from src.config import settings
from src.services.llm_provider import LLMProvider
from src.services.block_postprocessing import (
    enforce_block_diversity,
    resolve_view,
    log_block_metrics,
)
from src.utils.content_extractor import (
    extract_summary_from_content,
    extract_bullets_from_content,
)
from src.utils.json_parsing import parse_json_response as _parse_json_response

# Re-export everything that external modules import from ``src.services.llm``.
# This keeps the public API stable while the implementation lives in
# prompt_builders.py and concept_processing.py.
from src.services.prompt_builders import (  # noqa: F401 – re-exports
    # Constants
    PROMPTS_DIR,
    PERSONAS_DIR,
    EXAMPLES_DIR,
    VALID_PERSONAS,
    # Prompt loaders
    load_prompt,
    load_persona,
    load_examples,
    load_persona_system,
    # Timestamp / text utilities
    seconds_to_timestamp,
    sanitize_llm_input,
    validate_timestamp,
    # Chapter prompt builders
    build_chapter_time_range,
    build_fact_sheet,
    build_guest_attribution,
    build_diversity_instruction,
    build_subtitle_parts,
    build_chapter_prompt,
    # Title analysis
    title_needs_subtitle,
    # Block utilities
    inject_block_ids,
    # Pydantic models
    ChapterContext,
    AccuracyHints,
    ChapterSummaryRequest,
)
from src.services.concept_processing import (  # noqa: F401 – re-exports
    # Concept processing
    normalize_aliases,
    normalize_for_dedup,
    names_are_similar,
    merge_chapter_concepts,
    build_concept_extraction_section,
    build_concept_prompt_parts,
    build_concept_dicts,
    extract_concept_short_form,
    build_concepts_anchor,
)

# Backward-compatible aliases for underscore-prefixed names.
# Modules that imported the old private names from src.services.llm will
# continue to work unchanged.
_sanitize_llm_input = sanitize_llm_input
_validate_timestamp = validate_timestamp
_normalize_aliases = normalize_aliases
_normalize_for_dedup = normalize_for_dedup
_names_are_similar = names_are_similar
_build_concept_extraction_section = build_concept_extraction_section
_build_concept_prompt_parts = build_concept_prompt_parts
_extract_concept_short_form = extract_concept_short_form
_build_concepts_anchor = build_concepts_anchor
_build_chapter_time_range = build_chapter_time_range
_build_fact_sheet = build_fact_sheet
_build_guest_attribution = build_guest_attribution
_build_diversity_instruction = build_diversity_instruction
_build_subtitle_parts = build_subtitle_parts
_build_chapter_prompt = build_chapter_prompt

logger = logging.getLogger(__name__)

# Streaming event types
StreamEventType = Literal["token", "complete"]
StreamEvent = tuple[StreamEventType, str | dict | list]

# Appended to prompts on JSON-parse retry to nudge the LLM toward valid output
_JSON_RETRY_SUFFIX = "\n\nIMPORTANT: You MUST respond with valid JSON only. No markdown, no explanation."


def _build_time_based_chapters(duration: int) -> list[dict]:
    """Build time-based chapter segments (~5 min each) as a fallback.

    Used when the LLM fails to detect logical chapters from transcript.
    Produces generic "Part N" chapters so each segment gets focused
    content-block generation instead of one huge blob.
    """
    segment_duration = 300  # 5 minutes
    chapters: list[dict] = []
    for start in range(0, duration, segment_duration):
        end = min(start + segment_duration, duration)
        idx = len(chapters) + 1
        chapters.append({
            "title": f"Part {idx}",
            "startSeconds": start,
            "endSeconds": end,
        })
    return chapters


def _chapters_fallback(duration: int | None) -> list[dict]:
    """Return time-based chapters or single Full Video as last-resort fallback."""
    effective_duration = duration or 0
    if effective_duration > 0:
        return _build_time_based_chapters(effective_duration)
    return [{"title": "Full Video", "startSeconds": 0, "endSeconds": 0}]


def _extract_chapters_from_result(result: Any) -> list[dict] | None:
    """Extract chapters list from a parsed LLM result, or None if not valid."""
    if isinstance(result, dict) and result.get("chapters"):
        return result["chapters"]
    return None


def _log_chapter_detection_failure(attempt: int, result: Any, streaming: bool = False) -> None:
    """Log a chapter detection failure with context."""
    prefix = "Streaming chapter" if streaming else "Chapter"
    logger.warning(
        "%s detection attempt %d failed: result_type=%s, has_chapters_key=%s, raw_preview=%.300s",
        prefix, attempt,
        type(result).__name__,
        "chapters" in result if isinstance(result, dict) else "N/A",
        str(result)[:300],
    )


class LLMService:
    """Service for LLM-based video processing.

    Uses LLMProvider for multi-provider support (Anthropic, OpenAI, Gemini).
    All API calls are native async via LiteLLM's acompletion().
    """

    def __init__(self, provider: LLMProvider):
        """Initialize LLM service.

        Args:
            provider: LLMProvider instance for making LLM calls
        """
        self._provider = provider

    @property
    def provider(self) -> LLMProvider:
        """Get the underlying LLM provider.

        Use this for operations that need direct provider access,
        such as fast model calls for classification.
        """
        return self._provider

    @property
    def fast_model(self) -> str:
        """Get the configured fast model from the provider."""
        return self._provider.fast_model

    async def _call_llm(self, prompt: str, max_tokens: int = 2000) -> str:
        """Make an async LLM call.

        Args:
            prompt: The prompt to send
            max_tokens: Maximum tokens in response

        Returns:
            Generated text content

        Raises:
            TimeoutError: If LLM call exceeds configured timeout
        """
        async with asyncio.timeout(settings.LLM_TIMEOUT_SECONDS):
            return await self._provider.complete(prompt, max_tokens=max_tokens)

    async def stream_llm(
        self, prompt: str, max_tokens: int = 2000
    ) -> AsyncGenerator[str, None]:
        """Stream LLM response tokens.

        Args:
            prompt: The prompt to send to the LLM
            max_tokens: Maximum tokens in response

        Yields:
            String tokens as they are generated
        """
        try:
            async for token in self._provider.stream(prompt, max_tokens=max_tokens):
                yield token
        except asyncio.CancelledError:
            # Task was cancelled - clean exit
            pass
        except Exception as e:
            logger.error("Error during streaming: %s", e)
            raise

    async def detect_chapters(self, transcript: str, segments: list[dict], duration: int | None = None) -> list[dict]:
        """Detect logical chapters in transcript."""
        logger.debug("detect_chapters: transcript length=%d chars", len(transcript))

        # Calculate duration from segments if not provided
        if duration is None and segments:
            last = segments[-1]
            duration = int(last["start"] + last.get("duration", 0))

        duration_formatted = f"{duration // 60}:{duration % 60:02d}" if duration else "unknown"

        prompt = load_prompt("chapter_detect").format(
            transcript=transcript,
            duration=duration or 0,
            duration_formatted=duration_formatted,
        )

        # First attempt
        text = await self._call_llm(prompt)
        result = _parse_json_response(text)
        chapters = _extract_chapters_from_result(result)
        if chapters:
            return chapters

        # Retry once with explicit JSON instruction
        _log_chapter_detection_failure(1, result)
        text = await self._call_llm(
            prompt + _JSON_RETRY_SUFFIX,
        )
        result = _parse_json_response(text)
        chapters = _extract_chapters_from_result(result)
        if chapters:
            logger.info("Chapter detection succeeded on retry")
            return chapters

        # Fallback: time-based segments
        _log_chapter_detection_failure(2, result)
        return _chapters_fallback(duration)

    async def summarize_chapter(self, req: ChapterSummaryRequest) -> dict:
        """Generate dynamic content blocks for a chapter.

        Args:
            req: ChapterSummaryRequest with all chapter parameters.

        Returns:
            dict with:
            - "content": array of content blocks with blockId
            - "view": per-chapter view string (e.g., "cooking", "coding")
            - "generatedTitle": optional explanatory subtitle
            - "concepts": list of raw concept dicts (only when extract_concepts=True)
        """
        logger.debug("summarize_chapter: chapter_text length=%d chars, title='%s'", len(req.chapter_text), req.context.title)
        prompt, max_tokens = _build_chapter_prompt(req)

        # Retry once if LLM returns empty content for non-empty input
        max_attempts = 2 if req.chapter_text.strip() else 1
        content: list[dict] = []
        result: dict = {"content": []}

        for attempt in range(max_attempts):
            text = await self._call_llm(prompt, max_tokens=max_tokens)
            result = _parse_json_response(text, {"content": []})

            # Ensure content is always an array
            content = result.get("content", [])
            if not isinstance(content, list):
                content = []

            if content or attempt == max_attempts - 1:
                break

            logger.warning(
                "Empty content from LLM for chapter '%s' (%d chars input), retrying... "
                "Raw response preview: %.300s",
                req.context.title, len(req.chapter_text), text,
            )

        if not content and req.chapter_text.strip():
            logger.error(
                "LLM returned empty content for chapter '%s' after %d attempts (%d chars input)",
                req.context.title, max_attempts, len(req.chapter_text),
            )

        # Post-generation diversity enforcement (safety net)
        content = enforce_block_diversity(content, req.context.title, req.accuracy.prev_chapter_block_types)

        # Inject blockId into each content block
        content = inject_block_ids(content)

        # Resolve per-chapter view (LLM signal + block inference + persona fallback)
        view = resolve_view(content, result.get("view", ""), req.context.title, persona_hint=req.context.persona_hint)

        # Log block metrics for analysis
        log_block_metrics(content, req.context.title, req.context.persona, view=view)

        response: dict = {
            "content": content,
            "view": view,
            "generatedTitle": result.get("generatedTitle"),
        }

        # Include extracted concepts when requested
        if req.extract_concepts:
            raw_concepts = result.get("concepts", [])
            if not isinstance(raw_concepts, list):
                raw_concepts = []
            response["concepts"] = raw_concepts

        return response

    async def extract_concepts(self, transcript: str) -> list[dict]:
        """Extract key concepts from transcript."""
        logger.debug("extract_concepts: transcript length=%d chars", len(transcript))

        prompt = load_prompt("concept_extract").format(
            transcript=transcript
        )

        text = await self._call_llm(prompt)
        result = _parse_json_response(text)
        return result.get("concepts", [])

    async def synthesize_summary(self, sections: list[dict], concepts: list[dict]) -> dict:
        """Generate TLDR and key takeaways."""
        sections_text = "\n".join([
            f"- {s['title']}: {extract_summary_from_content(s.get('content', []))}" for s in sections
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
            dict with tldr, key_takeaways, chapters, and concepts
        """
        if on_progress:
            on_progress(10, "Detecting chapters...")

        # 1. Detect chapters
        raw_chapters = await self.detect_chapters(transcript, segments)

        if on_progress:
            on_progress(20, "Extracting concepts...")

        # 2. Extract concepts early so names can be passed to chapter summaries
        raw_concepts = await self.extract_concepts(transcript)
        concepts = build_concept_dicts(raw_concepts)
        concept_names = [c["name"] for c in concepts]

        if on_progress:
            on_progress(30, "Summarizing chapters...")

        # 3. Summarize each chapter (with concept names for anchoring)
        chapters = []
        for i, raw in enumerate(raw_chapters):
            start = raw.get("startSeconds", 0)
            end = raw.get("endSeconds", 0) or (start + 300)

            chapter_segments = [
                s for s in segments
                if start <= s["start"] < end
            ]
            chapter_text = " ".join([s["text"] for s in chapter_segments])

            summary_data = await self.summarize_chapter(ChapterSummaryRequest(
                chapter_text=chapter_text,
                context=ChapterContext(title=raw["title"]),
                concept_names=concept_names,
            ))

            if not summary_data.get("content"):
                logger.warning(
                    "Dropping chapter %d '%s' — empty content after LLM processing",
                    i, raw["title"],
                )
                continue
            content = summary_data["content"]

            chapter_dict: dict = {
                "id": str(uuid.uuid4()),
                "timestamp": seconds_to_timestamp(start),
                "start_seconds": start,
                "end_seconds": end,
                "title": raw["title"],
                "content": content,
            }
            if summary_data.get("view"):
                chapter_dict["view"] = summary_data["view"]
            chapters.append(chapter_dict)

            if on_progress:
                progress = 30 + int((i + 1) / len(raw_chapters) * 40)
                on_progress(progress, f"Summarizing chapter {i + 1}/{len(raw_chapters)}...")

        if on_progress:
            on_progress(90, "Generating summary...")

        # 4. Synthesize
        synthesis = await self.synthesize_summary(chapters, concepts)

        return {
            "tldr": synthesis.get("tldr", ""),
            "key_takeaways": synthesis.get("keyTakeaways", []),
            "chapters": chapters,
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

        if not full_response.strip():
            logger.warning(
                "Empty response after streaming LLM (0 content tokens). "
                "Possible causes: rate limit, content filter, or truncation. "
                "Prompt preview: %.200s",
                prompt[:200],
            )

        # Parse the final response
        result = _parse_json_response(full_response)
        yield ("complete", result)

    async def stream_detect_chapters(
        self, transcript: str, segments: list[dict], duration: int | None = None
    ) -> AsyncGenerator[StreamEvent, None]:
        """Stream chapter detection with tokens and final result.

        Args:
            transcript: Cleaned transcript text
            segments: List of transcript segments with timestamps
            duration: Video duration in seconds (used to constrain timestamps)

        Yields:
            ("token", str) for each token
            ("complete", list[dict]) with detected chapters
        """
        logger.debug("stream_detect_chapters: transcript length=%d chars", len(transcript))

        # Calculate duration from segments if not provided
        if duration is None and segments:
            last = segments[-1]
            duration = int(last["start"] + last.get("duration", 0))

        duration_formatted = f"{duration // 60}:{duration % 60:02d}" if duration else "unknown"

        prompt = load_prompt("chapter_detect").format(
            transcript=transcript,
            duration=duration or 0,
            duration_formatted=duration_formatted,
        )

        result = None
        async for event_type, data in self._stream_and_parse(prompt):
            if event_type == "token":
                yield (event_type, data)
            else:
                result = data

        # Process the result
        chapters = _extract_chapters_from_result(result)
        if chapters:
            yield ("complete", chapters)
            return

        # Retry once with non-streaming call and explicit JSON instruction
        _log_chapter_detection_failure(1, result, streaming=True)
        text = await self._call_llm(
            prompt + _JSON_RETRY_SUFFIX,
        )
        result = _parse_json_response(text)
        chapters = _extract_chapters_from_result(result)
        if chapters:
            logger.info("Streaming chapter detection succeeded on non-streaming retry")
            yield ("complete", chapters)
            return

        # Fallback: time-based segments
        _log_chapter_detection_failure(2, result, streaming=True)
        yield ("complete", _chapters_fallback(duration))

    async def stream_summarize_chapter(
        self,
        req: ChapterSummaryRequest,
    ) -> AsyncGenerator[StreamEvent, None]:
        """Stream chapter summary with tokens and final result.

        Args:
            req: ChapterSummaryRequest with all chapter parameters.

        Yields:
            ("token", str) for each token
            ("complete", dict) with content blocks (with blockId), view, and optional concepts
        """
        logger.debug("stream_summarize_chapter: chapter_text length=%d chars, title='%s'", len(req.chapter_text), req.context.title)
        prompt, max_tokens = _build_chapter_prompt(req)

        async for event_type, data in self._stream_and_parse(prompt, max_tokens=max_tokens):
            if event_type == "token":
                yield (event_type, data)
            else:
                # Ensure we have required fields (type guard for dict)
                if isinstance(data, dict):
                    content = data.get("content", [])
                    if not isinstance(content, list):
                        content = []

                    # Post-generation diversity enforcement (safety net)
                    content = enforce_block_diversity(content, req.context.title, req.accuracy.prev_chapter_block_types)

                    # Inject blockId into each content block
                    content = inject_block_ids(content)

                    # Resolve per-chapter view (LLM signal + block inference + persona fallback)
                    view = resolve_view(content, data.get("view", ""), req.context.title, persona_hint=req.context.persona_hint)

                    log_block_metrics(content, req.context.title, req.context.persona, view=view)
                    summary_data: dict[str, Any] = {
                        "content": content,
                        "view": view,
                    }

                    # Include extracted concepts when requested
                    if req.extract_concepts:
                        raw_concepts = data.get("concepts", [])
                        if not isinstance(raw_concepts, list):
                            raw_concepts = []
                        summary_data["concepts"] = raw_concepts
                else:
                    summary_data = {"content": [], "view": "standard"}
                yield ("complete", summary_data)

    async def stream_extract_concepts(
        self, transcript: str
    ) -> AsyncGenerator[StreamEvent, None]:
        """Stream concept extraction with tokens and final result.

        Yields:
            ("token", str) for each token
            ("complete", list[dict]) with concepts
        """
        logger.debug("stream_extract_concepts: transcript length=%d chars", len(transcript))

        prompt = load_prompt("concept_extract").format(
            transcript=transcript
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
        logger.debug("stream_quick_synthesis: transcript length=%d chars", len(transcript))

        duration_formatted = f"{duration // 60}:{duration % 60:02d}"

        prompt = load_prompt("quick_synthesis").format(
            transcript=transcript,
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

        # max_tokens=1000 (up from 500) to accommodate keyTakeaways alongside TLDR
        text = await self._call_llm(prompt, max_tokens=1000)
        result = _parse_json_response(text, {"tldr": "", "keyTakeaways": []})

        # Retry once if TL;DR is empty (LLM may return non-JSON or empty response)
        if not result.get("tldr"):
            logger.warning(
                "Empty TLDR from LLM, retrying... Raw response preview: %.300s", text,
            )
            text = await self._call_llm(
                prompt + _JSON_RETRY_SUFFIX,
                max_tokens=1000,
            )
            result = _parse_json_response(text, {"tldr": "", "keyTakeaways": []})
            if not result.get("tldr"):
                logger.error("TLDR still empty after retry. Raw response preview: %.300s", text)

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
        chapters: list[dict],
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
            chapters: List of processed chapters with content blocks
            concepts: List of extracted concepts with definitions

        Returns:
            Markdown string containing the master summary (500-800 words)
        """
        # Sanitize inputs to prevent prompt injection and resource exhaustion
        title = _sanitize_llm_input(title, max_length=500)
        channel = _sanitize_llm_input(channel, max_length=200)
        tldr = _sanitize_llm_input(tldr, max_length=2000)

        # Validate persona against whitelist (already validated in load_persona but double-check)
        if persona not in VALID_PERSONAS:
            persona = "standard"

        # Format duration
        mins = duration // 60
        secs = duration % 60
        duration_formatted = f"{mins}:{secs:02d}"

        # Format key takeaways (sanitize each)
        if key_takeaways:
            sanitized_takeaways = [_sanitize_llm_input(t, max_length=500) for t in key_takeaways[:20]]
            takeaways_text = "\n".join([f"\u2022 {t}" for t in sanitized_takeaways])
        else:
            takeaways_text = "Not available"

        # Format chapters - include title, summary, and key bullets (limit to 30 chapters max)
        chapters_parts = []
        for i, chapter in enumerate(chapters[:30], 1):
            chapter_title = _sanitize_llm_input(chapter.get("title", f"Chapter {i}"), max_length=200)
            # Extract summary and bullets from content blocks on-demand
            chapter_content = chapter.get("content", [])
            chapter_summary = _sanitize_llm_input(extract_summary_from_content(chapter_content), max_length=1000)
            chapter_bullets = extract_bullets_from_content(chapter_content)

            part = f"### {chapter_title}\n{chapter_summary}"
            if chapter_bullets:
                sanitized_bullets = [_sanitize_llm_input(b, max_length=300) for b in chapter_bullets[:5]]
                bullets_text = "\n".join([f"  - {b}" for b in sanitized_bullets])
                part += f"\n{bullets_text}"
            chapters_parts.append(part)

        chapters_detailed = "\n\n".join(chapters_parts) if chapters_parts else "No chapters available"

        # Format concepts (limit to 20 concepts max)
        if concepts:
            concepts_parts = []
            for c in concepts[:20]:
                name = _sanitize_llm_input(c.get("name", "Unknown"), max_length=100)
                definition = _sanitize_llm_input(c.get("definition", ""), max_length=500)
                if definition:
                    concepts_parts.append(f"\u2022 **{name}**: {definition}")
                else:
                    concepts_parts.append(f"\u2022 **{name}**")
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
            chapters_detailed=chapters_detailed,
            concepts_detailed=concepts_detailed,
        )

        # Use higher max_tokens for comprehensive summary
        text = await self._call_llm(prompt, max_tokens=2000)

        # Validate output length (expected 500-800 words ~ 3000-5000 chars, cap at 15000)
        result = text.strip()
        max_output_length = 15000
        if len(result) > max_output_length:
            logger.warning("Master summary truncated from %d to %d chars", len(result), max_output_length)
            result = result[:max_output_length]

        return result
