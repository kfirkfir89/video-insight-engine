"""Regression tests for the transcript fallback chain language signal.

Bug: a fully-Hebrew video whose captions 429'd and whose Whisper run timed out
fell to the Gemini fallback, which built ``TranscriptData`` with no language.
The pipeline then defaulted to ``en``, skipped translation, and hid the FE
language toggle. The fix detects language from the Gemini transcript text.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.exceptions import TranscriptError
from src.models.schemas import ErrorCode, NormalizedTranscript
from src.services.pipeline.pipeline_helpers import TranscriptData
from src.services.transcription import transcript_fetcher
from src.services.transcription.transcript_fetcher import (
    _try_gemini_transcription,
    fetch_transcript,
)

HEBREW_TEXT = (
    "שלום וברוכים הבאים לשידור המחזק. היום נדבר על כוח הבחירה החופשית "
    "ועל החשיבות של פתיחת הלב, התפילה והאמונה בדרך אל הגאולה."
)


class TestGeminiLanguageDetection:
    """Gemini transcription must carry a detected language, not None."""

    async def test_detects_hebrew_from_gemini_transcript(self):
        """A Hebrew Gemini transcript yields TranscriptData.language == 'he'."""
        gemini_result = NormalizedTranscript(
            text=HEBREW_TEXT,
            segments=[],
            source="gemini",
        )

        with patch.object(transcript_fetcher.settings, "GEMINI_API_KEY", "fake-key"), \
             patch.object(
                 transcript_fetcher,
                 "transcribe_with_gemini",
                 new=AsyncMock(return_value=gemini_result),
             ):
            result = await _try_gemini_transcription("vid123", duration=3465, is_music=False)

        assert result is not None
        assert result.source == "gemini"
        assert result.language == "he"

    async def test_no_api_key_returns_none(self):
        """Without a Gemini key the helper short-circuits to None."""
        with patch.object(transcript_fetcher.settings, "GEMINI_API_KEY", ""):
            result = await _try_gemini_transcription("vid123", duration=100, is_music=False)

        assert result is None


def _video_data_without_captions() -> MagicMock:
    """A VideoData stand-in with no yt-dlp subtitles, forcing the API branch."""
    video_data = MagicMock()
    video_data.subtitles = []
    return video_data


async def _drain(gen) -> list:
    """Collect every item yielded by an async generator."""
    return [item async for item in gen]


class TestAudioFallbackOnCaptionError:
    """Caption-fetch errors fall back to audio transcription unless the video itself is inaccessible."""

    async def _run(
        self,
        caption_error: TranscriptError,
        whisper: AsyncMock,
        duration: int = 300,
        max_minutes: int = 600,
    ) -> list:
        whisper_data = TranscriptData(
            segments=[{"text": "hi", "start": 0.0, "duration": 1.0}],
            raw_text="hi",
            transcript_type="whisper",
            source="whisper",
            language="he",
        )
        whisper.return_value = (whisper_data, None)
        with patch.object(transcript_fetcher.S3Client, "is_available", return_value=False), \
             patch.object(transcript_fetcher.settings, "WHISPER_ENABLED", True), \
             patch.object(transcript_fetcher.settings, "WHISPER_MAX_DURATION_MINUTES", max_minutes), \
             patch.object(transcript_fetcher, "get_transcript", new=AsyncMock(side_effect=caption_error)), \
             patch.object(transcript_fetcher, "_try_whisper_transcription", new=whisper):
            return await _drain(
                fetch_transcript("vid123", _video_data_without_captions(), duration=duration)
            )

    async def test_should_fall_back_to_whisper_when_captions_rate_limited(self):
        """A 429 rate-limit on captions must still attempt audio transcription."""
        whisper = AsyncMock()
        items = await self._run(
            TranscriptError("rate limited", ErrorCode.RATE_LIMITED), whisper
        )

        whisper.assert_awaited_once()
        assert any(isinstance(i, TranscriptData) and i.source == "whisper" for i in items)

    async def test_should_fall_back_to_whisper_on_unknown_caption_error(self):
        """A generic caption-fetch failure must still attempt audio transcription."""
        whisper = AsyncMock()
        items = await self._run(
            TranscriptError("boom", ErrorCode.UNKNOWN_ERROR), whisper
        )

        whisper.assert_awaited_once()
        assert any(isinstance(i, TranscriptData) and i.source == "whisper" for i in items)

    async def test_should_not_attempt_whisper_when_video_unavailable(self):
        """A genuine video-access failure must propagate without trying audio."""
        whisper = AsyncMock()
        with pytest.raises(TranscriptError) as exc_info:
            await self._run(
                TranscriptError("private", ErrorCode.VIDEO_UNAVAILABLE), whisper
            )

        assert exc_info.value.code == ErrorCode.VIDEO_UNAVAILABLE
        whisper.assert_not_awaited()

    async def test_should_not_attempt_whisper_when_video_too_long(self):
        """The duration cap still wins even for a fall-back-eligible caption error."""
        whisper = AsyncMock()
        with pytest.raises(TranscriptError) as exc_info:
            await self._run(
                TranscriptError("rate limited", ErrorCode.RATE_LIMITED),
                whisper,
                duration=60 * 60,
                max_minutes=10,
            )

        assert exc_info.value.code == ErrorCode.RATE_LIMITED
        whisper.assert_not_awaited()
