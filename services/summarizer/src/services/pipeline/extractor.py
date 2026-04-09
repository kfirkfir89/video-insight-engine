"""Adaptive structured extraction — 1-N LLM calls based on transcript length and duration."""
from __future__ import annotations

import asyncio
import logging
from functools import lru_cache
from pathlib import Path
from typing import TYPE_CHECKING, Any, AsyncGenerator

from ...config import settings
from ...models.domain_types import validate_domain_output
from ...utils.json_parsing import parse_json_response, strip_markdown_fences
from ...utils.llm_retry import call_llm_with_retry
from .extraction_merger import merge_batch_extractions
from .prompt_builder import build_extraction_template, build_tab_goals, get_detail_level, get_content_emphasis
from .triage import TriageResult

if TYPE_CHECKING:
    from ...services.llm import LLMService
    from ...services.transcription.transcript_chunker import ChapterChunk

logger = logging.getLogger(__name__)
PROMPTS_DIR = Path(__file__).parent.parent.parent / "prompts"

# Word-count thresholds for adaptive strategy (~1.33 tokens per word for English)
SINGLE_THRESHOLD = 5333       # ~7K tokens → single call
OVERFLOW_THRESHOLD = 20000    # ~27K tokens → overflow extraction


def _dynamic_timeout(word_count: int) -> float:
    """Calculate dynamic timeout based on word count.

    Base 300s + word_count/100, capped at 600s. Longer transcripts need
    proportionally more time for the LLM to generate structured output.
    A 6K-word video gets ~360s, a 20K-word video gets ~500s.
    """
    return min(300.0 + word_count / 100.0, 600.0)


def _force_split_by_sentences(
    transcript: str,
    duration_seconds: float,
) -> list[ChapterChunk]:
    """Force-split transcript at sentence boundaries when chapter splitting fails.

    Delegates to transcript_chunker.force_split_by_sentences.
    """
    from ...services.transcription.transcript_chunker import force_split_by_sentences
    return force_split_by_sentences(transcript, duration_seconds)


def _estimate_tokens(text: str) -> int:
    """Estimate token count from text. ~1.33 tokens per word for English."""
    return int(len(text.split()) * 1.33)


@lru_cache(maxsize=16)
def _load_prompt(path_str: str) -> str:
    """Load and cache a prompt template from disk.

    Callers must pass resolved (absolute) paths so the cache key
    is stable regardless of working directory.
    """
    return Path(path_str).read_text()


def _resolve_strategy(
    use_chunked: bool,
    chapters: list[ChapterChunk] | None,
    word_count: int,
    transcript: str,
    duration_seconds: float,
) -> tuple[str, list[ChapterChunk] | None]:
    """Resolve extraction strategy and return (strategy_name, chunks_if_applicable).

    Returns one of: ("chunked", chunks), ("single", None), ("overflow", None).
    """
    if use_chunked:
        if chapters is None:
            raise ValueError("chapters required for chunked extraction")
        batches = batch_chapters(chapters)
        if len(batches) > 1:
            return "chunked", chapters
        # Single batch: fall through to overflow
        logger.info("Chunked extraction has only 1 batch — falling back to overflow extraction")
        return "overflow", None

    if word_count > OVERFLOW_THRESHOLD:
        force_chunks = _force_split_by_sentences(transcript, duration_seconds)
        if len(force_chunks) >= 2:
            logger.info("Force-splitting %d-word transcript into %d chunks (chapter splitting unavailable)",
                        word_count, len(force_chunks))
            return "chunked", force_chunks
        return "overflow", None

    if word_count < SINGLE_THRESHOLD:
        return "single", None

    return "overflow", None


async def extract(
    llm_service: LLMService,
    triage_result: TriageResult,
    transcript: str,
    video_data: dict,
    chapters: list[ChapterChunk] | None = None,
    video_context: str = "",
    extra_instruction: str = "",
) -> AsyncGenerator[dict, None]:
    """Adaptive extraction yielding progress events and final result.

    Strategy selection:
    - chapters provided AND duration > 30 min: chunked extraction (batched by chapters)
    - <5.3K words (~4K tokens): single extraction call
    - 5.3-20K words (~4-15K tokens): single call + overflow retry if validation fails
    - 20K+ words: overflow extraction
    """
    word_count = len(transcript.split())
    duration_seconds = video_data.get("duration", 0)
    duration_minutes = duration_seconds / 60
    logger.info("Extraction: tags=%s, words=%d, duration=%.0fmin, chapters=%s",
                triage_result.content_tags, word_count, duration_minutes,
                len(chapters) if chapters else "none")

    # Load quality rules (merged from accuracy_rules + voice rules)
    rules_path = PROMPTS_DIR / "quality_rules.txt"
    quality_rules = _load_prompt(str(rules_path.resolve())) if rules_path.exists() else ""

    title = video_data.get("title", "")
    duration_min = round(duration_seconds / 60)

    tab_goals_text = build_tab_goals(triage_result.tabs)
    detail_level = get_detail_level(duration_seconds)
    primary_tag = triage_result.primary_tag
    content_emphasis = get_content_emphasis(primary_tag)

    prompt_template = build_extraction_template(
        triage_result.content_tags,
        triage_result.modifiers,
        quality_rules,
        title,
        duration_min,
        user_goal=triage_result.user_goal,
        tab_goals=tab_goals_text,
        detail_level=detail_level,
        content_emphasis=content_emphasis,
        video_context=video_context,
    )

    if extra_instruction:
        # SECURITY: extra_instruction must only contain server-generated content
        # (from build_synthesis_fed_retry_prompt). Never pass user input here.
        prompt_template += f"\n<retry_guidance>\n{extra_instruction}\n</retry_guidance>"

    # Strategy selection: chunked for long videos with chapters
    use_chunked = (
        chapters is not None
        and len(chapters) >= 2
        and duration_seconds > settings.CHUNKED_EXTRACTION_THRESHOLD
    )

    strategy, resolved_chunks = _resolve_strategy(
        use_chunked, chapters, word_count, transcript, duration_seconds,
    )

    if strategy == "chunked":
        if resolved_chunks is None:
            raise ValueError("resolved_chunks required for chunked strategy")
        async for event in _chunked_extraction(
            llm_service, triage_result, prompt_template, resolved_chunks,
        ):
            yield event
    elif strategy == "single":
        async for event in _single_extraction(
            llm_service, triage_result, prompt_template, transcript,
        ):
            yield event
    else:  # "overflow"
        overflow_text = "\n".join(ch.text for ch in chapters) if use_chunked and chapters else transcript
        async for event in _overflow_extraction(
            llm_service, triage_result, prompt_template, overflow_text, word_count=word_count,
        ):
            yield event


def _format_prompt(template: str, transcript: str) -> str:
    """Format an extraction prompt with transcript.

    All other placeholders (title, quality_rules, duration_minutes,
    domain_schemas, user_goal, tab_goals) are already injected by
    build_extraction_template(). Only {transcript} remains.
    """
    return template.replace("{transcript}", transcript)


def _split_prompt_for_caching(template: str, transcript: str) -> tuple[str, str]:
    """Split extraction prompt into static (cacheable) and dynamic parts.

    The template contains {transcript} as the only remaining placeholder.
    Everything before <transcript> is static (schemas, rules, instructions);
    the transcript itself is dynamic. For prompt caching, the static part
    is sent with cache_control and the dynamic part as the user message.

    Returns:
        (cache_static, dynamic_prompt) tuple. If splitting fails, returns
        ("", full_prompt) so caching is skipped gracefully.
    """
    marker = "<transcript>"
    idx = template.find(marker)
    if idx == -1:
        # Can't split — prompt caching disabled for this call
        logger.debug("Prompt caching skipped: <transcript> marker not found in template (len=%d)", len(template))
        return "", template.replace("{transcript}", transcript)

    static = template[:idx + len(marker)]
    dynamic_suffix = template[idx + len(marker):]
    # The suffix contains \n{transcript}\n</transcript>... — replace the placeholder
    # with the actual transcript. Don't prepend transcript separately to avoid duplication.
    return static, dynamic_suffix.replace("{transcript}", transcript)


def _parse_llm_json(raw: str) -> dict:
    """Parse JSON from LLM response, stripping markdown fences first."""
    cleaned = strip_markdown_fences(raw)
    data = parse_json_response(cleaned)
    if not data:
        logger.error("Failed to parse JSON from LLM response (len=%d): %.500s", len(raw), repr(raw[:500]))
        raise ValueError("Failed to parse JSON from LLM response")
    return data


# ---------------------------------------------------------------------------
# Single extraction (<5.3K words)
# ---------------------------------------------------------------------------

async def _single_extraction(llm_service: LLMService, triage_result: TriageResult, template: str, transcript: str) -> AsyncGenerator[dict, None]:
    """Single extraction call for short transcripts (<4K words)."""
    yield {"event": "extraction_progress", "section": "all", "percent": 10}

    cache_static, dynamic_prompt = _split_prompt_for_caching(template, transcript)

    yield {"event": "extraction_progress", "section": "all", "percent": 30}
    raw = await call_llm_with_retry(
        llm_service, dynamic_prompt,
        max_tokens=16384, timeout=240.0, max_retries=2, stage_name="extraction",
        json_mode=True, cache_static=cache_static or None,
    )
    if not raw:
        raise ValueError("Extraction LLM call failed after retries")
    data = _parse_llm_json(raw)

    yield {"event": "extraction_progress", "section": "all", "percent": 80}
    validated = validate_domain_output(triage_result.content_tags, triage_result.modifiers, data)

    yield {"event": "extraction_progress", "section": "all", "percent": 100}
    yield {
        "event": "extraction_complete",
        "data": validated,
    }


# ---------------------------------------------------------------------------
# Overflow extraction (5.3-20K words)
# ---------------------------------------------------------------------------

async def _overflow_extraction(llm_service: LLMService, triage_result: TriageResult, template: str, transcript: str, word_count: int = 0) -> AsyncGenerator[dict, None]:
    """Overflow extraction for medium-long transcripts (5.3K+ words).

    Single call with dynamic timeout based on word count. JSON mode
    guarantees valid JSON — no retry/salvage needed.
    """
    timeout = _dynamic_timeout(word_count) if word_count else 240.0
    yield {"event": "extraction_progress", "section": "all", "percent": 10}

    cache_static, dynamic_prompt = _split_prompt_for_caching(template, transcript)

    yield {"event": "extraction_progress", "section": "all", "percent": 25}
    raw = await call_llm_with_retry(
        llm_service, dynamic_prompt,
        max_tokens=32768, timeout=timeout, max_retries=2, stage_name="extraction",
        json_mode=True, cache_static=cache_static or None,
    )
    if not raw:
        raise ValueError("Extraction LLM call failed after retries")
    data = _parse_llm_json(raw)

    yield {"event": "extraction_progress", "section": "all", "percent": 80}
    validated = validate_domain_output(triage_result.content_tags, triage_result.modifiers, data)

    yield {"event": "extraction_progress", "section": "all", "percent": 100}
    yield {
        "event": "extraction_complete",
        "data": validated,
    }


# ---------------------------------------------------------------------------
# Chunked extraction (>30 min with chapters)
# ---------------------------------------------------------------------------

def batch_chapters(
    chapters: list[ChapterChunk],
    max_tokens_per_batch: int | None = None,
) -> list[list[ChapterChunk]]:
    """Group chapters into batches that fit within token limits.

    Groups chapters sequentially until approaching the token limit,
    then starts a new batch. Never splits a single chapter.

    Args:
        chapters: List of ChapterChunks to batch.
        max_tokens_per_batch: Max tokens per batch. Defaults to config value.

    Returns:
        List of batches, each a list of ChapterChunks.
    """
    limit = max_tokens_per_batch or settings.MAX_TOKENS_PER_BATCH
    batches: list[list[ChapterChunk]] = []
    current_batch: list[ChapterChunk] = []
    current_tokens = 0

    for chapter in chapters:
        if current_tokens + chapter.token_estimate > limit and current_batch:
            batches.append(current_batch)
            current_batch = []
            current_tokens = 0
        current_batch.append(chapter)
        current_tokens += chapter.token_estimate

    if current_batch:
        batches.append(current_batch)

    return batches


def _format_time(seconds: float) -> str:
    """Format seconds as MM:SS or HH:MM:SS."""
    total = int(seconds)
    hours, remainder = divmod(total, 3600)
    minutes, secs = divmod(remainder, 60)
    if hours:
        return f"{hours}:{minutes:02d}:{secs:02d}"
    return f"{minutes}:{secs:02d}"


def _build_batch_transcript(batch: list[ChapterChunk]) -> str:
    """Build chapter-headed transcript text for a batch."""
    parts: list[str] = []
    for ch in batch:
        header = f"\n\n=== CHAPTER {ch.index + 1}: {ch.title} ({_format_time(ch.start_seconds)} - {_format_time(ch.end_seconds)}) ==="
        parts.append(header)
        parts.append(ch.text)
    return "\n".join(parts)


async def _chunked_extraction(
    llm_service: LLMService,
    triage_result: TriageResult,
    template: str,
    chapters: list[ChapterChunk],
) -> AsyncGenerator[dict, None]:
    """Chunked extraction for long videos (>30 min with chapters).

    Splits chapters into batches, processes in parallel, merges results.
    """
    batches = batch_chapters(chapters)
    num_batches = len(batches)
    logger.info("Chunked extraction: %d chapters in %d batches", len(chapters), num_batches)

    yield {"event": "extraction_progress", "section": "chunked", "percent": 5}

    # Process batches in parallel with concurrency limit.
    # batch_results is pre-allocated; each task writes to its own unique index
    # so no synchronization is needed despite concurrent access.
    semaphore = asyncio.Semaphore(min(3, num_batches))
    batch_results: list[dict[str, Any] | None] = [None] * num_batches
    async def process_batch(batch_idx: int, batch: list[ChapterChunk]) -> None:
        async with semaphore:
            chapter_text = _build_batch_transcript(batch)
            cache_static, dynamic_prompt = _split_prompt_for_caching(template, chapter_text)

            raw = await call_llm_with_retry(
                llm_service, dynamic_prompt,
                max_tokens=16384, timeout=300.0, max_retries=2,
                stage_name=f"extraction_batch{batch_idx + 1}",
                json_mode=True, cache_static=cache_static or None,
            )
            if raw:
                try:
                    batch_results[batch_idx] = _parse_llm_json(raw)
                except ValueError:
                    logger.warning("Batch %d JSON parse failed, skipping", batch_idx + 1)

    await asyncio.gather(*[
        process_batch(i, batch) for i, batch in enumerate(batches)
    ])

    yield {"event": "extraction_progress", "section": "chunked", "percent": 70}

    # Count successful batches
    successful = sum(1 for r in batch_results if r is not None)
    logger.info("Chunked extraction: %d/%d batches succeeded", successful, num_batches)

    if successful == 0:
        raise ValueError("All extraction batches failed")

    # Merge batch results
    merged = merge_batch_extractions(batch_results, triage_result.content_tags)

    yield {"event": "extraction_progress", "section": "validation", "percent": 85}

    # Validate merged result
    validated = validate_domain_output(triage_result.content_tags, triage_result.modifiers, merged)

    yield {"event": "extraction_progress", "section": "all", "percent": 100}
    yield {
        "event": "extraction_complete",
        "data": validated,
    }


