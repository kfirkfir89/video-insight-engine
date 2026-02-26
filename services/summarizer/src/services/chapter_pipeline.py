"""Cross-chapter orchestration for the summarization pipeline.

Responsibility split with routes/stream.py:
  - stream.py: SSE streaming, HTTP concerns, phase orchestration, pipeline context
  - chapter_pipeline.py (this file): chapter-level processing logic

Extracted from routes/stream.py to keep the route module focused on
SSE streaming and HTTP concerns. Contains:
- Background validation task management (fire-and-forget accuracy tasks)
- Cross-chapter state tracking (guest names, block types, frame hashes)
- Fact extraction orchestration (gather_chapter_facts)
- Chapter post-processing (postprocess_chapter — validation, frame extraction)
- Chapter dict building (build_chapter_dict — assembles final chapter shape)
"""

import asyncio
import logging
import uuid
from dataclasses import dataclass, field
from typing import Any

from src.services.llm_provider import LLMProvider
from src.services.llm import seconds_to_timestamp
from src.services.accuracy import extract_chapter_facts, validate_chapter_blocks
from src.services.frame_extractor import extract_frames_for_blocks
from src.utils.constants import YOUTUBE_ID_RE

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Background Validation Task Management
# ─────────────────────────────────────────────────────────────────────────────


_BACKGROUND_VALIDATION_WARN_THRESHOLD = 100
_BACKGROUND_VALIDATION_MAX = 500

_background_validations: set[asyncio.Task[object]] = set()
"""Tracked background validation tasks — prevents GC and enables graceful shutdown.

NOTE: Module-level mutable state. In production this is safe (asyncio is
single-threaded), but tests must call clear_background_validations() in
teardown fixtures to avoid cross-test leakage.
"""


def _log_bg_failure(task: asyncio.Task[object]) -> None:
    """Callback for fire-and-forget tasks — logs exceptions and removes from tracking set."""
    _background_validations.discard(task)
    if not task.cancelled():
        exc = task.exception()
        if exc:
            logger.warning("Background validation failed: %s", exc)


async def shutdown_background_validations() -> None:
    """Await all pending background validation tasks during graceful shutdown.

    Call this from the FastAPI shutdown event to ensure all fire-and-forget
    validation tasks complete before the process exits.

    Takes a snapshot of the set before gathering to avoid mutation during
    iteration (done callbacks discard from the set concurrently).
    """
    if _background_validations:
        logger.info("Awaiting %d background validation tasks...", len(_background_validations))
        tasks = list(_background_validations)  # snapshot — callbacks may discard during gather
        await asyncio.gather(*tasks, return_exceptions=True)
        _background_validations.clear()


def clear_background_validations() -> None:
    """Clear tracked background tasks. Use in test teardown for isolation."""
    _background_validations.clear()


def fire_validation(provider: LLMProvider, facts: str, content: list[dict], title: str) -> None:
    """Fire-and-forget background validation of generated blocks against fact sheet.

    Creates an asyncio task that logs accuracy metrics without blocking
    the main summarization pipeline. Tasks are tracked in _background_validations
    so they aren't garbage-collected and can be awaited during shutdown.
    """
    if len(_background_validations) >= _BACKGROUND_VALIDATION_MAX:
        logger.error(
            "Background validation backlog full (%d tasks), dropping validation for '%s'",
            len(_background_validations), title,
        )
        return
    if len(_background_validations) >= _BACKGROUND_VALIDATION_WARN_THRESHOLD:
        logger.warning("Background validation backlog: %d tasks", len(_background_validations))
    task = asyncio.create_task(
        validate_chapter_blocks(provider, facts, content, title)
    )
    _background_validations.add(task)
    task.add_done_callback(_log_bg_failure)


# ─────────────────────────────────────────────────────────────────────────────
# Cross-Chapter State & Helpers
# ─────────────────────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class ChapterTimeRange:
    """Immutable time range for a chapter within a video.

    Groups video_duration, chapter_start, and chapter_end to reduce
    parameter count on postprocess_chapter().
    """
    video_duration: int | None = None
    chapter_start: int | None = None
    chapter_end: int | None = None


@dataclass
class CrossChapterState:
    """Mutable cross-chapter tracking for guest names, block types, facts, and frame hashes."""
    guest_names: list[str] | None = None
    prev_block_types: list[str] | None = None
    frame_hashes: dict[int, str] = field(default_factory=dict)  # ahash_int -> s3_key


def extract_guest_names(content: list[dict]) -> list[str] | None:
    """Extract guest names from the first guest block found in content.

    Returns a list of names or None if no guest block exists.
    """
    for block in content:
        if block.get("type") == "guest":
            names: list[str] = [
                str(g["name"]) for g in block.get("guests", [])
                if isinstance(g, dict) and g.get("name")
            ]
            if names:
                return names
    return None


def extract_block_types(content: list[dict]) -> list[str]:
    """Extract block type strings from content for cross-chapter diversity tracking."""
    return [
        str(b["type"]) for b in content
        if isinstance(b, dict) and b.get("type")
    ]


# ─────────────────────────────────────────────────────────────────────────────
# Fact Extraction Orchestration
# ─────────────────────────────────────────────────────────────────────────────


# Minimum text length for fact extraction (avoids wasting LLM calls on tiny chapters)
_MIN_FACT_TEXT_LENGTH = 100


async def gather_chapter_facts(
    provider: LLMProvider,
    chapters: list[tuple[int, str, str]],
    persona: str,
) -> dict[int, str]:
    """Extract facts for multiple chapters in parallel (fast model, ~1s each).

    Skips chapters with fewer than _MIN_FACT_TEXT_LENGTH characters to avoid
    wasting LLM calls on very short chapter text.

    Args:
        provider: LLMProvider instance for fast model calls
        chapters: List of (index, chapter_text, title) tuples
        persona: Content persona for category-specific extraction

    Returns:
        Dict mapping chapter index → fact JSON string (empty string on failure).
    """
    fact_tasks: dict[int, asyncio.Task[str]] = {}
    for idx, text, title in chapters:
        if text and len(text) >= _MIN_FACT_TEXT_LENGTH:
            fact_tasks[idx] = asyncio.create_task(
                extract_chapter_facts(provider, text, title, persona=persona)
            )

    facts_by_idx: dict[int, str] = {}
    if fact_tasks:
        indices = list(fact_tasks.keys())
        results = await asyncio.gather(*fact_tasks.values(), return_exceptions=True)
        for idx, result in zip(indices, results):
            if isinstance(result, BaseException):
                logger.warning("Fact extraction failed for chapter %d: %s", idx, result)
                facts_by_idx[idx] = ""
            else:
                facts_by_idx[idx] = result

    return facts_by_idx


# ─────────────────────────────────────────────────────────────────────────────
# Chapter Post-Processing
# ─────────────────────────────────────────────────────────────────────────────


async def postprocess_chapter(
    summary_data: dict[str, Any],
    state: CrossChapterState,
    provider: LLMProvider,
    facts: str,
    title: str,
    youtube_id: str | None,
    idx: int,
    time_range: ChapterTimeRange | None = None,
) -> list[dict]:
    """Post-process a chapter: track cross-chapter state, fire validation, extract frames.

    Returns the (possibly updated) content list. Does not mutate summary_data.
    Mutates state.guest_names and state.prev_block_types.

    Args:
        summary_data: Chapter summary dict with "content" key
        state: Mutable cross-chapter tracking state
        provider: LLMProvider for validation calls
        facts: Fact sheet JSON string for validation
        title: Chapter title for logging
        youtube_id: YouTube video ID for frame extraction
        idx: Chapter index for logging
        time_range: Optional chapter time range (video duration, start, end)

    Returns:
        Content list with frames extracted where possible.
    """
    content = summary_data.get("content", [])

    # Track guest names (first occurrence wins)
    if not state.guest_names:
        state.guest_names = extract_guest_names(content)
    state.prev_block_types = extract_block_types(content)

    # Non-blocking validation (fire and forget for metrics)
    if facts and content:
        fire_validation(provider, facts, content, title)

    # Unpack time range (all None if not provided)
    video_duration = time_range.video_duration if time_range else None
    chapter_start = time_range.chapter_start if time_range else None
    chapter_end = time_range.chapter_end if time_range else None

    # Extract real video frames for visual blocks (non-critical — degrade gracefully)
    if youtube_id:
        try:
            content = await extract_frames_for_blocks(
                youtube_id, content, video_duration, chapter_start, chapter_end,
                frame_hashes=state.frame_hashes,
            )
        except Exception as e:
            logger.warning("Frame extraction failed for chapter %d: %s", idx, e)

    return content


def populate_visual_thumbnails(content: list[dict], youtube_id: str) -> list[dict]:
    """Fallback: populate empty imageUrl fields on visual blocks with YouTube thumbnail.

    Used as a fallback when frame extraction is disabled or fails entirely.
    Frame extraction (extract_frames_for_blocks) provides per-timestamp images.

    SECURITY: youtube_id is validated against YOUTUBE_ID_RE (strict 11-char
    alphanumeric) before URL interpolation to prevent injection.

    Args:
        content: List of content block dicts (not mutated).
        youtube_id: YouTube video ID for thumbnail URL.

    Returns:
        New content list with imageUrl populated on visual blocks,
        or the original list if no visual blocks need updating.
    """
    if not YOUTUBE_ID_RE.match(youtube_id):
        return content
    # Short-circuit if no visual blocks need updating
    if not any(isinstance(b, dict) and b.get("type") == "visual" and not b.get("imageUrl") for b in content):
        return content
    result = []
    for block in content:
        if isinstance(block, dict) and block.get("type") == "visual" and not block.get("imageUrl"):
            block = {**block, "imageUrl": f"https://img.youtube.com/vi/{youtube_id}/maxresdefault.jpg"}
        result.append(block)
    return result


def build_chapter_dict(
    raw: dict[str, Any],
    summary_data: dict[str, Any],
    is_creator_chapter: bool,
    transcript_slice: str | None = None,
    youtube_id: str | None = None,
) -> dict[str, Any]:
    """Build a chapter dictionary from raw data and summary.

    Note: summary/bullets are no longer stored - they can be extracted
    on-demand from content blocks using extract_summary_from_content()
    and extract_bullets_from_content() from src.utils.content_extractor.
    """
    start = raw.get("startSeconds", raw.get("start_seconds", 0))
    end = raw.get("endSeconds", raw.get("end_seconds", start))

    content = summary_data.get("content", [])

    # Fallback: populate visual blocks without imageUrl with YouTube thumbnail.
    # Real per-timestamp frames are set by postprocess_chapter() before this call.
    if youtube_id and content:
        content = populate_visual_thumbnails(content, youtube_id)

    chapter: dict[str, Any] = {
        "id": str(uuid.uuid4()),
        "timestamp": seconds_to_timestamp(start),
        "start_seconds": start,
        "end_seconds": end,
        "title": raw.get("title", ""),
        "is_creator_chapter": is_creator_chapter,
        "content": content,
    }

    # Add per-chapter view when present
    if summary_data.get("view"):
        chapter["view"] = summary_data["view"]

    # Add sliced transcript for RAG/display
    if transcript_slice:
        chapter["transcript"] = transcript_slice

    if is_creator_chapter:
        chapter["original_title"] = raw.get("title", "")
        chapter["generated_title"] = summary_data.get("generatedTitle")

    return chapter
