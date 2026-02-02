"""Tests for YouTube service (youtube.py).

Tests video data extraction, persona detection, and error handling.
"""

import json
import pytest
from unittest.mock import patch, MagicMock, AsyncMock

from src.services.youtube import (
    VideoData,
    VideoContext,
    Chapter,
    SubtitleSegment,
    extract_video_data,
    extract_video_context,
    _determine_persona,
    _extract_hashtags,
    _build_display_tags,
    _parse_chapters,
    _clean_subtitle_text,
    _load_persona_rules,
)
from src.models.schemas import ErrorCode
from src.exceptions import TranscriptError


class TestExtractHashtags:
    """Tests for hashtag extraction from description."""

    def test_extracts_single_hashtag(self):
        """Test extracting a single hashtag."""
        result = _extract_hashtags("Check out #python today!")
        assert result == ["python"]

    def test_extracts_multiple_hashtags(self):
        """Test extracting multiple hashtags."""
        result = _extract_hashtags("Learn #python and #javascript #webdev")
        assert result == ["python", "javascript", "webdev"]

    def test_returns_lowercase(self):
        """Test hashtags are lowercased."""
        result = _extract_hashtags("#Python #JAVASCRIPT")
        assert result == ["python", "javascript"]

    def test_empty_description(self):
        """Test empty description returns empty list."""
        result = _extract_hashtags("")
        assert result == []

    def test_no_hashtags(self):
        """Test description without hashtags."""
        result = _extract_hashtags("This is a description without hashtags.")
        assert result == []

    def test_none_description(self):
        """Test None description returns empty list."""
        result = _extract_hashtags(None)
        assert result == []


class TestDeterminePersona:
    """Tests for persona detection based on category and tags."""

    @patch("src.services.youtube._load_persona_rules")
    def test_detects_code_persona(self, mock_rules):
        """Test detecting code persona from category and keywords."""
        mock_rules.return_value = {
            "personas": {
                "code": {
                    "keywords": ["python", "javascript", "programming", "tutorial"],
                    "categories": ["Science & Technology", "Education"],
                },
            },
            "default_persona": "standard",
        }

        result = _determine_persona(
            category="Science & Technology",
            tags=["python", "coding"],
            hashtags=["programming"],
        )
        assert result == "code"

    @patch("src.services.youtube._load_persona_rules")
    def test_detects_recipe_persona(self, mock_rules):
        """Test detecting recipe persona from category and keywords."""
        mock_rules.return_value = {
            "personas": {
                "recipe": {
                    "keywords": ["recipe", "cooking", "food", "baking"],
                    "categories": ["Howto & Style", "People & Blogs"],
                },
            },
            "default_persona": "standard",
        }

        result = _determine_persona(
            category="Howto & Style",
            tags=["recipe", "dinner"],
            hashtags=["cooking"],
        )
        assert result == "recipe"

    @patch("src.services.youtube._load_persona_rules")
    def test_defaults_to_standard_persona(self, mock_rules):
        """Test defaulting to standard when no match."""
        mock_rules.return_value = {
            "personas": {
                "code": {
                    "keywords": ["python"],
                    "categories": ["Science & Technology"],
                },
            },
            "default_persona": "standard",
        }

        result = _determine_persona(
            category="Entertainment",
            tags=["music", "fun"],
            hashtags=[],
        )
        assert result == "standard"

    @patch("src.services.youtube._load_persona_rules")
    def test_requires_both_category_and_keyword(self, mock_rules):
        """Test that persona requires both matching category and keyword."""
        mock_rules.return_value = {
            "personas": {
                "code": {
                    "keywords": ["python"],
                    "categories": ["Science & Technology"],
                },
            },
            "default_persona": "standard",
        }

        # Has category but no matching keyword
        result = _determine_persona(
            category="Science & Technology",
            tags=["unrelated"],
            hashtags=[],
        )
        assert result == "standard"

        # Has keyword but no matching category
        result = _determine_persona(
            category="Entertainment",
            tags=["python"],
            hashtags=[],
        )
        assert result == "standard"


class TestBuildDisplayTags:
    """Tests for building display tags from video metadata."""

    def test_builds_tags_from_video_tags(self):
        """Test building display tags from video tags."""
        result = _build_display_tags(
            tags=["Python", "Programming", "Tutorial"],
            hashtags=[],
            max_tags=6,
        )
        assert result == ["Python", "Programming", "Tutorial"]

    def test_builds_tags_from_hashtags(self):
        """Test building display tags from hashtags."""
        result = _build_display_tags(
            tags=[],
            hashtags=["python", "code"],
            max_tags=6,
        )
        # Hashtags are capitalized
        assert result == ["Python", "Code"]

    def test_deduplicates_tags(self):
        """Test that duplicate tags are removed."""
        result = _build_display_tags(
            tags=["Python", "python", "PYTHON"],
            hashtags=["python"],
            max_tags=6,
        )
        assert result == ["Python"]

    def test_respects_max_tags(self):
        """Test that max_tags limit is respected."""
        result = _build_display_tags(
            tags=["Tag1", "Tag2", "Tag3", "Tag4", "Tag5", "Tag6", "Tag7", "Tag8"],
            hashtags=[],
            max_tags=6,
        )
        assert len(result) == 6

    def test_filters_short_tags(self):
        """Test that short tags are filtered out."""
        result = _build_display_tags(
            tags=["AI", "Go", "Python", "JS"],
            hashtags=[],
            min_length=3,
        )
        assert result == ["Python"]


class TestParseChapters:
    """Tests for parsing chapters from yt-dlp info dict."""

    def test_parses_chapters(self):
        """Test parsing chapters with valid data."""
        info = {
            "chapters": [
                {"start_time": 0, "end_time": 60, "title": "Introduction"},
                {"start_time": 60, "end_time": 180, "title": "Main Content"},
                {"start_time": 180, "end_time": 300, "title": "Conclusion"},
            ]
        }
        chapters = _parse_chapters(info)

        assert len(chapters) == 3
        assert chapters[0].start_time == 0.0
        assert chapters[0].end_time == 60.0
        assert chapters[0].title == "Introduction"
        assert chapters[1].title == "Main Content"

    def test_handles_missing_chapters(self):
        """Test handling missing chapters gracefully."""
        info = {}
        chapters = _parse_chapters(info)
        assert chapters == []

    def test_handles_empty_chapters(self):
        """Test handling empty chapters list."""
        info = {"chapters": []}
        chapters = _parse_chapters(info)
        assert chapters == []

    def test_handles_missing_fields(self):
        """Test handling chapters with missing fields."""
        info = {
            "chapters": [
                {"start_time": 0, "title": "Intro"},  # Missing end_time
                {"start_time": 60},  # Missing end_time and title
            ]
        }
        chapters = _parse_chapters(info)

        assert len(chapters) == 2
        assert chapters[0].end_time == 0.0  # Defaults to start_time
        assert chapters[1].title == "Untitled"


class TestCleanSubtitleText:
    """Tests for cleaning subtitle text artifacts."""

    def test_removes_music_annotations(self):
        """Test removing [Music] annotations."""
        result = _clean_subtitle_text("Hello [Music] World")
        assert result == "Hello World"

    def test_removes_applause_annotations(self):
        """Test removing [Applause] annotations."""
        result = _clean_subtitle_text("Thank you [Applause] everyone")
        assert result == "Thank you everyone"

    def test_removes_music_notes(self):
        """Test removing music notes."""
        result = _clean_subtitle_text("Hello world")
        assert result == "Hello world"

    def test_normalizes_whitespace(self):
        """Test normalizing excessive whitespace."""
        result = _clean_subtitle_text("Hello    world   test")
        assert result == "Hello world test"

    def test_case_insensitive(self):
        """Test case-insensitive removal of annotations."""
        result = _clean_subtitle_text("[MUSIC] test [music] [MuSiC]")
        assert result == "test"


class TestExtractVideoContext:
    """Tests for extracting video context from yt-dlp info."""

    @patch("src.services.youtube._load_persona_rules")
    def test_extracts_context(self, mock_rules):
        """Test extracting full video context."""
        mock_rules.return_value = {
            "personas": {
                "code": {
                    "keywords": ["python", "programming"],
                    "categories": ["Science & Technology"],
                },
            },
            "default_persona": "standard",
        }

        info = {
            "categories": ["Science & Technology"],
            "tags": ["Python", "Tutorial", "Programming"],
        }
        description = "Learn Python #programming #tutorial"

        context = extract_video_context(info, description)

        assert context.youtube_category == "Science & Technology"
        assert context.persona == "code"
        assert "Python" in context.tags
        assert len(context.display_tags) <= 6

    @patch("src.services.youtube._load_persona_rules")
    def test_handles_missing_category(self, mock_rules):
        """Test handling videos without category."""
        mock_rules.return_value = {
            "personas": {},
            "default_persona": "standard",
        }

        info = {"tags": ["video"]}
        context = extract_video_context(info, "")

        assert context.youtube_category is None
        assert context.persona == "standard"


class TestVideoDataClass:
    """Tests for VideoData dataclass methods."""

    def test_has_chapters_true(self):
        """Test has_chapters returns True when chapters exist."""
        video = VideoData(
            video_id="test123",
            title="Test",
            channel="Test Channel",
            duration=300,
            thumbnail_url=None,
            description="",
            chapters=[Chapter(start_time=0, end_time=60, title="Intro")],
            subtitles=[],
        )
        assert video.has_chapters is True

    def test_has_chapters_false(self):
        """Test has_chapters returns False when no chapters."""
        video = VideoData(
            video_id="test123",
            title="Test",
            channel="Test Channel",
            duration=300,
            thumbnail_url=None,
            description="",
            chapters=[],
            subtitles=[],
        )
        assert video.has_chapters is False

    def test_transcript_text(self):
        """Test transcript_text joins subtitle segments."""
        video = VideoData(
            video_id="test123",
            title="Test",
            channel="Test Channel",
            duration=300,
            thumbnail_url=None,
            description="",
            chapters=[],
            subtitles=[
                SubtitleSegment(text="Hello", start=0, duration=1),
                SubtitleSegment(text="world", start=1, duration=1),
            ],
        )
        assert video.transcript_text == "Hello world"

    def test_get_chapter_transcript(self):
        """Test getting transcript for specific chapter."""
        video = VideoData(
            video_id="test123",
            title="Test",
            channel="Test Channel",
            duration=300,
            thumbnail_url=None,
            description="",
            chapters=[
                Chapter(start_time=0, end_time=10, title="Intro"),
                Chapter(start_time=10, end_time=20, title="Main"),
            ],
            subtitles=[
                SubtitleSegment(text="Hello", start=0, duration=5),
                SubtitleSegment(text="intro", start=5, duration=5),
                SubtitleSegment(text="main", start=10, duration=5),
                SubtitleSegment(text="content", start=15, duration=5),
            ],
        )

        intro_transcript = video.get_chapter_transcript(0)
        assert intro_transcript == "Hello intro"

        main_transcript = video.get_chapter_transcript(1)
        assert main_transcript == "main content"

    def test_get_chapter_transcript_invalid_index(self):
        """Test getting transcript for invalid chapter index."""
        video = VideoData(
            video_id="test123",
            title="Test",
            channel="Test Channel",
            duration=300,
            thumbnail_url=None,
            description="",
            chapters=[],
            subtitles=[],
        )
        assert video.get_chapter_transcript(0) == ""
        assert video.get_chapter_transcript(-1) == ""


class TestExtractVideoDataAsync:
    """Tests for async video data extraction."""

    @pytest.fixture
    def sample_yt_dlp_info(self):
        """Sample yt-dlp info dict."""
        return {
            "id": "test123",
            "title": "Test Video",
            "uploader": "Test Channel",
            "duration": 300,
            "description": "Test description #python",
            "upload_date": "20240101",
            "categories": ["Science & Technology"],
            "tags": ["python", "tutorial"],
            "thumbnails": [{"url": "https://example.com/thumb.jpg"}],
            "chapters": [
                {"start_time": 0, "end_time": 60, "title": "Intro"},
            ],
            "automatic_captions": {},
            "subtitles": {},
        }

    @patch("src.services.youtube._extract_video_data_sync")
    async def test_extracts_video_data(self, mock_extract):
        """Test async extraction wrapper."""
        mock_extract.return_value = VideoData(
            video_id="test123",
            title="Test Video",
            channel="Test Channel",
            duration=300,
            thumbnail_url="https://example.com/thumb.jpg",
            description="Test",
            chapters=[],
            subtitles=[],
        )

        result = await extract_video_data("test123")

        assert result.video_id == "test123"
        assert result.title == "Test Video"
        mock_extract.assert_called_once_with("test123")

    @patch("src.services.youtube._extract_with_retry")
    @patch("src.services.youtube._load_persona_rules")
    def test_raises_error_on_unavailable_video(self, mock_rules, mock_extract):
        """Test error handling for unavailable video."""
        mock_rules.return_value = {"personas": {}, "default_persona": "standard"}
        mock_extract.return_value = None

        from src.services.youtube import _extract_video_data_sync

        with pytest.raises(TranscriptError) as exc_info:
            _extract_video_data_sync("invalid_id")

        assert exc_info.value.code == ErrorCode.VIDEO_UNAVAILABLE

    @patch("src.services.youtube._extract_with_retry")
    @patch("src.services.youtube._load_persona_rules")
    def test_raises_error_on_live_stream(self, mock_rules, mock_extract):
        """Test error handling for live streams."""
        mock_rules.return_value = {"personas": {}, "default_persona": "standard"}
        mock_extract.return_value = {"is_live": True}

        from src.services.youtube import _extract_video_data_sync

        with pytest.raises(TranscriptError) as exc_info:
            _extract_video_data_sync("live_stream_id")

        assert exc_info.value.code == ErrorCode.LIVE_STREAM

    @patch("src.services.youtube._extract_with_retry")
    @patch("src.services.youtube._load_persona_rules")
    def test_handles_missing_metadata(self, mock_rules, mock_extract, sample_yt_dlp_info):
        """Test handling missing optional metadata."""
        mock_rules.return_value = {"personas": {}, "default_persona": "standard"}
        # Remove optional fields
        sample_yt_dlp_info.pop("uploader")
        sample_yt_dlp_info.pop("thumbnails")
        sample_yt_dlp_info["channel"] = "Fallback Channel"
        mock_extract.return_value = sample_yt_dlp_info

        from src.services.youtube import _extract_video_data_sync

        result = _extract_video_data_sync("test123")

        assert result.channel == "Fallback Channel"
        # Should use default YouTube thumbnail URL
        assert "img.youtube.com" in result.thumbnail_url


class TestRateLimitHandling:
    """Tests for rate limit detection and retry behavior."""

    @patch("src.services.youtube._extract_with_retry")
    @patch("src.services.youtube._load_persona_rules")
    def test_retries_with_proxy_on_failure(self, mock_rules, mock_extract):
        """Test retry with proxy fallback."""
        mock_rules.return_value = {"personas": {}, "default_persona": "standard"}

        # Define test data inline
        sample_yt_dlp_info = {
            "id": "test123",
            "title": "Test Video",
            "uploader": "Test Channel",
            "duration": 300,
            "description": "Test description",
            "categories": [],
            "tags": [],
            "thumbnails": [{"url": "https://example.com/thumb.jpg"}],
            "chapters": [],
            "automatic_captions": {},
            "subtitles": {},
        }
        mock_extract.side_effect = [
            ConnectionError("Connection failed"),
            sample_yt_dlp_info,
        ]

        from src.services.youtube import _extract_video_data_sync

        result = _extract_video_data_sync("test123")

        assert result.video_id == "test123"
        assert mock_extract.call_count == 2
