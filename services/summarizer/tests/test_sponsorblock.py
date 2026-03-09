"""Tests for SponsorBlock service."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
import json

from src.services.video.sponsorblock import (
    SponsorSegment,
    get_sponsor_segments,
    filter_transcript_segments,
    calculate_content_duration,
    sponsor_segments_to_dict,
    SKIP_CATEGORIES,
    SPONSORBLOCK_API_BASE,
)


class TestSponsorSegment:
    """Tests for SponsorSegment dataclass."""

    def test_create_segment(self):
        """Test creating a SponsorSegment."""
        segment = SponsorSegment(
            start_seconds=10.5,
            end_seconds=45.2,
            category="sponsor",
            uuid="abc123",
        )

        assert segment.start_seconds == 10.5
        assert segment.end_seconds == 45.2
        assert segment.category == "sponsor"
        assert segment.uuid == "abc123"


class TestGetSponsorSegments:
    """Tests for get_sponsor_segments function."""

    @patch("src.services.video.sponsorblock.httpx.AsyncClient")
    async def test_no_segments_found(self, mock_client_class):
        """Test handling 404 when no segments found."""
        mock_response = MagicMock()
        mock_response.status_code = 404

        mock_client = AsyncMock()
        mock_client.get.return_value = mock_response
        mock_client_class.return_value.__aenter__.return_value = mock_client

        result = await get_sponsor_segments("test123")

        assert result == []

    @patch("src.services.video.sponsorblock.httpx.AsyncClient")
    async def test_api_error(self, mock_client_class):
        """Test handling API errors."""
        mock_response = MagicMock()
        mock_response.status_code = 500

        mock_client = AsyncMock()
        mock_client.get.return_value = mock_response
        mock_client_class.return_value.__aenter__.return_value = mock_client

        result = await get_sponsor_segments("test123")

        assert result == []

    @patch("src.services.video.sponsorblock.httpx.AsyncClient")
    async def test_successful_fetch(self, mock_client_class):
        """Test successful segment fetch."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = [
            {
                "segment": [10.0, 45.5],
                "category": "sponsor",
                "UUID": "uuid1",
            },
            {
                "segment": [120.0, 135.0],
                "category": "selfpromo",
                "UUID": "uuid2",
            },
        ]

        mock_client = AsyncMock()
        mock_client.get.return_value = mock_response
        mock_client_class.return_value.__aenter__.return_value = mock_client

        result = await get_sponsor_segments("test123")

        assert len(result) == 2
        assert result[0].start_seconds == 10.0
        assert result[0].end_seconds == 45.5
        assert result[0].category == "sponsor"
        assert result[0].uuid == "uuid1"
        assert result[1].category == "selfpromo"

    @patch("src.services.video.sponsorblock.httpx.AsyncClient")
    async def test_timeout_returns_empty(self, mock_client_class):
        """Test that timeout returns empty list."""
        import httpx

        mock_client = AsyncMock()
        mock_client.get.side_effect = httpx.TimeoutException("Timeout")
        mock_client_class.return_value.__aenter__.return_value = mock_client

        result = await get_sponsor_segments("test123")

        assert result == []

    @patch("src.services.video.sponsorblock.httpx.AsyncClient")
    async def test_general_exception_returns_empty(self, mock_client_class):
        """Test that general exceptions return empty list."""
        mock_client = AsyncMock()
        mock_client.get.side_effect = Exception("Connection failed")
        mock_client_class.return_value.__aenter__.return_value = mock_client

        result = await get_sponsor_segments("test123")

        assert result == []

    @patch("src.services.video.sponsorblock.httpx.AsyncClient")
    async def test_invalid_json_returns_empty(self, mock_client_class):
        """Test handling invalid JSON response."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.side_effect = json.JSONDecodeError("Invalid", "", 0)

        mock_client = AsyncMock()
        mock_client.get.return_value = mock_response
        mock_client_class.return_value.__aenter__.return_value = mock_client

        result = await get_sponsor_segments("test123")

        assert result == []

    @patch("src.services.video.sponsorblock.httpx.AsyncClient")
    async def test_malformed_segment_data(self, mock_client_class):
        """Test handling malformed segment data."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = [
            {
                "segment": [10.0],  # Missing end time
                "category": "sponsor",
                "UUID": "uuid1",
            },
            {
                "segment": [20.0, 30.0],  # Valid segment
                "category": "sponsor",
                "UUID": "uuid2",
            },
            {
                "category": "sponsor",  # Missing segment array
                "UUID": "uuid3",
            },
        ]

        mock_client = AsyncMock()
        mock_client.get.return_value = mock_response
        mock_client_class.return_value.__aenter__.return_value = mock_client

        result = await get_sponsor_segments("test123")

        # Only the valid segment should be returned
        assert len(result) == 1
        assert result[0].start_seconds == 20.0

    @patch("src.services.video.sponsorblock.httpx.AsyncClient")
    async def test_uses_correct_categories(self, mock_client_class):
        """Test that API request includes correct categories."""
        mock_response = MagicMock()
        mock_response.status_code = 404

        mock_client = AsyncMock()
        mock_client.get.return_value = mock_response
        mock_client_class.return_value.__aenter__.return_value = mock_client

        await get_sponsor_segments("test123")

        # Verify the URL contains the expected categories
        call_args = mock_client.get.call_args
        url = call_args[0][0]
        assert "sponsor" in url
        assert "selfpromo" in url
        assert "intro" in url
        assert "outro" in url


class TestFilterTranscriptSegments:
    """Tests for filter_transcript_segments function."""

    def test_no_sponsor_segments_returns_all(self):
        """Test that all segments returned when no sponsors."""
        transcript = [
            {"text": "Hello", "start": 0.0, "duration": 5.0},
            {"text": "World", "start": 5.0, "duration": 5.0},
        ]

        result = filter_transcript_segments(transcript, [])

        assert len(result) == 2

    def test_filters_overlapping_segments(self):
        """Test that segments overlapping with sponsors are filtered."""
        transcript = [
            {"text": "Before sponsor", "start": 0.0, "duration": 5.0},
            {"text": "Sponsor content", "start": 10.0, "duration": 5.0},
            {"text": "After sponsor", "start": 20.0, "duration": 5.0},
        ]

        sponsors = [
            SponsorSegment(start_seconds=8.0, end_seconds=18.0, category="sponsor", uuid="1"),
        ]

        result = filter_transcript_segments(transcript, sponsors)

        assert len(result) == 2
        assert result[0]["text"] == "Before sponsor"
        assert result[1]["text"] == "After sponsor"

    def test_keeps_partial_overlap_below_threshold(self):
        """Test that segments with <50% overlap are kept."""
        transcript = [
            {"text": "Partial overlap", "start": 15.0, "duration": 10.0},  # 15-25s
        ]

        # Sponsor from 10-18s, overlap is 3s out of 10s (30%)
        sponsors = [
            SponsorSegment(start_seconds=10.0, end_seconds=18.0, category="sponsor", uuid="1"),
        ]

        result = filter_transcript_segments(transcript, sponsors)

        assert len(result) == 1

    def test_removes_partial_overlap_above_threshold(self):
        """Test that segments with >50% overlap are removed."""
        transcript = [
            {"text": "Mostly sponsor", "start": 12.0, "duration": 10.0},  # 12-22s
        ]

        # Sponsor from 10-20s, overlap is 8s out of 10s (80%)
        sponsors = [
            SponsorSegment(start_seconds=10.0, end_seconds=20.0, category="sponsor", uuid="1"),
        ]

        result = filter_transcript_segments(transcript, sponsors)

        assert len(result) == 0

    def test_multiple_sponsor_segments(self):
        """Test filtering with multiple sponsor segments."""
        transcript = [
            {"text": "Intro", "start": 0.0, "duration": 5.0},
            {"text": "Sponsor 1", "start": 10.0, "duration": 5.0},
            {"text": "Content", "start": 20.0, "duration": 5.0},
            {"text": "Sponsor 2", "start": 30.0, "duration": 5.0},
            {"text": "Outro", "start": 40.0, "duration": 5.0},
        ]

        sponsors = [
            SponsorSegment(start_seconds=8.0, end_seconds=16.0, category="sponsor", uuid="1"),
            SponsorSegment(start_seconds=28.0, end_seconds=36.0, category="selfpromo", uuid="2"),
        ]

        result = filter_transcript_segments(transcript, sponsors)

        assert len(result) == 3
        assert result[0]["text"] == "Intro"
        assert result[1]["text"] == "Content"
        assert result[2]["text"] == "Outro"

    def test_empty_transcript(self):
        """Test with empty transcript."""
        sponsors = [
            SponsorSegment(start_seconds=10.0, end_seconds=20.0, category="sponsor", uuid="1"),
        ]

        result = filter_transcript_segments([], sponsors)

        assert result == []

    def test_zero_duration_segment(self):
        """Test handling segment with zero duration."""
        transcript = [
            {"text": "Zero duration", "start": 15.0, "duration": 0},
        ]

        sponsors = [
            SponsorSegment(start_seconds=10.0, end_seconds=20.0, category="sponsor", uuid="1"),
        ]

        result = filter_transcript_segments(transcript, sponsors)

        # Zero duration segments should be kept (division by zero protection)
        assert len(result) == 1


class TestCalculateContentDuration:
    """Tests for calculate_content_duration function."""

    def test_no_sponsors(self):
        """Test with no sponsor segments."""
        result = calculate_content_duration(600.0, [])

        assert result == 600.0

    def test_with_sponsors(self):
        """Test with sponsor segments."""
        sponsors = [
            SponsorSegment(start_seconds=10.0, end_seconds=30.0, category="sponsor", uuid="1"),
            SponsorSegment(start_seconds=100.0, end_seconds=120.0, category="selfpromo", uuid="2"),
        ]

        result = calculate_content_duration(600.0, sponsors)

        # 600 - (20 + 20) = 560
        assert result == 560.0

    def test_sponsors_longer_than_video(self):
        """Test edge case where sponsors exceed video duration."""
        sponsors = [
            SponsorSegment(start_seconds=0.0, end_seconds=700.0, category="sponsor", uuid="1"),
        ]

        result = calculate_content_duration(600.0, sponsors)

        # Should not go negative
        assert result == 0.0

    def test_zero_total_duration(self):
        """Test with zero total duration."""
        result = calculate_content_duration(0.0, [])

        assert result == 0.0


class TestSponsorSegmentsToDict:
    """Tests for sponsor_segments_to_dict function."""

    def test_empty_list(self):
        """Test with empty segment list."""
        result = sponsor_segments_to_dict([])

        assert result == []

    def test_converts_segments(self):
        """Test converting segments to dict format."""
        segments = [
            SponsorSegment(start_seconds=10.5, end_seconds=30.2, category="sponsor", uuid="1"),
            SponsorSegment(start_seconds=100.0, end_seconds=115.0, category="selfpromo", uuid="2"),
        ]

        result = sponsor_segments_to_dict(segments)

        assert len(result) == 2
        assert result[0] == {
            "startSeconds": 10.5,
            "endSeconds": 30.2,
            "category": "sponsor",
        }
        assert result[1] == {
            "startSeconds": 100.0,
            "endSeconds": 115.0,
            "category": "selfpromo",
        }

    def test_excludes_uuid(self):
        """Test that UUID is not included in output."""
        segments = [
            SponsorSegment(start_seconds=10.0, end_seconds=20.0, category="sponsor", uuid="secret"),
        ]

        result = sponsor_segments_to_dict(segments)

        assert "uuid" not in result[0]
        assert "UUID" not in result[0]


class TestSkipCategories:
    """Tests for SKIP_CATEGORIES constant."""

    def test_includes_expected_categories(self):
        """Test that all expected categories are included."""
        expected = ["sponsor", "selfpromo", "intro", "outro", "interaction"]

        for category in expected:
            assert category in SKIP_CATEGORIES

    def test_no_unexpected_categories(self):
        """Test no unexpected categories are included."""
        valid_categories = {"sponsor", "selfpromo", "intro", "outro", "interaction"}

        for category in SKIP_CATEGORIES:
            assert category in valid_categories
