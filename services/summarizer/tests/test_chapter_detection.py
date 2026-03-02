"""Tests for chapter detection logic in LLMService.

Covers detect_chapters(), stream_detect_chapters(), and _build_time_based_chapters().
"""

import json

import pytest
from unittest.mock import AsyncMock

from src.services.llm import LLMService, _build_time_based_chapters


# ============================================================
# _build_time_based_chapters helper
# ============================================================


class TestBuildTimeBasedChapters:
    """Tests for _build_time_based_chapters fallback helper."""

    def test_short_video_single_segment(self):
        """Short video (< 5 min) produces a single part."""
        chapters = _build_time_based_chapters(200)
        assert len(chapters) == 1
        assert chapters[0] == {"title": "Part 1", "startSeconds": 0, "endSeconds": 200}

    def test_exact_five_minutes(self):
        chapters = _build_time_based_chapters(300)
        assert len(chapters) == 1
        assert chapters[0]["endSeconds"] == 300

    def test_ten_minute_video(self):
        chapters = _build_time_based_chapters(600)
        assert len(chapters) == 2
        assert chapters[0] == {"title": "Part 1", "startSeconds": 0, "endSeconds": 300}
        assert chapters[1] == {"title": "Part 2", "startSeconds": 300, "endSeconds": 600}

    def test_thirty_minute_video(self):
        """A 30-min video (1800s) should produce 6 parts."""
        chapters = _build_time_based_chapters(1800)
        assert len(chapters) == 6
        for i, ch in enumerate(chapters):
            assert ch["title"] == f"Part {i + 1}"
            assert ch["startSeconds"] == i * 300
            expected_end = min((i + 1) * 300, 1800)
            assert ch["endSeconds"] == expected_end

    def test_non_round_duration(self):
        """Duration that doesn't divide evenly by 300."""
        chapters = _build_time_based_chapters(1731)
        assert len(chapters) == 6
        assert chapters[-1]["endSeconds"] == 1731

    def test_zero_duration(self):
        chapters = _build_time_based_chapters(0)
        assert chapters == []


# ============================================================
# detect_chapters (non-streaming)
# ============================================================


class TestDetectChapters:
    """Tests for LLMService.detect_chapters()."""

    @pytest.mark.asyncio
    async def test_success_first_attempt(self, mock_llm_provider):
        """Should return chapters when LLM responds correctly on first try."""
        chapters_response = json.dumps({
            "chapters": [
                {"title": "Intro", "startSeconds": 0, "endSeconds": 120},
                {"title": "Main Topic", "startSeconds": 120, "endSeconds": 600},
            ]
        })
        mock_llm_provider.complete = AsyncMock(return_value=chapters_response)

        service = LLMService(mock_llm_provider)
        result = await service.detect_chapters("transcript text", [], duration=600)

        assert len(result) == 2
        assert result[0]["title"] == "Intro"
        assert result[1]["title"] == "Main Topic"
        # Should only call LLM once on success
        assert mock_llm_provider.complete.call_count == 1

    @pytest.mark.asyncio
    async def test_success_on_retry(self, mock_llm_provider):
        """Should retry once and succeed if first attempt returns bad JSON."""
        bad_response = "I can't parse this"
        good_response = json.dumps({
            "chapters": [
                {"title": "Part A", "startSeconds": 0, "endSeconds": 300},
            ]
        })
        mock_llm_provider.complete = AsyncMock(side_effect=[bad_response, good_response])

        service = LLMService(mock_llm_provider)
        result = await service.detect_chapters("transcript text", [], duration=600)

        assert len(result) == 1
        assert result[0]["title"] == "Part A"
        assert mock_llm_provider.complete.call_count == 2

    @pytest.mark.asyncio
    async def test_fallback_to_time_based_chapters(self, mock_llm_provider):
        """Should fall back to time-based segments after 2 failed attempts."""
        mock_llm_provider.complete = AsyncMock(return_value="Not JSON at all")

        service = LLMService(mock_llm_provider)
        result = await service.detect_chapters("transcript text", [], duration=1800)

        # 1800s / 300s = 6 parts
        assert len(result) == 6
        assert result[0]["title"] == "Part 1"
        assert result[-1]["title"] == "Part 6"
        assert mock_llm_provider.complete.call_count == 2

    @pytest.mark.asyncio
    async def test_fallback_empty_chapters_key(self, mock_llm_provider):
        """Should fall back when LLM returns JSON with empty chapters array."""
        empty_chapters = json.dumps({"chapters": []})
        mock_llm_provider.complete = AsyncMock(return_value=empty_chapters)

        service = LLMService(mock_llm_provider)
        result = await service.detect_chapters("transcript text", [], duration=900)

        # 900s / 300s = 3 parts
        assert len(result) == 3
        assert mock_llm_provider.complete.call_count == 2

    @pytest.mark.asyncio
    async def test_fallback_zero_duration(self, mock_llm_provider):
        """Should fall back to single 'Full Video' when duration is 0."""
        mock_llm_provider.complete = AsyncMock(return_value="bad")

        service = LLMService(mock_llm_provider)
        result = await service.detect_chapters("transcript text", [], duration=0)

        assert len(result) == 1
        assert result[0]["title"] == "Full Video"

    @pytest.mark.asyncio
    async def test_duration_from_segments(self, mock_llm_provider, sample_segments):
        """Should calculate duration from segments when not provided."""
        chapters_response = json.dumps({
            "chapters": [
                {"title": "Section 1", "startSeconds": 0, "endSeconds": 75},
            ]
        })
        mock_llm_provider.complete = AsyncMock(return_value=chapters_response)

        service = LLMService(mock_llm_provider)
        result = await service.detect_chapters("transcript text", sample_segments)

        assert len(result) == 1
        assert result[0]["title"] == "Section 1"


# ============================================================
# stream_detect_chapters (streaming)
# ============================================================


class TestStreamDetectChapters:
    """Tests for LLMService.stream_detect_chapters()."""

    @pytest.mark.asyncio
    async def test_success_first_attempt(self, mock_llm_provider):
        """Should yield tokens then complete with chapters on first try."""
        chapters_json = json.dumps({
            "chapters": [
                {"title": "Intro", "startSeconds": 0, "endSeconds": 120},
                {"title": "Deep Dive", "startSeconds": 120, "endSeconds": 600},
            ]
        })

        async def mock_stream(*args, **kwargs):
            for ch in chapters_json:
                yield ch

        mock_llm_provider.stream = mock_stream

        service = LLMService(mock_llm_provider)
        tokens = []
        complete_data = None

        async for event_type, data in service.stream_detect_chapters("transcript", [], duration=600):
            if event_type == "token":
                tokens.append(data)
            elif event_type == "complete":
                complete_data = data

        assert len(tokens) > 0
        assert complete_data is not None
        assert len(complete_data) == 2
        assert complete_data[0]["title"] == "Intro"

    @pytest.mark.asyncio
    async def test_retry_with_non_streaming_fallback(self, mock_llm_provider):
        """Should retry with non-streaming call when streaming parse fails."""
        # Streaming returns garbage
        async def mock_stream(*args, **kwargs):
            yield "This is not JSON"

        mock_llm_provider.stream = mock_stream

        # Non-streaming retry returns valid chapters
        good_response = json.dumps({
            "chapters": [
                {"title": "Recovered", "startSeconds": 0, "endSeconds": 600},
            ]
        })
        mock_llm_provider.complete = AsyncMock(return_value=good_response)

        service = LLMService(mock_llm_provider)
        complete_data = None

        async for event_type, data in service.stream_detect_chapters("transcript", [], duration=600):
            if event_type == "complete":
                complete_data = data

        assert complete_data is not None
        assert len(complete_data) == 1
        assert complete_data[0]["title"] == "Recovered"
        assert mock_llm_provider.complete.call_count == 1

    @pytest.mark.asyncio
    async def test_fallback_to_time_based_chapters(self, mock_llm_provider):
        """Should fall back to time-based segments after all attempts fail."""
        # Streaming returns garbage
        async def mock_stream(*args, **kwargs):
            yield "nope"

        mock_llm_provider.stream = mock_stream
        # Non-streaming also returns garbage
        mock_llm_provider.complete = AsyncMock(return_value="also nope")

        service = LLMService(mock_llm_provider)
        complete_data = None

        async for event_type, data in service.stream_detect_chapters("transcript", [], duration=1731):
            if event_type == "complete":
                complete_data = data

        assert complete_data is not None
        assert len(complete_data) == 6
        assert complete_data[0]["title"] == "Part 1"
        assert complete_data[-1]["endSeconds"] == 1731
