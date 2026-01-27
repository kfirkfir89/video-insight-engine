"""Whisper audio transcription fallback for videos without captions.

This is the nuclear option - used only when:
1. No captions exist on YouTube
2. All other transcript methods have failed

Cost: ~$0.006 per minute of audio via OpenAI Whisper API
"""

import asyncio
import logging
import tempfile
from pathlib import Path

import yt_dlp
from openai import OpenAI

from src.config import settings
from src.models.schemas import (
    TranscriptSegment,
    NormalizedTranscript,
    ErrorCode,
)
from src.exceptions import TranscriptError

logger = logging.getLogger(__name__)

# Temp directory for audio files
TEMP_DIR = Path(tempfile.gettempdir()) / "vie-whisper"

# Maximum audio size for Whisper API (25MB)
MAX_AUDIO_SIZE_MB = 25


def _download_audio_sync(video_id: str) -> Path:
    """
    Download audio from YouTube using yt-dlp.

    Args:
        video_id: YouTube video ID

    Returns:
        Path to downloaded MP3 file

    Raises:
        TranscriptError: If download fails
    """
    TEMP_DIR.mkdir(exist_ok=True)
    output_path = TEMP_DIR / f"{video_id}.%(ext)s"

    ydl_opts = {
        "format": "bestaudio/best",
        "postprocessors": [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": "mp3",
                "preferredquality": "128",
            }
        ],
        "outtmpl": str(output_path),
        "quiet": True,
        "no_warnings": True,
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([f"https://www.youtube.com/watch?v={video_id}"])
    except Exception as e:
        logger.error(f"Failed to download audio for {video_id}: {e}")
        raise TranscriptError(
            f"Failed to download audio: {str(e)}",
            ErrorCode.VIDEO_UNAVAILABLE,
        )

    mp3_path = TEMP_DIR / f"{video_id}.mp3"
    if not mp3_path.exists():
        raise TranscriptError(
            "Audio download completed but file not found",
            ErrorCode.UNKNOWN_ERROR,
        )

    # Check file size
    file_size_mb = mp3_path.stat().st_size / (1024 * 1024)
    if file_size_mb > MAX_AUDIO_SIZE_MB:
        mp3_path.unlink()
        raise TranscriptError(
            f"Audio file too large ({file_size_mb:.1f}MB > {MAX_AUDIO_SIZE_MB}MB)",
            ErrorCode.VIDEO_TOO_LONG,
        )

    logger.info(f"Downloaded audio: {mp3_path} ({file_size_mb:.1f}MB)")
    return mp3_path


def _transcribe_sync(audio_path: Path) -> dict:
    """
    Transcribe audio using OpenAI Whisper API.

    Args:
        audio_path: Path to audio file

    Returns:
        Transcription response with text and optional segments

    Raises:
        TranscriptError: If transcription fails
    """
    if not settings.OPENAI_API_KEY:
        raise TranscriptError(
            "OpenAI API key not configured for Whisper",
            ErrorCode.UNKNOWN_ERROR,
        )

    client = OpenAI(api_key=settings.OPENAI_API_KEY)

    try:
        with open(audio_path, "rb") as f:
            # Use verbose_json to get word-level timestamps
            response = client.audio.transcriptions.create(
                model="whisper-1",
                file=f,
                response_format="verbose_json",
                timestamp_granularities=["segment"],
            )

        logger.info(f"Whisper transcription complete: {len(response.text)} chars")
        return {
            "text": response.text,
            "segments": response.segments if hasattr(response, "segments") else [],
        }
    except Exception as e:
        logger.error(f"Whisper transcription failed: {e}")
        raise TranscriptError(
            f"Whisper transcription failed: {str(e)}",
            ErrorCode.UNKNOWN_ERROR,
        )


def _create_estimated_segments(text: str) -> list[TranscriptSegment]:
    """
    Create estimated segments when Whisper doesn't return timing info.

    Estimates ~2.5 words per second for natural speech.

    Args:
        text: Full transcript text

    Returns:
        List of TranscriptSegment with estimated timestamps
    """
    words = text.split()
    segments = []
    words_per_segment = 30  # ~12 seconds of speech
    words_per_second = 2.5

    for i in range(0, len(words), words_per_segment):
        chunk = " ".join(words[i : i + words_per_segment])
        start_ms = int((i / words_per_second) * 1000)
        end_ms = int(((i + words_per_segment) / words_per_second) * 1000)
        segments.append(
            TranscriptSegment(
                text=chunk,
                startMs=start_ms,
                endMs=end_ms,
            )
        )

    return segments


async def transcribe_with_whisper(video_id: str) -> NormalizedTranscript:
    """
    Full async workflow: download audio → transcribe → normalize.

    This is the main entry point for Whisper fallback.

    Args:
        video_id: YouTube video ID

    Returns:
        NormalizedTranscript with source="whisper"

    Raises:
        TranscriptError: If any step fails
    """
    audio_path: Path | None = None

    try:
        logger.info(f"Starting Whisper fallback for {video_id}")

        # Download audio (blocking, run in thread)
        audio_path = await asyncio.to_thread(_download_audio_sync, video_id)

        # Transcribe (blocking, run in thread)
        result = await asyncio.to_thread(_transcribe_sync, audio_path)

        # Build normalized segments
        if result.get("segments"):
            # Whisper returned segment data
            segments = [
                TranscriptSegment(
                    text=seg.get("text", "").strip(),
                    startMs=int(seg.get("start", 0) * 1000),
                    endMs=int(seg.get("end", 0) * 1000),
                )
                for seg in result["segments"]
                if seg.get("text", "").strip()
            ]
        else:
            # Fallback to estimated segments
            logger.warning("Whisper didn't return segments, using estimates")
            segments = _create_estimated_segments(result["text"])

        logger.info(
            f"Whisper fallback complete: {len(result['text'])} chars, {len(segments)} segments"
        )

        return NormalizedTranscript(
            text=result["text"],
            segments=segments,
            source="whisper",
        )

    finally:
        # Always cleanup audio file
        if audio_path and audio_path.exists():
            try:
                audio_path.unlink()
                logger.debug(f"Cleaned up audio file: {audio_path}")
            except Exception as e:
                logger.warning(f"Failed to cleanup audio file: {e}")
