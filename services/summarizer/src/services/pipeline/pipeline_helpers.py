"""Pipeline helper functions for the summarization pipeline.

Contains self-contained utilities:
- SSE event formatting
- Pipeline timer
- TranscriptData dataclass
- Duration validation
- Segment normalization
- Metadata text builder
- Presigned URL refresh
- JSON truncation
"""

import json
import logging
import time
from dataclasses import dataclass
from typing import Any

from src.config import settings
from src.exceptions import TranscriptError
from src.models.schemas import ErrorCode, TranscriptSegment
from src.services.media.s3_client import s3_client

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# SSE Event Helpers
# ─────────────────────────────────────────────────────────────────────────────


def sse_event(event: str, data: dict[str, Any]) -> str:
    """Format data as SSE event."""
    return f"data: {json.dumps({'event': event, **data})}\n\n"


def truncate_json_safely(data: Any, max_chars: int) -> str:
    """Serialize JSON compactly and truncate at a structural boundary.

    Avoids cutting mid-string which would produce invalid JSON context
    for downstream prompts. Handles both objects and arrays.
    """
    serialized = json.dumps(data, separators=(",", ":"))
    if len(serialized) <= max_chars:
        return serialized
    truncated = serialized[:max_chars]
    last_comma = truncated.rfind(",")
    if last_comma > max_chars * 0.5:
        truncated = truncated[:last_comma]
    closer = "]" if isinstance(data, list) else "}"
    return truncated + closer


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
# Data Classes
# ─────────────────────────────────────────────────────────────────────────────


@dataclass
class TranscriptData:
    """Holds transcript data from any source.

    Note: when ``source="metadata"``, ``segments`` is intentionally empty.
    """
    segments: list[dict[str, Any]]
    raw_text: str
    transcript_type: str
    source: str  # ytdlp, api, proxy, whisper, gemini, metadata


# ─────────────────────────────────────────────────────────────────────────────
# Segment Conversion & Normalization
# ─────────────────────────────────────────────────────────────────────────────


def normalized_segments_to_pipeline(
    segments: list[TranscriptSegment],
) -> list[dict[str, Any]]:
    """Convert NormalizedTranscript segments (startMs/endMs) to pipeline format (start/duration in seconds)."""
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
            start_ms = int(seg["startMs"])
            end_ms = int(seg.get("endMs", start_ms))
        else:
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
# Metadata Text Builder
# ─────────────────────────────────────────────────────────────────────────────


def build_metadata_text(video_data: Any) -> str:
    """Build a text representation from video metadata for fallback summarization."""
    parts: list[str] = []
    parts.append(f"Title: {video_data.title}")
    if video_data.channel:
        parts.append(f"Channel: {video_data.channel}")
    if video_data.description:
        desc = video_data.description[:2000]
        parts.append(f"Description: {desc}")
    if video_data.context and video_data.context.tags:
        parts.append(f"Tags: {', '.join(video_data.context.tags[:20])}")
    if video_data.has_chapters:
        chapter_titles = [ch.title for ch in video_data.chapters]
        parts.append(f"Chapters: {', '.join(chapter_titles)}")
    return "\n\n".join(parts)


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
    """
    refreshed = 0
    for chapter in chapters:
        for block in chapter.get("content", []):
            if block.get("type") != "visual":
                continue
            s3_key = block.get("s3_key")
            if s3_key and s3_key.startswith("videos/"):
                if refresh_presigned_url(block, s3_key):
                    refreshed += 1
            for frame in block.get("frames", []):
                frame_key = frame.get("s3_key")
                if frame_key and frame_key.startswith("videos/"):
                    if refresh_presigned_url(frame, frame_key):
                        refreshed += 1
    if refreshed:
        logger.debug("Refreshed %d presigned frame URLs", refreshed)
