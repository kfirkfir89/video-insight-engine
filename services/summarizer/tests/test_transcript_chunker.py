"""Tests for transcript_chunker — chapter splitting with fallback chain."""

import pytest
from unittest.mock import AsyncMock, patch

from src.services.transcription.transcript_chunker import (
    ChapterChunk,
    _from_youtube_chapters,
    _time_split_chapters,
    split_transcript_into_chapters,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

def _make_segments(duration_seconds: int, words_per_second: float = 2.5) -> list[dict]:
    """Create mock transcript segments spanning the given duration."""
    segments = []
    interval_ms = 5000  # 5-second segments
    for start_ms in range(0, duration_seconds * 1000, interval_ms):
        end_ms = min(start_ms + interval_ms, duration_seconds * 1000)
        word_count = int(words_per_second * (interval_ms / 1000))
        text = " ".join(f"word{i}" for i in range(word_count))
        segments.append({
            "text": text,
            "startMs": start_ms,
            "endMs": end_ms,
        })
    return segments


def _make_youtube_chapters(count: int, duration: float) -> list[dict]:
    """Create mock YouTube chapters evenly distributed."""
    chapter_duration = duration / count
    return [
        {
            "title": f"Chapter {i + 1}",
            "start_time": i * chapter_duration,
            "end_time": (i + 1) * chapter_duration,
        }
        for i in range(count)
    ]


# ---------------------------------------------------------------------------
# YouTube chapters path
# ---------------------------------------------------------------------------

class TestFromYouTubeChapters:
    def test_converts_youtube_chapters_to_chunks(self):
        duration = 2700  # 45 min
        segments = _make_segments(duration)
        chapters = _make_youtube_chapters(6, duration)

        result = _from_youtube_chapters(chapters, segments, duration)

        assert result is not None
        assert len(result) == 6
        assert all(ch.source == "youtube" for ch in result)
        assert result[0].title == "Chapter 1"
        assert result[0].start_seconds == 0
        assert result[0].index == 0
        assert result[-1].end_seconds == duration

    def test_returns_none_for_single_chapter(self):
        duration = 2700
        segments = _make_segments(duration)
        chapters = [{"title": "Only One", "start_time": 0, "end_time": duration}]

        result = _from_youtube_chapters(chapters, segments, duration)

        assert result is None

    def test_returns_none_for_empty_chapters(self):
        result = _from_youtube_chapters([], [], 2700)
        assert result is None

    def test_skips_chapters_with_no_text(self):
        # Segments only cover first 100 seconds
        segments = _make_segments(100)
        chapters = [
            {"title": "Has text", "start_time": 0, "end_time": 50},
            {"title": "Has text too", "start_time": 50, "end_time": 100},
            {"title": "No text", "start_time": 500, "end_time": 600},
        ]

        result = _from_youtube_chapters(chapters, segments, 600)

        assert result is not None
        assert len(result) == 2

    def test_token_estimate_is_positive(self):
        duration = 2700
        segments = _make_segments(duration)
        chapters = _make_youtube_chapters(4, duration)

        result = _from_youtube_chapters(chapters, segments, duration)

        assert result is not None
        for ch in result:
            assert ch.token_estimate > 0


# ---------------------------------------------------------------------------
# Time-based splitting
# ---------------------------------------------------------------------------

class TestTimeSplitChapters:
    def test_splits_45min_video_into_chunks(self):
        duration = 2700  # 45 min
        segments = _make_segments(duration)

        result = _time_split_chapters(duration, segments)

        assert len(result) >= 2
        assert all(ch.source == "time_split" for ch in result)
        assert result[0].start_seconds == 0
        # All titled "Part N"
        assert result[0].title == "Part 1"
        assert result[-1].title == f"Part {len(result)}"

    def test_splits_3hour_video(self):
        duration = 10800  # 3 hours
        segments = _make_segments(duration)

        result = _time_split_chapters(duration, segments, target_minutes=5)

        # ~36 chunks of 5 min each
        assert len(result) >= 30
        assert len(result) <= 40

    def test_short_video_gets_minimum_2_chunks(self):
        duration = 300  # 5 min
        segments = _make_segments(duration)

        result = _time_split_chapters(duration, segments, target_minutes=5)

        assert len(result) >= 2

    def test_returns_empty_for_no_segments(self):
        result = _time_split_chapters(2700, [])
        assert len(result) == 0

    def test_custom_target_minutes(self):
        duration = 3600  # 1 hour
        segments = _make_segments(duration)

        result = _time_split_chapters(duration, segments, target_minutes=10)

        # ~6 chunks of 10 min
        assert 4 <= len(result) <= 8


# ---------------------------------------------------------------------------
# Main orchestrator
# ---------------------------------------------------------------------------

class TestSplitTranscriptIntoChapters:
    @pytest.mark.asyncio
    async def test_uses_youtube_chapters_when_available(self):
        duration = 2700
        segments = _make_segments(duration)
        video_data = {
            "duration": duration,
            "chapters": _make_youtube_chapters(6, duration),
        }

        result = await split_transcript_into_chapters(video_data, segments, "full transcript")

        assert len(result) == 6
        assert all(ch.source == "youtube" for ch in result)

    @pytest.mark.asyncio
    async def test_falls_back_to_time_split_when_no_chapters(self):
        duration = 2700
        segments = _make_segments(duration)
        video_data = {"duration": duration}

        result = await split_transcript_into_chapters(video_data, segments, "full transcript")

        assert len(result) >= 2
        assert all(ch.source == "time_split" for ch in result)

    @pytest.mark.asyncio
    async def test_falls_back_to_single_chunk_when_no_duration(self):
        video_data = {"duration": 0}

        result = await split_transcript_into_chapters(video_data, [], "full transcript text")

        assert len(result) == 1
        assert result[0].source == "full"
        assert result[0].text == "full transcript text"

    @pytest.mark.asyncio
    async def test_ai_detection_path(self):
        duration = 2700
        segments = _make_segments(duration)
        video_data = {"duration": duration, "title": "Test Video"}

        mock_llm = AsyncMock()
        mock_llm.model = "anthropic/claude-sonnet-4-6"
        mock_llm.fast_model = "anthropic/claude-haiku-4-5-20251001"

        ai_json = '[{"title":"Intro","startSeconds":0,"endSeconds":900},{"title":"Main","startSeconds":900,"endSeconds":1800},{"title":"Conclusion","startSeconds":1800,"endSeconds":2700}]'

        with patch(
            "src.services.transcription.transcript_chunker._detect_chapters_with_ai",
            new_callable=AsyncMock,
        ) as mock_detect:
            from src.services.transcription.transcript_chunker import ChapterChunk as CC, _time_split_chapters
            # Build the expected result from AI detection
            mock_detect.return_value = [
                CC(0, "Intro", 0, 900, " ".join(s["text"] for s in segments if s["startMs"] < 900000), "ai_detected", 5000),
                CC(1, "Main", 900, 1800, " ".join(s["text"] for s in segments if 900000 <= s["startMs"] < 1800000), "ai_detected", 5000),
                CC(2, "Conclusion", 1800, 2700, " ".join(s["text"] for s in segments if s["startMs"] >= 1800000), "ai_detected", 5000),
            ]
            result = await split_transcript_into_chapters(
                video_data, segments, "full transcript", llm_service=mock_llm,
            )

        assert len(result) == 3
        assert all(ch.source == "ai_detected" for ch in result)

    @pytest.mark.asyncio
    async def test_ai_detection_failure_falls_back_to_time_split(self):
        duration = 2700
        segments = _make_segments(duration)
        video_data = {"duration": duration, "title": "Test Video"}

        mock_llm = AsyncMock()
        mock_llm.model = "anthropic/claude-sonnet-4-6"
        mock_llm.fast_model = "anthropic/claude-haiku-4-5-20251001"

        with patch(
            "src.services.transcription.transcript_chunker._detect_chapters_with_ai",
            new_callable=AsyncMock,
            return_value=None,  # AI detection fails
        ):
            result = await split_transcript_into_chapters(
                video_data, segments, "full transcript", llm_service=mock_llm,
            )

        assert len(result) >= 2
        assert all(ch.source == "time_split" for ch in result)

    @pytest.mark.asyncio
    async def test_always_returns_at_least_one_chunk(self):
        result = await split_transcript_into_chapters({}, [], "some text")
        assert len(result) >= 1

    @pytest.mark.asyncio
    async def test_segments_with_start_duration_format_are_normalized(self):
        """Segments using start/duration (yt-dlp format) should be normalized to startMs/endMs."""
        duration = 2700  # 45 min
        # Create segments in yt-dlp format (start in seconds, duration in seconds)
        segments = []
        interval = 5  # 5-second segments
        for start in range(0, duration, interval):
            segments.append({
                "text": f"word{start // interval}",
                "start": float(start),
                "duration": float(interval),
            })

        video_data = {"duration": duration}

        result = await split_transcript_into_chapters(video_data, segments, "full transcript")

        # Should produce multiple time_split chapters (not fall through to single chunk)
        assert len(result) >= 2
        assert all(ch.source == "time_split" for ch in result)
        # Each chunk should have text (normalization allowed slicing to work)
        for ch in result:
            assert ch.text.strip()

    @pytest.mark.asyncio
    async def test_ai_chapter_detection_uses_fast_model(self):
        """``_detect_chapters_with_ai`` must route through the fast model.

        Chapter detection is a low-stakes parse — Sonnet is overkill.
        Switching to Haiku/mini saves ~$0.009 per long video (over 80%
        of the chapter_detect line item).
        """
        from src.services.transcription import transcript_chunker as tc

        duration = 2700
        segments = _make_segments(duration)
        video_data = {"duration": duration, "title": "Test Video"}

        mock_llm = AsyncMock()
        mock_llm.model = "anthropic/claude-sonnet-4-6"
        mock_llm.fast_model = "anthropic/claude-haiku-4-5-20251001"

        with patch(
            "src.services.transcription.transcript_chunker.call_llm_with_retry",
            new_callable=AsyncMock,
            return_value=None,  # short-circuit; we only care about kwargs
        ) as mock_call:
            tc._CHAPTER_DETECT_PROMPT = (
                "{title} {description} {first_500_words} {last_500_words} {duration_minutes}"
            )
            await tc._detect_chapters_with_ai(
                title="t", description="d", transcript="word " * 100,
                duration=duration, segments=segments, llm_service=mock_llm,
            )

            assert mock_call.await_count == 1
            kwargs = mock_call.await_args.kwargs
            assert kwargs.get("use_fast_model") is True
            assert kwargs.get("stage_name") == "chapter_detect"

    @pytest.mark.asyncio
    async def test_ai_chapter_detection_tags_feature(self):
        """``_detect_chapters_with_ai`` must set llm_feature_var to
        ``summarize:chapter_detect`` for the duration of its LLM call so
        the cost appears under its own line item in admin's
        ``/usage/by-feature`` instead of being absorbed by the outer
        ``summarize:extraction`` tag set in `phases/extraction.py`."""
        from src.services.transcription import transcript_chunker as tc
        from llm_common.context import llm_feature_var

        duration = 1800
        segments = _make_segments(duration)
        mock_llm = AsyncMock()

        observed_feature: list[str | None] = []

        async def _capture_feature(*_args, **_kwargs):
            observed_feature.append(llm_feature_var.get())
            return None

        # Pre-set outer feature to mimic the extraction phase wrapper
        outer_token = llm_feature_var.set("summarize:extraction")
        try:
            with patch(
                "src.services.transcription.transcript_chunker.call_llm_with_retry",
                side_effect=_capture_feature,
            ):
                tc._CHAPTER_DETECT_PROMPT = (
                    "{title} {description} {first_500_words} {last_500_words} {duration_minutes}"
                )
                await tc._detect_chapters_with_ai(
                    title="t", description="d", transcript="word " * 50,
                    duration=duration, segments=segments, llm_service=mock_llm,
                )
        finally:
            llm_feature_var.reset(outer_token)

        assert observed_feature == ["summarize:chapter_detect"]
        # Outer feature must be restored after the call returns
        # (we reset outer_token above; just confirm the var no longer
        # holds chapter_detect — i.e., the inner reset ran).
        assert llm_feature_var.get() != "summarize:chapter_detect"

    @pytest.mark.asyncio
    async def test_segments_with_start_duration_produce_correct_chapter_text(self):
        """Verify that start/duration segments produce distinct text per chapter."""
        duration = 600  # 10 min
        segments = []
        for start in range(0, duration, 5):
            segments.append({
                "text": f"seg_at_{start}s",
                "start": float(start),
                "duration": 5.0,
            })

        chapters = [
            {"title": "Part 1", "start_time": 0, "end_time": 300},
            {"title": "Part 2", "start_time": 300, "end_time": 600},
        ]
        video_data = {"duration": duration, "chapters": chapters}

        result = await split_transcript_into_chapters(video_data, segments, "full transcript")

        assert len(result) == 2
        # Part 1 should contain segments from 0-295s but not 300+
        assert "seg_at_0s" in result[0].text
        assert "seg_at_295s" in result[0].text
        assert "seg_at_300s" not in result[0].text
        # Part 2 should contain segments from 300-595s
        assert "seg_at_300s" in result[1].text
        assert "seg_at_595s" in result[1].text
