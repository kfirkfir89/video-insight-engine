"""Whisper audio transcription fallback for videos without captions.

This is the nuclear option - used only when:
1. No captions exist on YouTube
2. All other transcript methods have failed

Cost: ~$0.006 per minute of audio via OpenAI Whisper API
"""

import asyncio
import logging
import tempfile
import uuid
from pathlib import Path

from openai import OpenAI
from pydub import AudioSegment

from src.config import settings
from src.models.schemas import (
    TranscriptSegment,
    NormalizedTranscript,
    ErrorCode,
)
from src.exceptions import TranscriptError
from src.services.media.download_utils import download_youtube_audio

logger = logging.getLogger(__name__)

# Temp directory for audio files
TEMP_DIR = Path(tempfile.gettempdir()) / "vie-whisper"

# Target chunk size in MB (under Whisper API 25MB limit)
CHUNK_TARGET_SIZE_MB = 24


def _download_audio_sync(video_id: str) -> Path:
    """
    Download audio from YouTube using yt-dlp.

    Retries transient failures with exponential backoff. yt-dlp is also
    configured to retry internally on fragment/HTTP errors.

    Args:
        video_id: YouTube video ID

    Returns:
        Path to downloaded MP3 file

    Raises:
        TranscriptError: If download fails after all retries
    """
    TEMP_DIR.mkdir(exist_ok=True)
    # Unique suffix prevents race conditions when concurrent requests
    # download the same video (multiple tabs, API retries)
    download_id = uuid.uuid4().hex[:8]
    file_stem = f"{video_id}_{download_id}"
    output_path = TEMP_DIR / f"{file_stem}.%(ext)s"

    ydl_opts = {
        "format": "bestaudio",
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
        "noprogress": True,
        # Network resilience
        "retries": 3,
        "fragment_retries": 5,
        "socket_timeout": 30,
        "continuedl": False,
    }

    download_youtube_audio(video_id, ydl_opts, TEMP_DIR, file_stem)

    mp3_path = TEMP_DIR / f"{file_stem}.mp3"
    if not mp3_path.exists():
        raise TranscriptError(
            "Audio download completed but file not found",
            ErrorCode.UNKNOWN_ERROR,
        )

    file_size_mb = mp3_path.stat().st_size / (1024 * 1024)
    logger.info("Downloaded audio: %s (%.1fMB)", mp3_path, file_size_mb)
    return mp3_path


def _transcribe_sync(
    audio_path: Path,
    is_music: bool = False,
    client: OpenAI | None = None,
) -> dict:
    """
    Transcribe audio using OpenAI Whisper API.

    Args:
        audio_path: Path to audio file
        is_music: If True, provide a lyrics-focused prompt hint
        client: Optional pre-initialized OpenAI client (reused across chunks)

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

    if client is None:
        client = OpenAI(api_key=settings.OPENAI_API_KEY)

    try:
        with open(audio_path, "rb") as f:
            # Use verbose_json to get word-level timestamps
            # Whisper's prompt parameter guides transcription style
            whisper_kwargs: dict = {
                "model": "whisper-1",
                "file": f,
                "response_format": "verbose_json",
                "timestamp_granularities": ["segment"],
            }
            if is_music:
                whisper_kwargs["prompt"] = (
                    "Transcribe all lyrics and singing accurately. "
                    "Include all vocal content."
                )
            response = client.audio.transcriptions.create(**whisper_kwargs)

        logger.info("Whisper transcription complete: %d chars", len(response.text))
        # Convert Pydantic TranscriptionSegment objects to plain dicts
        # so downstream code can use .get() safely
        raw_segments = response.segments if hasattr(response, "segments") else []
        segments = [
            {
                "text": getattr(seg, "text", ""),
                "start": getattr(seg, "start", 0),
                "end": getattr(seg, "end", 0),
            }
            for seg in (raw_segments or [])
        ]
        return {
            "text": response.text,
            "segments": segments,
        }
    except Exception as e:
        logger.error("Whisper transcription failed: %s", e)
        raise TranscriptError(
            f"Whisper transcription failed: {str(e)}",
            ErrorCode.UNKNOWN_ERROR,
        )


def _split_audio_chunks(audio_path: Path) -> list[tuple[Path, int]]:
    """
    Split a large audio file into chunks under the Whisper API size limit.

    Uses pydub to load the MP3, calculates chunk duration from the file's
    bitrate and target size, then exports each chunk as a separate MP3.

    Args:
        audio_path: Path to the original MP3 file

    Returns:
        List of (chunk_path, offset_ms) tuples
    """
    audio = AudioSegment.from_mp3(audio_path)
    file_size_bytes = audio_path.stat().st_size
    duration_ms = len(audio)

    if duration_ms == 0:
        raise TranscriptError(
            "Audio file has zero duration",
            ErrorCode.UNKNOWN_ERROR,
        )

    bytes_per_ms = file_size_bytes / duration_ms
    chunk_duration_ms = int((CHUNK_TARGET_SIZE_MB * 1024 * 1024) / bytes_per_ms)

    chunks: list[tuple[Path, int]] = []
    stem = audio_path.stem
    parent = audio_path.parent

    for i, offset_ms in enumerate(range(0, duration_ms, chunk_duration_ms)):
        end_ms = min(offset_ms + chunk_duration_ms, duration_ms)
        chunk = audio[offset_ms:end_ms]
        chunk_path = parent / f"{stem}_chunk_{i}.mp3"
        chunk.export(str(chunk_path), format="mp3")
        chunks.append((chunk_path, offset_ms))

    logger.info(
        "Split %s into %d chunks (%.0fs each)",
        audio_path.name, len(chunks), chunk_duration_ms / 1000,
    )
    return chunks


def _transcribe_chunked_sync(
    chunks: list[tuple[Path, int]],
    is_music: bool = False,
) -> dict:
    """
    Transcribe multiple audio chunks and merge results.

    Calls _transcribe_sync for each chunk sequentially, then merges
    text (space-joined) and segments (timestamps adjusted by chunk offset).

    Args:
        chunks: List of (chunk_path, offset_ms) from _split_audio_chunks
        is_music: If True, provide a lyrics-focused prompt hint per chunk

    Returns:
        Combined {"text": ..., "segments": [...]} matching single-file shape
    """
    all_text: list[str] = []
    all_segments: list[dict] = []
    client = OpenAI(api_key=settings.OPENAI_API_KEY)

    for chunk_path, offset_ms in chunks:
        result = _transcribe_sync(chunk_path, is_music=is_music, client=client)
        all_text.append(result["text"])

        offset_sec = offset_ms / 1000.0
        for seg in result.get("segments", []):
            all_segments.append({
                "text": seg.get("text", ""),
                "start": seg.get("start", 0) + offset_sec,
                "end": seg.get("end", 0) + offset_sec,
            })

    return {
        "text": " ".join(all_text),
        "segments": all_segments,
    }


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


async def transcribe_with_whisper(
    video_id: str,
    is_music: bool = False,
) -> NormalizedTranscript:
    """
    Full async workflow: download audio → transcribe → normalize.

    This is the main entry point for Whisper fallback. Files larger than
    CHUNK_TARGET_SIZE_MB are split into chunks before transcription.

    Args:
        video_id: YouTube video ID
        is_music: If True, provide a lyrics-focused prompt hint

    Returns:
        NormalizedTranscript with source="whisper"

    Raises:
        TranscriptError: If any step fails
    """
    audio_path: Path | None = None
    chunk_paths: list[Path] = []

    try:
        logger.info("Starting Whisper fallback for %s", video_id)

        # Download audio (blocking, run in thread)
        audio_path = await asyncio.to_thread(_download_audio_sync, video_id)

        # Check if chunking is needed
        file_size_mb = audio_path.stat().st_size / (1024 * 1024)

        if file_size_mb > CHUNK_TARGET_SIZE_MB:
            logger.info(
                "Audio %.1fMB exceeds %dMB, chunking",
                file_size_mb, CHUNK_TARGET_SIZE_MB,
            )
            try:
                chunks = await asyncio.to_thread(_split_audio_chunks, audio_path)
            except Exception as e:
                logger.error("Audio chunking failed for %s: %s", video_id, e)
                raise TranscriptError(
                    f"Audio chunking failed: {e}",
                    ErrorCode.UNKNOWN_ERROR,
                )
            chunk_paths = [path for path, _ in chunks]
            result = await asyncio.to_thread(_transcribe_chunked_sync, chunks, is_music)
        else:
            result = await asyncio.to_thread(_transcribe_sync, audio_path, is_music)

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
            "Whisper fallback complete: %d chars, %d segments",
            len(result["text"]), len(segments),
        )

        return NormalizedTranscript(
            text=result["text"],
            segments=segments,
            source="whisper",
        )

    finally:
        # Cleanup original audio file
        if audio_path and audio_path.exists():
            try:
                audio_path.unlink()
                logger.debug("Cleaned up audio file: %s", audio_path)
            except Exception as e:
                logger.warning("Failed to cleanup audio file: %s", e)
        # Cleanup chunk files
        for chunk_path in chunk_paths:
            if chunk_path.exists():
                try:
                    chunk_path.unlink()
                    logger.debug("Cleaned up chunk file: %s", chunk_path)
                except Exception as e:
                    logger.warning("Failed to cleanup chunk file: %s", e)
