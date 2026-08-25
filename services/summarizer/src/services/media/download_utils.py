"""Shared YouTube audio download utilities.

Common retry logic and error classification used by both
Gemini and Whisper transcription services.
"""

import logging
import time
from pathlib import Path
from typing import Any

import yt_dlp

from src.config import settings
from src.exceptions import TranscriptError
from src.models.schemas import ErrorCode

__all__ = [
    "classify_download_error",
    "download_youtube_audio",
    "ytdlp_client_api_opts",
    "ytdlp_client_cli_args",
    "MAX_DOWNLOAD_ATTEMPTS",
]

logger = logging.getLogger(__name__)


def ytdlp_client_cli_args() -> list[str]:
    """--extractor-args flags for subprocess yt-dlp DOWNLOAD invocations.

    YouTube 403s some player clients' download URLs per environment
    (2026-08: web blocked here, android fine) — YTDLP_PLAYER_CLIENTS picks
    the client order without a code change when YouTube shifts again.
    """
    clients = settings.YTDLP_PLAYER_CLIENTS.strip()
    if not clients:
        return []
    return ["--extractor-args", f"youtube:player_client={clients}"]


def ytdlp_client_api_opts() -> dict[str, Any]:
    """Python-API form of ytdlp_client_cli_args for YoutubeDL opts dicts."""
    clients = [c.strip() for c in settings.YTDLP_PLAYER_CLIENTS.split(",") if c.strip()]
    if not clients:
        return {}
    return {"extractor_args": {"youtube": {"player_client": clients}}}


_UNAVAILABLE_PATTERNS = (
    "private video",
    "removed",
    "unavailable",
    "sign in",
    "not available",
)

MAX_DOWNLOAD_ATTEMPTS = 3


def classify_download_error(error_msg: str) -> ErrorCode:
    """Classify a yt-dlp error as VIDEO_UNAVAILABLE or DOWNLOAD_ERROR."""
    msg_lower = error_msg.lower()
    if any(p in msg_lower for p in _UNAVAILABLE_PATTERNS):
        return ErrorCode.VIDEO_UNAVAILABLE
    return ErrorCode.DOWNLOAD_ERROR


def download_youtube_audio(
    video_id: str,
    ydl_opts: dict[str, Any],
    temp_dir: Path,
    file_stem: str,
    max_attempts: int = MAX_DOWNLOAD_ATTEMPTS,
) -> None:
    """Download YouTube audio with retry and exponential backoff.

    **Blocking** — uses ``time.sleep`` between retries. Must be called
    via ``asyncio.to_thread()`` from async contexts to avoid blocking
    the event loop.

    Cleans up stale .part files between attempts and classifies errors
    on final failure.

    Args:
        video_id: YouTube video ID
        ydl_opts: yt-dlp options dict (format, postprocessors, etc.)
        temp_dir: Directory for temporary download files
        file_stem: Base filename stem (used to find .part files)
        max_attempts: Maximum download attempts

    Raises:
        TranscriptError: If download fails after all retries
    """
    url = f"https://www.youtube.com/watch?v={video_id}"
    # Route the download through the configured player clients unless the
    # caller already chose its own.
    if "extractor_args" not in ydl_opts:
        ydl_opts = {**ydl_opts, **ytdlp_client_api_opts()}
    last_error: Exception | None = None

    for attempt in range(1, max_attempts + 1):
        for stale in temp_dir.glob(f"{file_stem}.*.part"):
            try:
                stale.unlink()
            except OSError:
                pass
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([url])
            last_error = None
            break
        except Exception as e:
            last_error = e
            if attempt < max_attempts:
                logger.warning(
                    "Download attempt %s/%s failed for %s: %s",
                    attempt,
                    max_attempts,
                    video_id,
                    e,
                )
                time.sleep(2**attempt)

    if last_error is not None:
        error_msg = str(last_error)
        error_code = classify_download_error(error_msg)
        logger.error("Failed to download audio for %s: %s", video_id, last_error)
        raise TranscriptError(
            f"Failed to download audio: {error_msg}",
            error_code,
        )
