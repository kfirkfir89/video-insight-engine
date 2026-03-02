from __future__ import annotations

"""Pipeline helper functions extracted from stream.py.

Contains self-contained utilities for the summarization pipeline:
- SSE event formatting
- Pipeline timer and dataclasses
- Duration validation
- Video context extraction
- Segment normalization
- Result building
- Presigned URL refresh
- Chapter content helpers
"""

import json
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from src.services.chapter_pipeline import CrossChapterState
    from src.services.llm import LLMService

from src.config import settings
from src.exceptions import TranscriptError
from src.models.schemas import ErrorCode, TranscriptSegment
from src.services.description_analyzer import DescriptionAnalysis
from src.services.s3_client import s3_client
from src.services.sponsorblock import SponsorSegment, sponsor_segments_to_dict
from src.services.youtube import (
    VideoData,
    FastLLMProvider,
    classify_category_with_llm,
    get_llm_fallback_threshold,
    select_persona,
)

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# SSE Event Helpers
# ─────────────────────────────────────────────────────────────────────────────


def sse_event(event: str, data: dict[str, Any]) -> str:
    """Format data as SSE event."""
    return f"data: {json.dumps({'event': event, **data})}\n\n"


def sse_token(phase: str, token: str, **extra: Any) -> str:
    """Format token as SSE event."""
    return f"data: {json.dumps({'event': 'token', 'phase': phase, 'token': token, **extra})}\n\n"


# ─────────────────────────────────────────────────────────────────────────────
# Pipeline Timer
# ─────────────────────────────────────────────────────────────────────────────


class PipelineTimer:
    """Lightweight phase timer for pipeline observability."""

    __slots__ = ('_start',)

    def __init__(self) -> None:
        self._start = time.monotonic()

    def elapsed(self) -> float:
        """Seconds since pipeline start."""
        return time.monotonic() - self._start

    def elapsed_str(self) -> str:
        """Formatted elapsed time for logging."""
        return f"{self.elapsed():.1f}s"


# ─────────────────────────────────────────────────────────────────────────────
# Data Classes for Pipeline State
# ─────────────────────────────────────────────────────────────────────────────


@dataclass
class TranscriptData:
    """Holds transcript data from any source.

    Note: when ``source="metadata"``, ``segments`` is intentionally empty.
    Metadata-only transcripts skip sponsor filtering and AI chapter detection;
    only ``raw_text`` is used downstream for summarization.
    """
    segments: list[dict[str, Any]]
    raw_text: str
    transcript_type: str
    source: str  # ytdlp, api, proxy, whisper, gemini, metadata


@dataclass
class ParallelResults:
    """Results from parallel analysis phase."""
    description_analysis: DescriptionAnalysis | None = None
    synthesis: dict[str, Any] = field(default_factory=lambda: {"tldr": "", "keyTakeaways": []})
    first_chapter: dict[str, Any] | None = None
    first_facts: str = ""
    concepts: list[dict[str, Any]] = field(default_factory=list)
    failed_tasks: list[str] = field(default_factory=list)


@dataclass
class PipelineContext:
    """Shared context for the summarization pipeline."""
    video_summary_id: str
    youtube_id: str
    video_data: VideoData
    transcript: TranscriptData
    persona: str
    sponsor_segments: list[SponsorSegment]
    timer: PipelineTimer
    raw_transcript_ref: str | None = None  # S3 key for raw transcript


@dataclass(frozen=True)
class ChapterProcessingContext:
    """Common parameters shared across chapter processing functions."""

    llm_service: LLMService
    persona: str
    normalized_segments: list[dict[str, Any]]
    youtube_id: str | None = None


@dataclass(frozen=True)
class PostprocessContext:
    """Bundled parameters for _postprocess_and_yield_chapters.

    Groups the 7 keyword-only args into a single frozen dataclass
    so callers and the function itself are easier to read.
    """

    state: CrossChapterState
    provider: Any
    facts_by_idx: dict[int, str]
    youtube_id: str | None
    video_duration: int
    normalized_segments: list[dict[str, Any]]
    is_creator: bool


# ─────────────────────────────────────────────────────────────────────────────
# Segment Conversion & Normalization
# ─────────────────────────────────────────────────────────────────────────────


def normalized_segments_to_pipeline(
    segments: list[TranscriptSegment],
) -> list[dict[str, Any]]:
    """Convert NormalizedTranscript segments (startMs/endMs) to pipeline format (start/duration in seconds).

    The pipeline (sponsor filtering, format_transcript_with_timestamps, etc.)
    expects ``{"text": ..., "start": <seconds>, "duration": <seconds>}``.
    """
    return [
        {
            "text": s.text,
            "start": s.startMs / 1000.0,
            "duration": (s.endMs - s.startMs) / 1000.0,
        }
        for s in segments
    ]


def normalize_segments(segments: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Convert segments to normalized format with milliseconds."""
    normalized = []
    for seg in segments:
        if "startMs" in seg:
            # Browser/Whisper format - already in milliseconds
            start_ms = int(seg["startMs"])
            end_ms = int(seg.get("endMs", start_ms))
        else:
            # yt-dlp/API format - convert from seconds
            start_s = seg.get("start", 0)
            duration_s = seg.get("duration", 0)
            start_ms = int(start_s * 1000)
            end_ms = int((start_s + duration_s) * 1000)

        normalized.append({
            "text": seg.get("text", ""),
            "startMs": start_ms,
            "endMs": end_ms,
        })
    return normalized


# ─────────────────────────────────────────────────────────────────────────────
# Duration Validation
# ─────────────────────────────────────────────────────────────────────────────


def validate_duration(duration: int) -> None:
    """Validate video duration against limits."""
    if duration > settings.MAX_VIDEO_DURATION_MINUTES * 60:
        raise TranscriptError(
            f"Video too long ({duration // 60} min)",
            ErrorCode.VIDEO_TOO_LONG
        )
    if duration < settings.MIN_VIDEO_DURATION_SECONDS:
        raise TranscriptError(
            f"Video too short ({duration} sec)",
            ErrorCode.VIDEO_TOO_SHORT
        )


# ─────────────────────────────────────────────────────────────────────────────
# Video Context Helpers
# ─────────────────────────────────────────────────────────────────────────────


async def finalize_video_context(
    video_data: VideoData,
    llm_provider: FastLLMProvider,
) -> VideoData:
    """Finalize video context with LLM fallback if confidence is low.

    If category detection confidence is below threshold, uses LLM
    to classify the video category. Updates VideoContext in place.

    Args:
        video_data: VideoData with initial context
        llm_provider: FastLLMProvider instance for LLM fallback

    Returns:
        VideoData with finalized context (category may be updated)
    """
    if not video_data.context:
        return video_data

    threshold = get_llm_fallback_threshold()
    confidence = video_data.context.category_confidence

    # Only call LLM if confidence is below threshold
    if confidence < threshold:
        logger.info(
            "Low category confidence (%.2f < %s), triggering LLM fallback for '%s'",
            confidence, threshold, video_data.title,
        )

        new_category = await classify_category_with_llm(
            title=video_data.title,
            channel=video_data.channel,
            tags=video_data.context.tags,
            description=video_data.description,
            llm_provider=llm_provider,
        )

        # Update context with LLM-detected category
        video_data.context.category = new_category
        video_data.context.persona = select_persona(new_category)
        video_data.context.category_confidence = 0.8  # LLM confidence is higher

        logger.info(
            "LLM fallback: category=%s, persona=%s",
            new_category, video_data.context.persona,
        )

    return video_data


def extract_context(video_data: VideoData) -> tuple[dict[str, Any] | None, str]:
    """Extract video context and persona from video data.

    Category and persona are now decoupled:
    - category: detected directly via weighted scoring in youtube.py
    - persona: selected based on category, used for LLM prompts

    Returns:
        Tuple of (context_dict for storage, persona for internal LLM use).
        The context_dict contains category (user-facing), not persona (internal).
    """
    if not video_data.context:
        return None, "standard"

    # Use category directly from VideoContext (no more reverse mapping!)
    category = video_data.context.category
    persona = video_data.context.persona

    # Store category and metadata
    context_dict = {
        "category": category,
        "youtubeCategory": video_data.context.youtube_category or "Unknown",
        "tags": video_data.context.tags,
        "displayTags": video_data.context.display_tags,
    }
    logger.info(
        "Video context: category=%s, persona=%s, tags=%d",
        category, persona, len(video_data.context.display_tags),
    )
    return context_dict, persona


# ─────────────────────────────────────────────────────────────────────────────
# Chapter Content Helpers
# ─────────────────────────────────────────────────────────────────────────────


def has_empty_content(summary_data: dict[str, Any], idx: int, title: str) -> bool:
    """Check if LLM output has empty content and log a warning."""
    content = summary_data.get("content", [])
    if not content:
        logger.warning(
            "Dropping chapter %d '%s' — empty content after LLM processing",
            idx, title,
        )
        return True
    return False


def collect_chapter_concepts(
    summary_data: dict[str, Any],
    chapter_idx: int,
    all_chapter_concepts: list[tuple[int, list[dict]]],
    already_extracted_names: list[str],
) -> None:
    """Extract concepts from a chapter result and append to the running accumulators.

    Mutates *all_chapter_concepts* and *already_extracted_names* in place.
    """
    raw_concepts = summary_data.get("concepts", [])
    if not raw_concepts:
        return
    all_chapter_concepts.append((chapter_idx, raw_concepts))
    already_extracted_names.extend(
        c.get("name", "")
        for c in raw_concepts
        if isinstance(c, dict) and c.get("name")
    )


# ─────────────────────────────────────────────────────────────────────────────
# Metadata Text Builder
# ─────────────────────────────────────────────────────────────────────────────


def build_metadata_text(video_data: VideoData) -> str:
    """Build a text representation from video metadata for fallback summarization.

    Used when all transcript sources fail for music videos. Composes from
    title, channel, description, tags, and chapter titles.
    """
    parts: list[str] = []
    parts.append(f"Title: {video_data.title}")
    if video_data.channel:
        parts.append(f"Channel: {video_data.channel}")
    if video_data.description:
        # Truncate long descriptions to avoid LLM overload
        desc = video_data.description[:2000]
        parts.append(f"Description: {desc}")
    if video_data.context and video_data.context.tags:
        parts.append(f"Tags: {', '.join(video_data.context.tags[:20])}")
    if video_data.has_chapters:
        chapter_titles = [ch.title for ch in video_data.chapters]
        parts.append(f"Chapters: {', '.join(chapter_titles)}")
    return "\n\n".join(parts)


# ─────────────────────────────────────────────────────────────────────────────
# Result Building
# ─────────────────────────────────────────────────────────────────────────────


def build_result(
    ctx: PipelineContext,
    synthesis: dict[str, Any],
    chapters: list[dict[str, Any]],
    concepts: list[dict[str, Any]],
    master_summary: str | None,
    description_analysis: DescriptionAnalysis | None,
    context_dict: dict[str, Any] | None,
    llm_model: str,
) -> dict[str, Any]:
    """Build the final result dictionary for storage."""
    processing_time = int(ctx.timer.elapsed() * 1000)

    result: dict[str, Any] = {
        "title": ctx.video_data.title,
        "channel": ctx.video_data.channel,
        "duration": ctx.video_data.duration,
        "thumbnail_url": ctx.video_data.thumbnail_url,
        "transcript": ctx.transcript.raw_text,
        "transcript_type": ctx.transcript.transcript_type,
        "transcript_segments": normalize_segments(ctx.transcript.segments),
        "transcript_source": ctx.transcript.source,
        "summary": {
            "tldr": synthesis.get("tldr", ""),
            "key_takeaways": synthesis.get("keyTakeaways", []),
            "chapters": chapters,
            "concepts": concepts,
            "master_summary": master_summary,
        },
        "processing_time_ms": processing_time,
        "token_usage": {},
    }

    # Add S3 reference for raw transcript (for regeneration)
    if ctx.raw_transcript_ref:
        result["raw_transcript_ref"] = ctx.raw_transcript_ref

    # Add generation metadata (for regeneration tracking)
    result["generation"] = {
        "model": llm_model,
        "prompt_version": settings.PROMPT_VERSION,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }

    # Add chapters if available
    if ctx.video_data.has_chapters:
        result["chapters"] = [
            {
                "startSeconds": int(ch.start_time),
                "endSeconds": int(ch.end_time),
                "title": ch.title,
                "isCreatorChapter": True,
            }
            for ch in ctx.video_data.chapters
        ]
        result["chapter_source"] = "creator"

    # Add optional data
    if description_analysis and description_analysis.has_content:
        result["description_analysis"] = description_analysis.to_dict()

    if ctx.sponsor_segments:
        result["sponsor_segments"] = sponsor_segments_to_dict(ctx.sponsor_segments)

    if context_dict:
        result["context"] = context_dict

    return result


# ─────────────────────────────────────────────────────────────────────────────
# Presigned URL Refresh
# ─────────────────────────────────────────────────────────────────────────────


def refresh_presigned_url(block_or_frame: dict, key: str) -> bool:
    """Refresh a single presigned URL. Returns True on success."""
    try:
        block_or_frame["imageUrl"] = s3_client.generate_presigned_url(key)
        return True
    except Exception as e:
        logger.warning("Failed to refresh presigned URL for %s: %s", key, e)
        return False


def refresh_frame_urls(chapters: list[dict]) -> None:
    """Refresh presigned URLs for visual blocks with s3_key.

    Handles both single-frame visuals (top-level s3_key) and
    multi-frame visuals (frames[].s3_key for slideshow/gallery).

    This is a sync function — presigned URL generation is a local
    cryptographic operation (HMAC-SHA256), no network call needed.
    Mutates chapters in-place for efficiency on cached results.
    """
    refreshed = 0
    for chapter in chapters:
        for block in chapter.get("content", []):
            if block.get("type") != "visual":
                continue
            # Single-frame: top-level s3_key
            s3_key = block.get("s3_key")
            if s3_key and s3_key.startswith("videos/"):
                if refresh_presigned_url(block, s3_key):
                    refreshed += 1
            # Multi-frame: frames[].s3_key (slideshow/gallery)
            for frame in block.get("frames", []):
                frame_key = frame.get("s3_key")
                if frame_key and frame_key.startswith("videos/"):
                    if refresh_presigned_url(frame, frame_key):
                        refreshed += 1
    if refreshed:
        logger.debug("Refreshed %d presigned frame URLs", refreshed)
