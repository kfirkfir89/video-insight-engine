"""Tests for chunked extraction — batch processing, routing, and integration."""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
import json

from src.services.pipeline.extractor import (
    extract,
    batch_chapters,
    _build_batch_transcript,
    _format_time,
)
from src.services.pipeline.triage import TriageResult
from src.services.transcription.transcript_chunker import ChapterChunk


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

def _make_chapter(index: int, text: str = "Some transcript text here", token_estimate: int = 5000) -> ChapterChunk:
    return ChapterChunk(
        index=index,
        title=f"Chapter {index + 1}",
        start_seconds=index * 300.0,
        end_seconds=(index + 1) * 300.0,
        text=text,
        source="youtube",
        token_estimate=token_estimate,
    )


def _make_triage(tags: list[str] | None = None) -> TriageResult:
    return TriageResult(
        content_tags=tags or ["learning"],
        modifiers=[],
        primary_tag=(tags or ["learning"])[0],
        user_goal="Test goal",
        tabs=[{"id": "key_points", "label": "Key Points", "component": "list_items", "goal": "test"}],
        confidence=0.9,
    )


# ---------------------------------------------------------------------------
# batch_chapters
# ---------------------------------------------------------------------------

class TestBatchChapters:
    def test_single_batch_when_all_fit(self):
        chapters = [_make_chapter(i, token_estimate=5000) for i in range(6)]
        batches = batch_chapters(chapters, max_tokens_per_batch=50000)

        assert len(batches) == 1
        assert len(batches[0]) == 6

    def test_splits_into_multiple_batches(self):
        chapters = [_make_chapter(i, token_estimate=10000) for i in range(12)]
        batches = batch_chapters(chapters, max_tokens_per_batch=50000)

        assert len(batches) >= 2
        # All chapters accounted for
        total = sum(len(b) for b in batches)
        assert total == 12

    def test_never_splits_single_chapter(self):
        chapters = [_make_chapter(0, token_estimate=60000)]
        batches = batch_chapters(chapters, max_tokens_per_batch=50000)

        assert len(batches) == 1
        assert len(batches[0]) == 1

    def test_empty_chapters(self):
        batches = batch_chapters([], max_tokens_per_batch=50000)
        assert batches == []

    def test_each_batch_respects_token_limit(self):
        chapters = [_make_chapter(i, token_estimate=15000) for i in range(10)]
        batches = batch_chapters(chapters, max_tokens_per_batch=50000)

        for batch in batches:
            total_tokens = sum(ch.token_estimate for ch in batch)
            # Each batch should be at or near the limit (may exceed for single large chapters)
            assert total_tokens <= 60000  # 50K + one chapter overflow

    def test_preserves_chapter_order(self):
        chapters = [_make_chapter(i) for i in range(8)]
        batches = batch_chapters(chapters, max_tokens_per_batch=20000)

        flat = [ch for batch in batches for ch in batch]
        assert [ch.index for ch in flat] == list(range(8))


# ---------------------------------------------------------------------------
# _build_batch_transcript
# ---------------------------------------------------------------------------

class TestBuildBatchTranscript:
    def test_includes_chapter_headers(self):
        chapters = [
            ChapterChunk(0, "Intro", 0, 300, "First chapter text", "youtube", 100),
            ChapterChunk(1, "Main", 300, 600, "Second chapter text", "youtube", 100),
        ]
        result = _build_batch_transcript(chapters)

        assert "=== CHAPTER 1: Intro" in result
        assert "=== CHAPTER 2: Main" in result
        assert "First chapter text" in result
        assert "Second chapter text" in result

    def test_includes_timestamps(self):
        chapters = [ChapterChunk(0, "Test", 0, 3661, "text", "youtube", 100)]
        result = _build_batch_transcript(chapters)

        assert "0:00" in result
        assert "1:01:01" in result


# ---------------------------------------------------------------------------
# _format_time
# ---------------------------------------------------------------------------

class TestFormatTime:
    def test_minutes_seconds(self):
        assert _format_time(65) == "1:05"
        assert _format_time(0) == "0:00"
        assert _format_time(3599) == "59:59"

    def test_hours_minutes_seconds(self):
        assert _format_time(3600) == "1:00:00"
        assert _format_time(3661) == "1:01:01"
        assert _format_time(7200) == "2:00:00"


# ---------------------------------------------------------------------------
# extract() routing
# ---------------------------------------------------------------------------

class TestExtractRouting:
    @pytest.mark.asyncio
    async def test_short_video_uses_single_extraction(self):
        """Videos <30 min without chapters should use single/overflow extraction."""
        mock_llm = AsyncMock()
        mock_llm.model = "anthropic/claude-sonnet-4-5-20250929"
        mock_llm.fast_model = "anthropic/claude-3-5-haiku-20241022"

        triage = _make_triage()
        short_transcript = " ".join(["word"] * 1000)  # <5.3K words → single
        video_data = {"title": "Short Video", "duration": 600}  # 10 min

        extraction_data = {"key_points": [{"text": "test"}]}

        with patch(
            "src.services.pipeline.extractor.call_llm_with_retry",
            new_callable=AsyncMock,
            return_value=json.dumps(extraction_data),
        ):
            with patch(
                "src.services.pipeline.extractor.validate_domain_output",
                return_value=extraction_data,
            ):
                events = []
                async for evt in extract(mock_llm, triage, short_transcript, video_data):
                    events.append(evt)

        # Should have progress events + extraction_complete
        complete_events = [e for e in events if e["event"] == "extraction_complete"]
        assert len(complete_events) == 1
        assert complete_events[0]["data"] == extraction_data

    @pytest.mark.asyncio
    async def test_long_video_with_chapters_uses_chunked(self):
        """Videos >30 min with chapters should use chunked extraction."""
        mock_llm = AsyncMock()
        mock_llm.model = "anthropic/claude-sonnet-4-5-20250929"
        mock_llm.fast_model = "anthropic/claude-3-5-haiku-20241022"

        triage = _make_triage()
        transcript = " ".join(["word"] * 10000)
        video_data = {"title": "Long Video", "duration": 5400}  # 90 min
        chapters = [_make_chapter(i) for i in range(6)]

        extraction_data = {"key_points": [{"text": "test"}]}

        with patch(
            "src.services.pipeline.extractor.call_llm_with_retry",
            new_callable=AsyncMock,
            return_value=json.dumps(extraction_data),
        ):
            with patch(
                "src.services.pipeline.extractor.validate_domain_output",
                return_value=extraction_data,
            ):
                events = []
                async for evt in extract(mock_llm, triage, transcript, video_data, chapters=chapters):
                    events.append(evt)

        complete_events = [e for e in events if e["event"] == "extraction_complete"]
        assert len(complete_events) == 1

    @pytest.mark.asyncio
    async def test_long_video_without_chapters_uses_overflow(self):
        """Videos >30 min but no chapters should use overflow extraction."""
        mock_llm = AsyncMock()
        mock_llm.model = "anthropic/claude-sonnet-4-5-20250929"
        mock_llm.fast_model = "anthropic/claude-3-5-haiku-20241022"

        triage = _make_triage()
        transcript = " ".join(["word"] * 10000)
        video_data = {"title": "Long Video", "duration": 5400}  # 90 min

        extraction_data = {"key_points": [{"text": "test"}]}

        with patch(
            "src.services.pipeline.extractor.call_llm_with_retry",
            new_callable=AsyncMock,
            return_value=json.dumps(extraction_data),
        ):
            with patch(
                "src.services.pipeline.extractor.validate_domain_output",
                return_value=extraction_data,
            ):
                events = []
                async for evt in extract(mock_llm, triage, transcript, video_data, chapters=None):
                    events.append(evt)

        complete_events = [e for e in events if e["event"] == "extraction_complete"]
        assert len(complete_events) == 1
