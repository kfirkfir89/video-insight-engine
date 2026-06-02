"""Regression tests for the transcript fallback chain language signal.

Bug: a fully-Hebrew video whose captions 429'd and whose Whisper run timed out
fell to the Gemini fallback, which built ``TranscriptData`` with no language.
The pipeline then defaulted to ``en``, skipped translation, and hid the FE
language toggle. The fix detects language from the Gemini transcript text.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

from src.models.schemas import NormalizedTranscript
from src.services.transcription import transcript_fetcher
from src.services.transcription.transcript_fetcher import _try_gemini_transcription

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
