"""Tests for YouTube service (youtube.py).

Tests video data extraction, persona detection, and error handling.
"""

import json
import pytest
from unittest.mock import patch, MagicMock, AsyncMock

from src.services.video.youtube import (
    VALID_CATEGORIES,
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
    _detect_category,
    select_persona,
    _load_category_rules,
    classify_category_with_llm,
    get_llm_fallback_threshold,
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

    @patch("src.services.video.youtube._load_persona_rules")
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

    @patch("src.services.video.youtube._load_persona_rules")
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

    @patch("src.services.video.youtube._load_persona_rules")
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

    @patch("src.services.video.youtube._load_persona_rules")
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

    @patch("src.services.video.youtube._load_category_rules")
    @patch("src.services.video.youtube._load_persona_rules")
    def test_extracts_context(self, mock_persona_rules, mock_category_rules):
        """Test extracting full video context."""
        mock_persona_rules.return_value = {
            "personas": {
                "code": {
                    "keywords": ["python", "programming"],
                    "categories": ["Science & Technology"],
                },
            },
            "default_persona": "standard",
        }
        mock_category_rules.return_value = {
            "detection_config": {
                "llm_fallback_threshold": 0.4,
                "weights": {
                    "keywords": 0.40,
                    "youtube_category": 0.30,
                    "title": 0.15,
                    "channel": 0.15,
                },
            },
            "categories": {
                "coding": {
                    "keywords": {
                        "primary": ["python", "programming"],
                        "secondary": ["tutorial"],
                    },
                    "youtube_categories": {
                        "primary": ["Science & Technology"],
                        "secondary": ["Education"],
                    },
                    "channel_patterns": [],
                    "title_patterns": ["tutorial"],
                },
            },
            "default_category": "standard",
        }

        info = {
            "categories": ["Science & Technology"],
            "tags": ["Python", "Tutorial", "Programming"],
        }
        description = "Learn Python #programming #tutorial"

        context = extract_video_context(info, description)

        assert context.youtube_category == "Science & Technology"
        assert context.category == "coding"
        assert context.persona == "code"
        assert "Python" in context.tags
        assert len(context.display_tags) <= 6

    @patch("src.services.video.youtube._load_category_rules")
    @patch("src.services.video.youtube._load_persona_rules")
    def test_handles_missing_category(self, mock_persona_rules, mock_category_rules):
        """Test handling videos without category."""
        mock_persona_rules.return_value = {
            "personas": {},
            "default_persona": "standard",
        }
        mock_category_rules.return_value = {
            "detection_config": {
                "llm_fallback_threshold": 0.4,
                "weights": {
                    "keywords": 0.40,
                    "youtube_category": 0.30,
                    "title": 0.15,
                    "channel": 0.15,
                },
            },
            "categories": {},
            "default_category": "standard",
        }

        info = {"tags": ["video"]}
        context = extract_video_context(info, "")

        assert context.youtube_category is None
        assert context.category == "standard"
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

    @patch("src.services.video.youtube._extract_video_data_sync")
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

    @patch("src.services.video.youtube._extract_with_retry")
    @patch("src.services.video.youtube._load_persona_rules")
    def test_raises_error_on_unavailable_video(self, mock_rules, mock_extract):
        """Test error handling for unavailable video."""
        mock_rules.return_value = {"personas": {}, "default_persona": "standard"}
        mock_extract.return_value = None

        from src.services.video.youtube import _extract_video_data_sync

        with pytest.raises(TranscriptError) as exc_info:
            _extract_video_data_sync("invalid_id")

        assert exc_info.value.code == ErrorCode.VIDEO_UNAVAILABLE

    @patch("src.services.video.youtube._extract_with_retry")
    @patch("src.services.video.youtube._load_persona_rules")
    def test_raises_error_on_live_stream(self, mock_rules, mock_extract):
        """Test error handling for live streams."""
        mock_rules.return_value = {"personas": {}, "default_persona": "standard"}
        mock_extract.return_value = {"is_live": True}

        from src.services.video.youtube import _extract_video_data_sync

        with pytest.raises(TranscriptError) as exc_info:
            _extract_video_data_sync("live_stream_id")

        assert exc_info.value.code == ErrorCode.LIVE_STREAM

    @patch("src.services.video.youtube._extract_with_retry")
    @patch("src.services.video.youtube._load_persona_rules")
    def test_handles_missing_metadata(self, mock_rules, mock_extract, sample_yt_dlp_info):
        """Test handling missing optional metadata."""
        mock_rules.return_value = {"personas": {}, "default_persona": "standard"}
        # Remove optional fields
        sample_yt_dlp_info.pop("uploader")
        sample_yt_dlp_info.pop("thumbnails")
        sample_yt_dlp_info["channel"] = "Fallback Channel"
        mock_extract.return_value = sample_yt_dlp_info

        from src.services.video.youtube import _extract_video_data_sync

        result = _extract_video_data_sync("test123")

        assert result.channel == "Fallback Channel"
        # Should use default YouTube thumbnail URL
        assert "img.youtube.com" in result.thumbnail_url


class TestRateLimitHandling:
    """Tests for rate limit detection and retry behavior."""

    @patch("src.services.video.youtube._extract_with_retry")
    @patch("src.services.video.youtube._load_persona_rules")
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

        from src.services.video.youtube import _extract_video_data_sync

        result = _extract_video_data_sync("test123")

        assert result.video_id == "test123"
        assert mock_extract.call_count == 2


class TestDetectCategory:
    """Tests for weighted category detection."""

    @patch("src.services.video.youtube._load_category_rules")
    def test_detects_cooking_from_keywords(self, mock_rules):
        """Test detecting cooking category from strong keywords."""
        mock_rules.return_value = {
            "detection_config": {
                "llm_fallback_threshold": 0.4,
                "weights": {
                    "keywords": 0.40,
                    "youtube_category": 0.30,
                    "title": 0.15,
                    "channel": 0.15,
                },
            },
            "categories": {
                "cooking": {
                    "keywords": {
                        "primary": ["recipe", "cooking"],
                        "secondary": ["food", "baking"],
                    },
                    "youtube_categories": {
                        "primary": ["Howto & Style"],
                        "secondary": ["Entertainment"],
                    },
                    "channel_patterns": ["jamie oliver"],
                    "title_patterns": ["recipe"],
                },
            },
            "default_category": "standard",
        }

        # Jamie Oliver video with Entertainment category (not primary)
        category, confidence = _detect_category(
            youtube_category="Entertainment",
            tags=["recipe", "cooking", "food"],
            hashtags=["recipe"],
            channel="Jamie Oliver",
            title="Easy Recipe for Dinner",
        )

        assert category == "cooking"
        assert confidence > 0.4  # Above threshold

    @patch("src.services.video.youtube._load_category_rules")
    def test_detects_coding_category(self, mock_rules):
        """Test detecting coding category."""
        mock_rules.return_value = {
            "detection_config": {
                "llm_fallback_threshold": 0.4,
                "weights": {
                    "keywords": 0.40,
                    "youtube_category": 0.30,
                    "title": 0.15,
                    "channel": 0.15,
                },
            },
            "categories": {
                "coding": {
                    "keywords": {
                        "primary": ["programming", "coding", "python"],
                        "secondary": ["javascript", "api"],
                    },
                    "youtube_categories": {
                        "primary": ["Science & Technology"],
                        "secondary": ["Education"],
                    },
                    "channel_patterns": ["fireship"],
                    "title_patterns": ["tutorial", "crash course"],
                },
            },
            "default_category": "standard",
        }

        category, confidence = _detect_category(
            youtube_category="Science & Technology",
            tags=["python", "programming"],
            hashtags=["coding"],
            channel="Some Channel",
            title="Python Tutorial",
        )

        assert category == "coding"
        assert confidence > 0.5

    @patch("src.services.video.youtube._load_category_rules")
    def test_defaults_to_standard_with_low_confidence(self, mock_rules):
        """Test defaulting to standard when no strong match."""
        mock_rules.return_value = {
            "detection_config": {
                "llm_fallback_threshold": 0.4,
                "weights": {
                    "keywords": 0.40,
                    "youtube_category": 0.30,
                    "title": 0.15,
                    "channel": 0.15,
                },
            },
            "categories": {
                "cooking": {
                    "keywords": {
                        "primary": ["recipe"],
                        "secondary": ["food"],
                    },
                    "youtube_categories": {
                        "primary": ["Howto & Style"],
                        "secondary": [],
                    },
                    "channel_patterns": [],
                    "title_patterns": [],
                },
            },
            "default_category": "standard",
        }

        category, confidence = _detect_category(
            youtube_category="Entertainment",
            tags=["funny", "comedy"],
            hashtags=[],
            channel="Random Channel",
            title="Funny Video",
        )

        assert category == "standard"
        assert confidence < 0.4

    @patch("src.services.video.youtube._load_category_rules")
    def test_channel_pattern_matching(self, mock_rules):
        """Test channel pattern contributes to score."""
        mock_rules.return_value = {
            "detection_config": {
                "llm_fallback_threshold": 0.4,
                "weights": {
                    "keywords": 0.40,
                    "youtube_category": 0.30,
                    "title": 0.15,
                    "channel": 0.15,
                },
            },
            "categories": {
                "cooking": {
                    "keywords": {"primary": [], "secondary": []},
                    "youtube_categories": {"primary": [], "secondary": []},
                    "channel_patterns": ["gordon ramsay"],
                    "title_patterns": [],
                },
            },
            "default_category": "standard",
        }

        # Only channel matches, gets 0.15 score
        category, confidence = _detect_category(
            youtube_category="Entertainment",
            tags=[],
            hashtags=[],
            channel="Gordon Ramsay",
            title="Kitchen Nightmares",
        )

        # Should detect cooking from channel alone
        assert category == "cooking"
        assert confidence == pytest.approx(0.15, abs=0.01)


class TestSelectPersona:
    """Tests for category to persona mapping."""

    def test_maps_cooking_to_recipe(self):
        """Test cooking category maps to recipe persona."""
        persona = select_persona("cooking")
        assert persona == "recipe"

    def test_maps_coding_to_code(self):
        """Test coding category maps to code persona."""
        persona = select_persona("coding")
        assert persona == "code"

    def test_maps_reviews_to_review(self):
        """Test reviews category maps to review persona."""
        persona = select_persona("reviews")
        assert persona == "review"

    def test_maps_standard_to_standard(self):
        """Test standard category stays standard."""
        persona = select_persona("standard")
        assert persona == "standard"

    def test_unknown_category_defaults_to_standard(self):
        """Test unknown categories default to standard."""
        persona = select_persona("unknown_category")
        assert persona == "standard"

    def test_maps_education_to_education(self):
        """Test education category maps to education persona."""
        persona = select_persona("education")
        assert persona == "education"


class TestClassifyCategoryWithLLM:
    """Tests for LLM-based category classification."""

    @pytest.fixture
    def mock_llm_provider(self):
        """Mock LLM provider."""
        provider = AsyncMock()
        provider.complete_fast = AsyncMock()
        return provider

    async def test_returns_valid_category(self, mock_llm_provider):
        """Test LLM returns valid category."""
        mock_llm_provider.complete_fast.return_value = "cooking"

        result = await classify_category_with_llm(
            title="Easy Pasta Recipe",
            channel="Cooking Channel",
            tags=["recipe", "pasta"],
            description="Learn to make delicious pasta",
            llm_provider=mock_llm_provider,
        )

        assert result == "cooking"
        mock_llm_provider.complete_fast.assert_called_once()

    async def test_normalizes_category_case(self, mock_llm_provider):
        """Test LLM response is normalized to lowercase."""
        mock_llm_provider.complete_fast.return_value = "CODING"

        result = await classify_category_with_llm(
            title="Python Tutorial",
            channel="Tech Channel",
            tags=["python", "coding"],
            description="Learn Python",
            llm_provider=mock_llm_provider,
        )

        assert result == "coding"

    async def test_strips_whitespace(self, mock_llm_provider):
        """Test LLM response whitespace is stripped."""
        mock_llm_provider.complete_fast.return_value = "  cooking  \n"

        result = await classify_category_with_llm(
            title="Recipe Video",
            channel="Food Channel",
            tags=["recipe"],
            description="Cooking tutorial",
            llm_provider=mock_llm_provider,
        )

        assert result == "cooking"

    async def test_returns_standard_on_invalid_response(self, mock_llm_provider):
        """Test returns standard when LLM gives invalid category."""
        mock_llm_provider.complete_fast.return_value = "invalid_category"

        result = await classify_category_with_llm(
            title="Random Video",
            channel="Channel",
            tags=[],
            description="Some video",
            llm_provider=mock_llm_provider,
        )

        assert result == "standard"

    async def test_returns_standard_on_exception(self, mock_llm_provider):
        """Test returns standard when LLM call fails."""
        mock_llm_provider.complete_fast.side_effect = Exception("API Error")

        result = await classify_category_with_llm(
            title="Test Video",
            channel="Channel",
            tags=[],
            description="Test",
            llm_provider=mock_llm_provider,
        )

        assert result == "standard"

    async def test_music_is_valid_llm_category(self, mock_llm_provider):
        """Test that LLM can return 'music' as a valid category."""
        mock_llm_provider.complete_fast.return_value = "music"

        result = await classify_category_with_llm(
            title="Official Music Video",
            channel="VEVO",
            tags=["music", "official video"],
            description="Official music video",
            llm_provider=mock_llm_provider,
        )

        assert result == "music"


def _base_music_rules(**category_overrides):
    """Build a category rules dict with sensible music defaults.

    Pass ``categories`` (or any other top-level key) as a keyword argument
    to override only that part of the structure.
    """
    base = {
        "detection_config": {
            "llm_fallback_threshold": 0.4,
            "weights": {
                "keywords": 0.40,
                "youtube_category": 0.30,
                "title": 0.15,
                "channel": 0.15,
            },
        },
        "categories": {
            "music": {
                "keywords": {
                    "primary": ["music", "song", "official video"],
                    "secondary": ["remix", "cover"],
                },
                "youtube_categories": {
                    "primary": ["Music"],
                    "secondary": ["Entertainment"],
                },
                "channel_patterns": [],
                "title_patterns": ["official video"],
            },
        },
        "default_category": "standard",
    }
    base.update(category_overrides)
    return base


class TestMusicCategoryDetection:
    """Tests for Phase 2: Music category detection."""

    def test_music_in_valid_categories(self):
        """Test that 'music' is in VALID_CATEGORIES."""
        assert "music" in VALID_CATEGORIES

    def test_music_persona_mapping(self):
        """Test that music category maps to music persona."""
        persona = select_persona("music")
        assert persona == "music"

    @patch("src.services.video.youtube._load_category_rules")
    def test_detects_music_from_youtube_category(self, mock_rules):
        """Test detecting music from YouTube Music category."""
        mock_rules.return_value = _base_music_rules(
            categories={
                "music": {
                    "keywords": {
                        "primary": ["music", "song", "album", "official video", "lyrics"],
                        "secondary": ["remix", "cover", "acoustic", "feat", "ft"],
                    },
                    "youtube_categories": {
                        "primary": ["Music"],
                        "secondary": ["Entertainment"],
                    },
                    "channel_patterns": ["vevo"],
                    "title_patterns": ["official (music )?video", "lyrics"],
                },
            },
        )

        category, confidence = _detect_category(
            youtube_category="Music",
            tags=["music", "song", "official video"],
            hashtags=["music"],
            channel="ArtistVEVO",
            title="Artist - Song (Official Music Video)",
        )

        assert category == "music"
        assert confidence > 0.4

    @patch("src.services.video.youtube._load_category_rules")
    def test_detects_music_from_title_pattern(self, mock_rules):
        """Test detecting music from title with 'ft.' pattern."""
        mock_rules.return_value = _base_music_rules(
            categories={
                "music": {
                    "keywords": {
                        "primary": ["music", "song", "official video"],
                        "secondary": ["feat", "ft"],
                    },
                    "youtube_categories": {
                        "primary": ["Music"],
                        "secondary": ["Entertainment"],
                    },
                    "channel_patterns": [],
                    "title_patterns": ["\\bft\\.?\\b", "\\bfeat\\.?\\b"],
                },
            },
        )

        category, confidence = _detect_category(
            youtube_category="Music",
            tags=["music", "song"],
            hashtags=[],
            title="Artist ft. Another - Song Title",
        )

        assert category == "music"
        assert confidence > 0.3

    @patch("src.services.video.youtube._load_category_rules")
    def test_music_review_not_detected_as_music(self, mock_rules):
        """Test that a music review video is NOT detected as music."""
        mock_rules.return_value = _base_music_rules(
            categories={
                "reviews": {
                    "keywords": {
                        "primary": ["review", "unboxing", "comparison"],
                        "secondary": ["test", "rating", "impressions"],
                    },
                    "youtube_categories": {
                        "primary": ["Science & Technology"],
                        "secondary": ["Gaming"],
                    },
                    "channel_patterns": [],
                    "title_patterns": ["review"],
                },
                "music": {
                    "keywords": {
                        "primary": ["music", "song", "official video"],
                        "secondary": ["remix", "cover"],
                    },
                    "youtube_categories": {
                        "primary": ["Music"],
                        "secondary": ["Entertainment"],
                    },
                    "channel_patterns": [],
                    "title_patterns": ["official video"],
                },
            },
        )

        category, _ = _detect_category(
            youtube_category="Entertainment",
            tags=["review", "album review", "rating"],
            hashtags=["review"],
            title="Album Review: Artist's New Album",
        )

        assert category == "reviews"


class TestGetLLMFallbackThreshold:
    """Tests for LLM fallback threshold retrieval."""

    @patch("src.services.video.youtube._load_category_rules")
    def test_returns_threshold_from_config(self, mock_rules):
        """Test returning threshold from configuration."""
        mock_rules.return_value = {
            "detection_config": {
                "llm_fallback_threshold": 0.35,
            },
        }

        threshold = get_llm_fallback_threshold()
        assert threshold == 0.35

    @patch("src.services.video.youtube._load_category_rules")
    def test_returns_default_on_missing_config(self, mock_rules):
        """Test returning default threshold when config is missing."""
        mock_rules.return_value = {}

        threshold = get_llm_fallback_threshold()
        assert threshold == 0.4  # Default value
