"""Transcript fetching with multi-source fallback chain.

Provides the async generator ``fetch_transcript`` which tries each
transcript source in priority order:
  S3 cache -> yt-dlp subtitles -> youtube-transcript-api -> Gemini -> Whisper -> metadata

Extracted from ``src.routes.stream`` for maintainability.
"""

import asyncio
import logging
from typing import AsyncGenerator

from src.config import settings
from src.exceptions import TranscriptError
from src.models.schemas import ErrorCode
from src.services.gemini_transcriber import transcribe_with_gemini
from src.services.pipeline_helpers import (
    TranscriptData,
    build_metadata_text,
    normalized_segments_to_pipeline,
    sse_event,
)
from src.services.s3_client import S3Client
from src.services.transcript import get_transcript
from src.services.transcript_store import transcript_store
from src.services.whisper_transcriber import transcribe_with_whisper
from src.services.youtube import VideoData

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────────────────────────────────────


async def fetch_transcript(
    youtube_id: str,
    video_data: VideoData,
    duration: int,
    is_music: bool = False,
) -> AsyncGenerator[str | TranscriptData, None]:
    """
    Fetch transcript using fallback chain: S3 cache -> yt-dlp -> API -> Gemini -> Whisper.

    Yields SSE events for phase changes, then yields TranscriptData as final item.

    Args:
        youtube_id: YouTube video ID
        video_data: Extracted video data
        duration: Video duration in seconds
        is_music: If True, use music-specific transcription prompts
    """
    # Priority 0: S3 cached transcript (avoids all YouTube calls)
    if S3Client.is_available():
        try:
            cached = await transcript_store.get(youtube_id)
            if cached:
                logger.info("Using S3 cached transcript: %d segments", len(cached.segments))
                yield sse_event("phase", {"phase": "transcript_cached"})
                # S3 stores normalized segments (startMs/endMs).
                # Convert to start/duration (seconds) for pipeline compatibility
                # (format_transcript_with_timestamps, sponsor filtering, etc.)
                segments = []
                for seg in cached.segments:
                    start_ms = seg.get("startMs", 0)
                    end_ms = seg.get("endMs", start_ms)
                    segments.append({
                        "text": seg.get("text", ""),
                        "start": start_ms / 1000.0,
                        "duration": (end_ms - start_ms) / 1000.0,
                    })
                raw_text = " ".join(seg["text"] for seg in segments)
                yield TranscriptData(
                    segments=segments,
                    raw_text=raw_text,
                    transcript_type=f"cached-{cached.source}",
                    source="s3",
                )
                return
        except Exception as e:
            logger.warning("S3 transcript retrieval failed, continuing with fallback chain: %s", e)

    # Priority 1: yt-dlp subtitles
    if video_data.subtitles:
        segments = [
            {"text": seg.text, "start": seg.start, "duration": seg.duration}
            for seg in video_data.subtitles
        ]
        logger.info("Using yt-dlp subtitles: %d segments", len(segments))
        yield TranscriptData(
            segments=segments,
            raw_text=video_data.transcript_text,
            transcript_type="yt-dlp",
            source="ytdlp",
        )
        return

    # Priority 3: youtube-transcript-api
    logger.info("yt-dlp subtitles not available, falling back to youtube-transcript-api")
    yield sse_event("phase", {"phase": "transcript"})

    try:
        segments, raw_text, transcript_type = await asyncio.wait_for(
            get_transcript(youtube_id),
            timeout=settings.TRANSCRIPT_FETCH_TIMEOUT,
        )
        source = "proxy" if settings.WEBSHARE_PROXY_USERNAME else "api"
        yield TranscriptData(
            segments=segments,
            raw_text=raw_text,
            transcript_type=transcript_type,
            source=source,
        )
        return
    except asyncio.TimeoutError:
        logger.warning("get_transcript timed out after %ss for %s", settings.TRANSCRIPT_FETCH_TIMEOUT, youtube_id)
        if not settings.WHISPER_ENABLED:
            raise TranscriptError(
                "Transcript fetch timed out and Whisper is disabled",
                ErrorCode.NO_TRANSCRIPT,
            )
        if duration > settings.WHISPER_MAX_DURATION_MINUTES * 60:
            logger.warning("Video too long for Whisper (%d min)", duration // 60)
            raise TranscriptError(
                "Transcript fetch timed out and video too long for Whisper",
                ErrorCode.NO_TRANSCRIPT,
            )
        # Fall through to Whisper
    except TranscriptError as e:
        # Priority 4: Whisper fallback for NO_TRANSCRIPT errors
        if e.code != ErrorCode.NO_TRANSCRIPT or not settings.WHISPER_ENABLED:
            raise
        if duration > settings.WHISPER_MAX_DURATION_MINUTES * 60:
            logger.warning("Video too long for Whisper (%d min)", duration // 60)
            raise

    # Audio transcription fallback chain: Gemini (fast) -> Whisper (reliable)
    duration_min = duration // 60
    if duration_min > 180:
        logger.warning(
            "Audio transcription requested for long video %s (%d min). "
            "Estimated cost: ~$%.2f Whisper API.",
            youtube_id, duration_min, duration_min * 0.006,
        )
    logger.info("No captions for %s, trying audio transcription", youtube_id)
    yield sse_event("phase", {"phase": "audio_transcription"})

    # Try Gemini first -- faster and cheaper than Whisper
    gemini_data = await _try_gemini_transcription(youtube_id, duration, is_music)
    if gemini_data is not None:
        yield gemini_data
        return

    # Whisper fallback
    yield sse_event("phase", {"phase": "whisper_transcription"})
    whisper_data, whisper_error = await _try_whisper_transcription(youtube_id, duration, is_music)
    if whisper_data is not None:
        yield whisper_data
        return

    # Metadata fallback -- only for music videos when all transcript sources fail.
    # Yields empty segments intentionally: sponsor filtering and AI chapter detection
    # are skipped for metadata-only transcripts; only raw_text is used downstream.
    if is_music:
        logger.info("All transcript sources failed for music video %s, using metadata fallback", youtube_id)
        yield sse_event("phase", {"phase": "metadata_fallback"})
        metadata_text = build_metadata_text(video_data)
        yield TranscriptData(
            segments=[],
            raw_text=metadata_text,
            transcript_type="metadata",
            source="metadata",
        )
        return

    # Not a music video -- raise the last error from the fallback chain.
    # whisper_error is None when Whisper is disabled and Gemini was the only audio path.
    if whisper_error is not None:
        raise whisper_error
    raise TranscriptError("All transcript sources failed", ErrorCode.NO_TRANSCRIPT)


# ─────────────────────────────────────────────────────────────────────────────
# Internal helpers
# ─────────────────────────────────────────────────────────────────────────────


async def _try_gemini_transcription(
    youtube_id: str,
    duration: int,
    is_music: bool,
) -> TranscriptData | None:
    """Attempt Gemini audio transcription. Returns TranscriptData on success, None on failure."""
    if not settings.GEMINI_API_KEY:
        return None

    gemini_timeout = min(max(120.0, duration * 0.02 + 60), 300.0)
    logger.info(
        "Trying Gemini transcription (timeout: %ds) for %ds video",
        int(gemini_timeout), duration,
    )
    try:
        gemini_result = await asyncio.wait_for(
            transcribe_with_gemini(youtube_id, is_music=is_music),
            timeout=gemini_timeout,
        )
        segments = normalized_segments_to_pipeline(gemini_result.segments)
        logger.info("Gemini transcription successful: %d segments", len(segments))
        return TranscriptData(
            segments=segments,
            raw_text=gemini_result.text,
            transcript_type="gemini",
            source="gemini",
        )
    except (TranscriptError, asyncio.TimeoutError) as e:
        logger.warning("Gemini transcription failed, falling back to Whisper: %s", e)
    except Exception as e:
        logger.error("Unexpected Gemini error: %s", e, exc_info=True)
    return None


async def _try_whisper_transcription(
    youtube_id: str,
    duration: int,
    is_music: bool,
) -> tuple[TranscriptData | None, TranscriptError | None]:
    """Attempt Whisper transcription. Returns (data, None) on success or (None, error) on failure."""
    logger.info("Trying Whisper fallback for %s", youtube_id)
    # Timeout scales with duration: ~1 min download per 30 min video + transcription overhead
    # Minimum 5 min, max 15 min. A 173-min video gets ~10 min.
    whisper_timeout = min(max(300.0, duration * 0.055 + 120), 900.0)
    logger.info("Whisper timeout set to %ds for %ds video", int(whisper_timeout), duration)

    try:
        whisper_result = await asyncio.wait_for(
            transcribe_with_whisper(youtube_id, is_music=is_music),
            timeout=whisper_timeout,
        )
    except asyncio.TimeoutError:
        return None, TranscriptError(
            f"Whisper transcription timed out after {int(whisper_timeout)}s",
            ErrorCode.UNKNOWN_ERROR,
        )
    except TranscriptError as e:
        return None, e
    except Exception as e:
        logger.error("Whisper transcription failed unexpectedly: %s", e, exc_info=True)
        return None, TranscriptError(
            f"Whisper transcription failed: {e}",
            ErrorCode.UNKNOWN_ERROR,
        )

    segments = normalized_segments_to_pipeline(whisper_result.segments)
    logger.info("Whisper fallback successful: %d segments", len(segments))
    return TranscriptData(
        segments=segments,
        raw_text=whisper_result.text,
        transcript_type="whisper",
        source="whisper",
    ), None
