import re
import asyncio
import logging
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api.proxies import WebshareProxyConfig
from youtube_transcript_api._errors import (
    TranscriptsDisabled,
    NoTranscriptFound,
    VideoUnavailable,
)
import tenacity

from src.config import settings
from src.models.schemas import (
    ErrorCode,
    TranscriptSegment,
    NormalizedTranscript,
    TranscriptSource,
)
from src.exceptions import TranscriptError

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────
# Rate Limit Detection & Retry Logic
# ─────────────────────────────────────────────────────


def _is_rate_limit_error(exception: BaseException) -> bool:
    """Check if exception is a rate limit (429) error."""
    error_str = str(exception).lower()
    return any(x in error_str for x in ["429", "too many", "rate limit"])


def _log_retry(retry_state: tenacity.RetryCallState) -> None:
    """Log retry attempts for rate limiting."""
    wait_time = retry_state.next_action.sleep if retry_state.next_action else 0
    logger.warning(
        f"Transcript fetch rate limited, attempt {retry_state.attempt_number}/3, "
        f"waiting {wait_time:.1f}s..."
    )


@tenacity.retry(
    stop=tenacity.stop_after_attempt(3),
    wait=tenacity.wait_exponential(multiplier=2, min=4, max=30),
    retry=tenacity.retry_if_exception(_is_rate_limit_error),
    before_sleep=_log_retry,
    reraise=True,
)
def _fetch_transcript_sync(video_id: str) -> tuple[list[dict], str, str]:
    """
    Fetch transcript from YouTube (synchronous internal function).

    Returns:
        (segments, full_text, transcript_type)
    """
    # Configure proxy if credentials are available
    proxy_config = None
    if settings.WEBSHARE_PROXY_USERNAME and settings.WEBSHARE_PROXY_PASSWORD:
        proxy_config = WebshareProxyConfig(
            proxy_username=settings.WEBSHARE_PROXY_USERNAME,
            proxy_password=settings.WEBSHARE_PROXY_PASSWORD,
        )

    # Create API instance with optional proxy
    ytt_api = YouTubeTranscriptApi(proxy_config=proxy_config)

    try:
        # New API: use instance method .list() instead of class method .list_transcripts()
        transcript_list = ytt_api.list(video_id)

        # Prefer manual captions
        transcript = None
        transcript_type = "auto-generated"

        try:
            transcript = transcript_list.find_manually_created_transcript(["en"])
            transcript_type = "manual"
        except (NoTranscriptFound, TranscriptsDisabled):
            try:
                transcript = transcript_list.find_generated_transcript(["en"])
            except (NoTranscriptFound, TranscriptsDisabled):
                # Try any available
                for t in transcript_list:
                    transcript = t
                    break

        if not transcript:
            raise TranscriptError("No transcript available", ErrorCode.NO_TRANSCRIPT)

        # Fetch transcript and convert to dict format
        fetched = transcript.fetch()
        # New API returns FetchedTranscript object, convert to raw data
        segments = fetched.to_raw_data() if hasattr(fetched, 'to_raw_data') else list(fetched)

        # Handle both old dict format and new snippet format
        if segments and hasattr(segments[0], 'text'):
            segments = [{"text": s.text, "start": s.start, "duration": s.duration} for s in segments]

        full_text = " ".join([s["text"] for s in segments])

        return segments, full_text, transcript_type

    except TranscriptsDisabled:
        raise TranscriptError("Captions are disabled for this video", ErrorCode.NO_TRANSCRIPT)
    except NoTranscriptFound:
        raise TranscriptError("No English transcript available", ErrorCode.NO_TRANSCRIPT)
    except VideoUnavailable:
        raise TranscriptError("Video is unavailable or private", ErrorCode.VIDEO_UNAVAILABLE)
    except TranscriptError:
        raise
    except Exception as e:
        # Detect rate limiting errors and map to specific error code
        if _is_rate_limit_error(e):
            raise TranscriptError(
                "YouTube rate limited. Please try again later.",
                ErrorCode.RATE_LIMITED,
            )
        raise TranscriptError(f"Failed to fetch transcript: {str(e)}", ErrorCode.UNKNOWN_ERROR)


def clean_transcript(text: str) -> str:
    """Clean and normalize transcript text."""
    # Remove common artifacts
    text = re.sub(r"\[Music\]", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\[Applause\]", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\[Laughter\]", "", text, flags=re.IGNORECASE)

    # Normalize whitespace
    text = re.sub(r"\s+", " ", text)

    return text.strip()


def format_transcript_with_timestamps(segments: list[dict], interval_seconds: int = 30) -> str:
    """Format transcript with timestamps at regular intervals.

    Groups segments into chunks to reduce character bloat while still
    providing timestamp context for the LLM. This is more efficient than
    per-segment timestamps which can bloat the text by 2-3x.

    Args:
        segments: List of transcript segments with 'text' and 'start' keys
        interval_seconds: Group segments into this interval (default 30s)

    Returns:
        Formatted string like:
        [0:00] Hello everyone, welcome to the video. Today we're going to talk about...
        [0:30] The first concept is dependency injection. It's a design pattern...
        [1:00] Let me show you an example of how this works in practice.
    """
    if not segments:
        return ""

    lines = []
    current_interval = -1
    current_texts = []

    for segment in segments:
        start_seconds = int(segment.get("start", 0))
        interval = start_seconds // interval_seconds

        if interval != current_interval:
            # Flush previous interval
            if current_texts:
                interval_start = current_interval * interval_seconds
                mins = interval_start // 60
                secs = interval_start % 60
                timestamp = f"[{mins}:{secs:02d}]"
                lines.append(f"{timestamp} {' '.join(current_texts)}")
            current_texts = []
            current_interval = interval

        text = segment.get("text", "").strip()
        if text:
            current_texts.append(text)

    # Flush final interval
    if current_texts:
        interval_start = current_interval * interval_seconds
        mins = interval_start // 60
        secs = interval_start % 60
        timestamp = f"[{mins}:{secs:02d}]"
        lines.append(f"{timestamp} {' '.join(current_texts)}")

    return "\n".join(lines)


def normalize_segments(
    segments: list[dict],
    source: TranscriptSource,
) -> list[TranscriptSegment]:
    """
    Convert any segment format to normalized milliseconds.

    Handles different input formats:
    - Browser: already has startMs/endMs (milliseconds)
    - yt-dlp/API: start (seconds) + duration (seconds)
    - Whisper: start (seconds) + end (seconds)

    Args:
        segments: Raw segments in any format
        source: Source of the transcript for format detection

    Returns:
        List of normalized TranscriptSegment objects
    """
    normalized = []
    for seg in segments:
        # Handle different input formats
        if "startMs" in seg:
            # Already normalized (Whisper format)
            normalized.append(TranscriptSegment(
                text=seg["text"],
                startMs=int(seg["startMs"]),
                endMs=int(seg["endMs"]),
            ))
        elif "end" in seg:
            # Whisper format: start + end (seconds)
            normalized.append(TranscriptSegment(
                text=seg["text"],
                startMs=int(seg["start"] * 1000),
                endMs=int(seg["end"] * 1000),
            ))
        else:
            # youtube-transcript-api / yt-dlp format: start + duration (seconds)
            start_s = seg.get("start", 0)
            duration_s = seg.get("duration", 0)
            normalized.append(TranscriptSegment(
                text=seg["text"],
                startMs=int(start_s * 1000),
                endMs=int((start_s + duration_s) * 1000),
            ))
    return normalized


async def get_transcript(video_id: str) -> tuple[list[dict], str, str]:
    """
    Fetch transcript from YouTube (async wrapper).

    Runs the blocking YouTube API call in a thread pool to avoid
    blocking the event loop.

    Args:
        video_id: YouTube video ID

    Returns:
        (segments, full_text, transcript_type)

    Raises:
        TranscriptError: If transcript cannot be fetched
    """
    return await asyncio.to_thread(_fetch_transcript_sync, video_id)


async def get_normalized_transcript(video_id: str) -> NormalizedTranscript:
    """
    Fetch and normalize transcript from YouTube.

    This is the main entry point for transcript fetching with full
    fallback chain: direct API -> proxy -> (future: Whisper)

    Args:
        video_id: YouTube video ID

    Returns:
        NormalizedTranscript with unified format

    Raises:
        TranscriptError: If transcript cannot be fetched
    """
    segments, full_text, transcript_type = await get_transcript(video_id)

    # Determine source based on transcript_type
    source: TranscriptSource = "api"
    if transcript_type == "yt-dlp":
        source = "ytdlp"
    elif settings.WEBSHARE_PROXY_USERNAME:
        source = "proxy"

    # Normalize segments to milliseconds
    normalized_segments = normalize_segments(segments, source)

    return NormalizedTranscript(
        text=full_text,
        segments=normalized_segments,
        source=source,
    )
