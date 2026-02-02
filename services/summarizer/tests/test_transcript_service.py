"""Tests for transcript service (transcript.py).

Tests transcript fetching, parsing, segmentation, and timestamp handling.
"""

import pytest
from unittest.mock import patch, MagicMock, AsyncMock

from src.services.transcript import (
    get_transcript,
    get_normalized_transcript,
    clean_transcript,
    format_transcript_with_timestamps,
    normalize_segments,
    _is_rate_limit_error,
    _fetch_transcript_sync,
)
from src.models.schemas import ErrorCode, TranscriptSource, TranscriptSegment
from src.exceptions import TranscriptError


class TestCleanTranscript:
    """Tests for transcript text cleaning."""

    def test_removes_music_annotation(self):
        """Test removing [Music] annotation."""
        result = clean_transcript("Hello [Music] world")
        assert result == "Hello world"

    def test_removes_applause_annotation(self):
        """Test removing [Applause] annotation."""
        result = clean_transcript("Thank you [Applause] everyone")
        assert result == "Thank you everyone"

    def test_removes_laughter_annotation(self):
        """Test removing [Laughter] annotation."""
        result = clean_transcript("That was funny [Laughter]")
        assert result == "That was funny"

    def test_case_insensitive_removal(self):
        """Test case-insensitive annotation removal."""
        result = clean_transcript("[MUSIC] test [music] [MuSiC]")
        assert result == "test"

    def test_normalizes_whitespace(self):
        """Test whitespace normalization."""
        result = clean_transcript("Hello    world   test")
        assert result == "Hello world test"

    def test_strips_leading_trailing_whitespace(self):
        """Test stripping leading/trailing whitespace."""
        result = clean_transcript("  Hello world  ")
        assert result == "Hello world"

    def test_handles_empty_string(self):
        """Test handling empty string."""
        result = clean_transcript("")
        assert result == ""

    def test_handles_only_annotations(self):
        """Test handling text with only annotations."""
        result = clean_transcript("[Music] [Applause]")
        assert result == ""


class TestFormatTranscriptWithTimestamps:
    """Tests for timestamp formatting of transcript segments."""

    def test_formats_with_default_interval(self):
        """Test formatting with default 30-second interval."""
        segments = [
            {"text": "Hello everyone", "start": 0},
            {"text": "welcome to the video", "start": 5},
            {"text": "Today we discuss", "start": 35},
        ]

        result = format_transcript_with_timestamps(segments)
        lines = result.split("\n")

        assert len(lines) == 2
        assert "[0:00]" in lines[0]
        assert "Hello everyone" in lines[0]
        assert "[0:30]" in lines[1]  # 30-59 is interval 1, starting at 0:30
        assert "Today we discuss" in lines[1]

    def test_formats_with_custom_interval(self):
        """Test formatting with custom interval."""
        segments = [
            {"text": "Part 1", "start": 0},
            {"text": "Part 2", "start": 70},
            {"text": "Part 3", "start": 130},
        ]

        result = format_transcript_with_timestamps(segments, interval_seconds=60)
        lines = result.split("\n")

        assert len(lines) == 3
        assert "[0:00]" in lines[0]
        assert "[1:00]" in lines[1]
        assert "[2:00]" in lines[2]

    def test_groups_segments_in_same_interval(self):
        """Test that segments in same interval are grouped."""
        segments = [
            {"text": "First", "start": 0},
            {"text": "Second", "start": 10},
            {"text": "Third", "start": 20},
        ]

        result = format_transcript_with_timestamps(segments, interval_seconds=30)
        lines = result.split("\n")

        assert len(lines) == 1
        assert "First" in lines[0]
        assert "Second" in lines[0]
        assert "Third" in lines[0]

    def test_handles_empty_segments(self):
        """Test handling empty segments list."""
        result = format_transcript_with_timestamps([])
        assert result == ""

    def test_skips_empty_text(self):
        """Test skipping segments with empty text."""
        segments = [
            {"text": "Hello", "start": 0},
            {"text": "", "start": 10},
            {"text": "   ", "start": 20},
            {"text": "World", "start": 25},
        ]

        result = format_transcript_with_timestamps(segments)

        assert "Hello" in result
        assert "World" in result

    def test_formats_minutes_correctly(self):
        """Test correct minute formatting for longer videos."""
        segments = [
            {"text": "Start", "start": 0},
            {"text": "Middle", "start": 600},  # 10 minutes
            {"text": "End", "start": 3600},  # 60 minutes
        ]

        result = format_transcript_with_timestamps(segments, interval_seconds=300)
        lines = result.split("\n")

        assert "[0:00]" in lines[0]
        assert "[10:00]" in lines[1]
        assert "[60:00]" in lines[2]


class TestNormalizeSegments:
    """Tests for segment normalization to milliseconds."""

    def test_normalizes_api_format(self):
        """Test normalizing youtube-transcript-api format (start + duration)."""
        segments = [
            {"text": "Hello", "start": 1.5, "duration": 2.0},
            {"text": "World", "start": 4.0, "duration": 1.5},
        ]

        result = normalize_segments(segments, "api")

        assert len(result) == 2
        assert result[0].text == "Hello"
        assert result[0].startMs == 1500
        assert result[0].endMs == 3500  # 1.5 + 2.0 = 3.5s
        assert result[1].startMs == 4000
        assert result[1].endMs == 5500

    def test_normalizes_whisper_format(self):
        """Test normalizing Whisper format (start + end in seconds)."""
        segments = [
            {"text": "Hello", "start": 1.0, "end": 3.0},
            {"text": "World", "start": 3.0, "end": 5.0},
        ]

        result = normalize_segments(segments, "whisper")

        assert len(result) == 2
        assert result[0].startMs == 1000
        assert result[0].endMs == 3000
        assert result[1].startMs == 3000
        assert result[1].endMs == 5000

    def test_preserves_already_normalized(self):
        """Test preserving already normalized format (startMs/endMs)."""
        segments = [
            {"text": "Hello", "startMs": 1500, "endMs": 3500},
            {"text": "World", "startMs": 4000, "endMs": 5500},
        ]

        result = normalize_segments(segments, "api")

        assert len(result) == 2
        assert result[0].startMs == 1500
        assert result[0].endMs == 3500

    def test_handles_missing_duration(self):
        """Test handling segments with missing duration."""
        segments = [
            {"text": "Hello", "start": 1.0},  # No duration
        ]

        result = normalize_segments(segments, "api")

        assert result[0].startMs == 1000
        assert result[0].endMs == 1000  # Same as start when no duration

    def test_handles_empty_segments(self):
        """Test handling empty segments list."""
        result = normalize_segments([], "api")
        assert result == []


class TestIsRateLimitError:
    """Tests for rate limit error detection."""

    def test_detects_429_error(self):
        """Test detecting 429 status code error."""
        error = Exception("HTTP Error 429: Too Many Requests")
        assert _is_rate_limit_error(error) is True

    def test_detects_too_many_requests(self):
        """Test detecting 'too many' in error message."""
        error = Exception("Too many requests, please slow down")
        assert _is_rate_limit_error(error) is True

    def test_detects_rate_limit_message(self):
        """Test detecting 'rate limit' in error message."""
        error = Exception("You have been rate limited")
        assert _is_rate_limit_error(error) is True

    def test_case_insensitive(self):
        """Test case-insensitive detection."""
        error = Exception("RATE LIMIT exceeded")
        assert _is_rate_limit_error(error) is True

    def test_does_not_detect_other_errors(self):
        """Test non-rate-limit errors are not detected."""
        error = Exception("Video not found")
        assert _is_rate_limit_error(error) is False


class TestFetchTranscriptSync:
    """Tests for synchronous transcript fetching."""

    @patch("src.services.transcript.YouTubeTranscriptApi")
    def test_fetches_manual_transcript(self, mock_api_class):
        """Test fetching manually created transcript."""
        # Setup mock
        mock_api = MagicMock()
        mock_api_class.return_value = mock_api

        mock_transcript_list = MagicMock()
        mock_transcript = MagicMock()
        mock_fetched = MagicMock()
        mock_fetched.to_raw_data.return_value = [
            {"text": "Hello", "start": 0.0, "duration": 1.0},
            {"text": "World", "start": 1.0, "duration": 1.0},
        ]

        mock_transcript.fetch.return_value = mock_fetched
        mock_transcript_list.find_manually_created_transcript.return_value = mock_transcript
        mock_api.list.return_value = mock_transcript_list

        segments, full_text, transcript_type = _fetch_transcript_sync("test_video_id")

        assert len(segments) == 2
        assert segments[0]["text"] == "Hello"
        assert full_text == "Hello World"
        assert transcript_type == "manual"

    @patch("src.services.transcript.YouTubeTranscriptApi")
    def test_falls_back_to_auto_generated(self, mock_api_class):
        """Test falling back to auto-generated transcript."""
        from youtube_transcript_api._errors import NoTranscriptFound

        mock_api = MagicMock()
        mock_api_class.return_value = mock_api

        mock_transcript_list = MagicMock()
        mock_transcript = MagicMock()
        mock_fetched = MagicMock()
        mock_fetched.to_raw_data.return_value = [
            {"text": "Auto text", "start": 0.0, "duration": 1.0},
        ]

        mock_transcript.fetch.return_value = mock_fetched
        mock_transcript_list.find_manually_created_transcript.side_effect = NoTranscriptFound("test", [], "")
        mock_transcript_list.find_generated_transcript.return_value = mock_transcript
        mock_api.list.return_value = mock_transcript_list

        segments, full_text, transcript_type = _fetch_transcript_sync("test_video_id")

        assert transcript_type == "auto-generated"
        assert full_text == "Auto text"

    @patch("src.services.transcript.YouTubeTranscriptApi")
    def test_raises_error_on_disabled_captions(self, mock_api_class):
        """Test error when captions are disabled."""
        from youtube_transcript_api._errors import TranscriptsDisabled

        mock_api = MagicMock()
        mock_api_class.return_value = mock_api
        mock_api.list.side_effect = TranscriptsDisabled("test")

        with pytest.raises(TranscriptError) as exc_info:
            _fetch_transcript_sync("test_video_id")

        assert exc_info.value.code == ErrorCode.NO_TRANSCRIPT

    @patch("src.services.transcript.YouTubeTranscriptApi")
    def test_raises_error_on_unavailable_video(self, mock_api_class):
        """Test error when video is unavailable."""
        from youtube_transcript_api._errors import VideoUnavailable

        mock_api = MagicMock()
        mock_api_class.return_value = mock_api
        mock_api.list.side_effect = VideoUnavailable("test")

        with pytest.raises(TranscriptError) as exc_info:
            _fetch_transcript_sync("test_video_id")

        assert exc_info.value.code == ErrorCode.VIDEO_UNAVAILABLE

    @patch("src.services.transcript.YouTubeTranscriptApi")
    def test_raises_rate_limit_error(self, mock_api_class):
        """Test rate limit error handling."""
        mock_api = MagicMock()
        mock_api_class.return_value = mock_api
        mock_api.list.side_effect = Exception("429 Too Many Requests")

        with pytest.raises(TranscriptError) as exc_info:
            _fetch_transcript_sync("test_video_id")

        assert exc_info.value.code == ErrorCode.RATE_LIMITED


class TestGetTranscriptAsync:
    """Tests for async transcript fetching."""

    @patch("src.services.transcript._fetch_transcript_sync")
    async def test_fetches_transcript_async(self, mock_fetch):
        """Test async wrapper for transcript fetching."""
        mock_fetch.return_value = (
            [{"text": "Hello", "start": 0, "duration": 1}],
            "Hello",
            "manual",
        )

        segments, text, transcript_type = await get_transcript("test123")

        assert segments[0]["text"] == "Hello"
        assert text == "Hello"
        assert transcript_type == "manual"
        mock_fetch.assert_called_once_with("test123")

    @patch("src.services.transcript._fetch_transcript_sync")
    async def test_propagates_errors(self, mock_fetch):
        """Test that errors are propagated from sync function."""
        mock_fetch.side_effect = TranscriptError("No transcript", ErrorCode.NO_TRANSCRIPT)

        with pytest.raises(TranscriptError) as exc_info:
            await get_transcript("test123")

        assert exc_info.value.code == ErrorCode.NO_TRANSCRIPT


class TestGetNormalizedTranscript:
    """Tests for normalized transcript fetching."""

    @patch("src.services.transcript.settings")
    @patch("src.services.transcript.get_transcript")
    async def test_returns_normalized_transcript(self, mock_get, mock_settings):
        """Test returning normalized transcript."""
        # Ensure no proxy is configured for default source test
        mock_settings.WEBSHARE_PROXY_USERNAME = None
        mock_get.return_value = (
            [
                {"text": "Hello", "start": 1.5, "duration": 2.0},
                {"text": "World", "start": 4.0, "duration": 1.5},
            ],
            "Hello World",
            "manual",
        )

        result = await get_normalized_transcript("test123")

        assert result.text == "Hello World"
        assert len(result.segments) == 2
        assert result.segments[0].startMs == 1500
        assert result.source == "api"  # Default source without proxy

    @patch("src.services.transcript.settings")
    @patch("src.services.transcript.get_transcript")
    async def test_sets_proxy_source_when_configured(self, mock_get, mock_settings):
        """Test setting proxy source when proxy is configured."""
        mock_settings.WEBSHARE_PROXY_USERNAME = "user"
        mock_get.return_value = (
            [{"text": "Test", "start": 0, "duration": 1}],
            "Test",
            "manual",
        )

        result = await get_normalized_transcript("test123")

        assert result.source == "proxy"

    @patch("src.services.transcript.get_transcript")
    async def test_sets_ytdlp_source(self, mock_get):
        """Test setting yt-dlp source for yt-dlp transcripts."""
        mock_get.return_value = (
            [{"text": "Test", "start": 0, "duration": 1}],
            "Test",
            "yt-dlp",
        )

        result = await get_normalized_transcript("test123")

        assert result.source == "ytdlp"


class TestTranscriptSegmentationEdgeCases:
    """Tests for edge cases in transcript segmentation."""

    def test_handles_very_long_videos(self):
        """Test formatting very long videos (2+ hours)."""
        segments = [
            {"text": "Start", "start": 0},
            {"text": "End", "start": 7200},  # 2 hours
        ]

        result = format_transcript_with_timestamps(segments, interval_seconds=3600)
        lines = result.split("\n")

        assert "[0:00]" in lines[0]
        assert "[120:00]" in lines[1]

    def test_handles_fractional_timestamps(self):
        """Test handling fractional second timestamps."""
        segments = [
            {"text": "A", "start": 0.333},
            {"text": "B", "start": 29.999},
            {"text": "C", "start": 30.001},
        ]

        result = format_transcript_with_timestamps(segments, interval_seconds=30)
        lines = result.split("\n")

        # First two should be in 0:00 interval, third in 0:30
        assert len(lines) == 2
        assert "A" in lines[0]
        assert "B" in lines[0]
        assert "C" in lines[1]

    def test_handles_unicode_text(self):
        """Test handling unicode characters in transcript."""
        segments = [
            {"text": "Hello world", "start": 0},
            {"text": "Cafe latte", "start": 5},
        ]

        result = format_transcript_with_timestamps(segments)

        assert "world" in result

    def test_preserves_segment_order(self):
        """Test that segment order is preserved."""
        segments = [
            {"text": "First", "start": 0},
            {"text": "Second", "start": 5},
            {"text": "Third", "start": 10},
        ]

        result = format_transcript_with_timestamps(segments)

        # Order should be preserved in output
        first_idx = result.find("First")
        second_idx = result.find("Second")
        third_idx = result.find("Third")

        assert first_idx < second_idx < third_idx
