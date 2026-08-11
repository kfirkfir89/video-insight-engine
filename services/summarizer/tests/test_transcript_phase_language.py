"""Regression test for transcript-phase source-language detection.

The pipeline is English-canonical: ``ctx.language`` always stays ``"en"`` (all
generation runs in English) and the DETECTED original language is recorded on
``ctx.source_language_code`` to drive the final English→source translation pass.

Bug guarded: a transcript source that returns no language (the Gemini fallback)
must still have its language detected from content, so a non-English video gets
a sourceLanguage block + FE toggle instead of being silently treated as English.
"""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from src.services.pipeline.pipeline_helpers import TranscriptData
from src.services.pipeline.phases import transcript as transcript_phase

HEBREW_TEXT = (
    "שלום וברוכים הבאים לשידור המחזק. היום נדבר על כוח הבחירה החופשית "
    "ועל החשיבות של פתיחת הלב, התפילה והאמונה בדרך אל הגאולה."
)


async def _drain(gen) -> None:
    async for _ in gen:
        pass


def _build_ctx() -> SimpleNamespace:
    """Minimal PipelineContext stand-in for run_phase_transcript."""
    video_data = SimpleNamespace(
        context=SimpleNamespace(category="education"),
        duration=3465,
    )
    return SimpleNamespace(
        youtube_id="vid123",
        video_data=video_data,
        language="en",       # stays English (English-canonical generation)
        is_rtl=False,
        source_language_code=None,
        clean_text=None,
        transcript_data=None,
    )


class TestTranscriptPhaseLanguageNet:
    async def test_detects_language_when_source_omits_it(self):
        """A languageless Hebrew transcript records source_language_code='he'."""
        ctx = _build_ctx()

        def fake_fetch(*_args, **_kwargs):
            async def _gen():
                yield TranscriptData(
                    segments=[{"text": HEBREW_TEXT, "start": 0, "duration": 5}],
                    raw_text=HEBREW_TEXT,
                    transcript_type="gemini",
                    source="gemini",
                    language=None,  # the Gemini-fallback signature
                )
            return _gen()

        with patch.object(transcript_phase, "fetch_transcript", fake_fetch), \
             patch.object(transcript_phase.settings, "TRANSCRIPT_CLEANING_ENABLED", False), \
             patch.object(
                 transcript_phase, "get_sponsor_segments", new=AsyncMock(return_value=[])
             ):
            await _drain(transcript_phase.run_phase_transcript(ctx))

        assert ctx.source_language_code == "he"
        assert ctx.language == "en"  # generation stays English
        assert ctx.is_rtl is False

    async def test_respects_explicit_source_language(self):
        """An explicit source language is recorded verbatim on source_language_code."""
        ctx = _build_ctx()

        def fake_fetch(*_args, **_kwargs):
            async def _gen():
                yield TranscriptData(
                    segments=[{"text": "hello world", "start": 0, "duration": 5}],
                    raw_text="hello world this is plainly english content here",
                    transcript_type="whisper",
                    source="whisper",
                    language="ar",
                )
            return _gen()

        with patch.object(transcript_phase, "fetch_transcript", fake_fetch), \
             patch.object(transcript_phase.settings, "TRANSCRIPT_CLEANING_ENABLED", False), \
             patch.object(
                 transcript_phase, "get_sponsor_segments", new=AsyncMock(return_value=[])
             ):
            await _drain(transcript_phase.run_phase_transcript(ctx))

        assert ctx.source_language_code == "ar"
        assert ctx.language == "en"
