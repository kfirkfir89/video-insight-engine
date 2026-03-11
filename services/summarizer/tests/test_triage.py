"""Tests for triage pipeline stage."""

import json
import pytest
from unittest.mock import AsyncMock, MagicMock

from src.services.pipeline.triage import (
    run_triage,
    _parse_triage_response,
    _build_fallback,
    _validate_tags,
    CONFIDENCE_THRESHOLD,
    TriageResult,
)
from src.models.domain_types import VALID_CONTENT_TAGS, VALID_MODIFIERS


@pytest.fixture
def mock_llm():
    """Mock LLM service with call_llm method."""
    service = MagicMock()
    service.call_llm = AsyncMock()
    return service


class TestRunTriage:
    """Test run_triage function."""

    @pytest.mark.asyncio
    async def test_returns_triage_result_for_valid_response(self, mock_llm):
        mock_llm.call_llm.return_value = json.dumps({
            "contentTags": ["travel"],
            "modifiers": ["finance"],
            "primaryTag": "travel",
            "userGoal": "Plan a trip to Japan",
            "confidence": 0.92,
            "tabs": [
                {"id": "itinerary", "label": "Itinerary", "emoji": "🗺️", "dataSource": "travel.itinerary"},
                {"id": "budget", "label": "Budget", "emoji": "💰", "dataSource": "finance.budget"},
            ],
        })

        result = await run_triage(
            title="Japan Travel Guide",
            description="A complete guide to Japan",
            duration=1200,
            transcript_preview="Today we're exploring Tokyo...",
            category_hint="travel",
            llm_service=mock_llm,
        )

        assert result.content_tags == ["travel"]
        assert result.modifiers == ["finance"]
        assert result.primary_tag == "travel"
        assert result.user_goal == "Plan a trip to Japan"
        assert result.confidence == 0.92
        assert len(result.tabs) == 2

    @pytest.mark.asyncio
    async def test_falls_back_on_low_confidence(self, mock_llm):
        mock_llm.call_llm.return_value = json.dumps({
            "contentTags": ["travel"],
            "modifiers": [],
            "primaryTag": "travel",
            "userGoal": "Not sure",
            "confidence": 0.3,
            "tabs": [],

        })

        result = await run_triage(
            title="Random Video",
            description="Unknown content",
            duration=600,
            transcript_preview="Hello...",
            category_hint=None,
            llm_service=mock_llm,
        )

        assert result.primary_tag == "learning"
        assert result.confidence == 0.3

    @pytest.mark.asyncio
    async def test_falls_back_on_json_parse_error(self, mock_llm):
        mock_llm.call_llm.return_value = "This is not JSON"

        result = await run_triage(
            title="Test",
            description="Test",
            duration=300,
            transcript_preview="Test",
            category_hint=None,
            llm_service=mock_llm,
        )

        assert result.primary_tag == "learning"
        assert result.confidence == 0.0

    @pytest.mark.asyncio
    async def test_falls_back_on_llm_error(self, mock_llm):
        mock_llm.call_llm.side_effect = TimeoutError("LLM timeout")

        result = await run_triage(
            title="Test",
            description="Test",
            duration=300,
            transcript_preview="Test",
            category_hint=None,
            llm_service=mock_llm,
        )

        assert result.primary_tag == "learning"
        assert result.confidence == 0.0

    @pytest.mark.asyncio
    async def test_category_hint_fallback(self, mock_llm):
        mock_llm.call_llm.side_effect = TimeoutError("timeout")

        result = await run_triage(
            title="Test",
            description="Test",
            duration=300,
            transcript_preview="Test",
            category_hint="cooking",
            llm_service=mock_llm,
        )

        assert result.primary_tag == "food"
        assert result.content_tags == ["food"]

    @pytest.mark.asyncio
    async def test_truncates_long_inputs(self, mock_llm):
        mock_llm.call_llm.return_value = json.dumps({
            "contentTags": ["learning"],
            "modifiers": [],
            "primaryTag": "learning",
            "userGoal": "Learn stuff",
            "confidence": 0.8,
            "tabs": [{"id": "key_points", "label": "Key Points", "emoji": "💡", "dataSource": "learning.keyPoints"}],

        })

        long_desc = "x" * 5000
        long_transcript = "y" * 10000

        await run_triage(
            title="Test",
            description=long_desc,
            duration=600,
            transcript_preview=long_transcript,
            category_hint=None,
            llm_service=mock_llm,
        )

        call_args = mock_llm.call_llm.call_args
        prompt = call_args[0][0]
        assert "x" * 1001 not in prompt
        assert "y" * 2001 not in prompt


class TestParseTriageResponse:
    """Test _parse_triage_response validation."""

    def test_valid_response(self):
        data = {
            "contentTags": ["travel", "food"],
            "modifiers": ["narrative"],
            "primaryTag": "travel",
            "userGoal": "Plan a trip",
            "confidence": 0.9,
            "tabs": [
                {"id": "itinerary", "label": "Itinerary", "emoji": "🗺️", "dataSource": "travel.itinerary"},
            ],

        }

        result = _parse_triage_response(data)
        assert result.content_tags == ["travel", "food"]
        assert result.modifiers == ["narrative"]
        assert result.primary_tag == "travel"

    def test_filters_invalid_tags(self):
        data = {
            "contentTags": ["travel", "invalid_tag", "food"],
            "modifiers": ["bad_modifier"],
            "primaryTag": "travel",
            "userGoal": "Test",
            "confidence": 0.8,
            "tabs": [],

        }

        result = _parse_triage_response(data)
        assert result.content_tags == ["travel", "food"]
        assert result.modifiers == []

    def test_limits_tags_to_three(self):
        data = {
            "contentTags": ["travel", "food", "tech", "fitness", "music"],
            "modifiers": [],
            "primaryTag": "travel",
            "userGoal": "Test",
            "confidence": 0.8,
            "tabs": [],

        }

        result = _parse_triage_response(data)
        assert len(result.content_tags) <= 3

    def test_limits_modifiers_to_two(self):
        data = {
            "contentTags": ["learning"],
            "modifiers": ["narrative", "finance", "narrative"],
            "primaryTag": "learning",
            "userGoal": "Test",
            "confidence": 0.8,
            "tabs": [],

        }

        result = _parse_triage_response(data)
        assert len(result.modifiers) <= 2

    def test_empty_tags_defaults_to_learning(self):
        data = {
            "contentTags": [],
            "modifiers": [],
            "primaryTag": "",
            "userGoal": "",
            "confidence": 0.5,
            "tabs": [],

        }

        result = _parse_triage_response(data)
        assert result.content_tags == ["learning"]
        assert result.primary_tag == "learning"

    def test_primary_tag_must_be_in_content_tags(self):
        data = {
            "contentTags": ["food"],
            "modifiers": [],
            "primaryTag": "travel",
            "userGoal": "Cook",
            "confidence": 0.8,
            "tabs": [],

        }

        result = _parse_triage_response(data)
        assert result.primary_tag == "food"

    def test_tabs_capped_at_six(self):
        tabs = [{"id": f"tab_{i}", "label": f"Tab {i}", "emoji": "📋", "dataSource": f"data.{i}"} for i in range(10)]
        data = {
            "contentTags": ["learning"],
            "modifiers": [],
            "primaryTag": "learning",
            "userGoal": "Test",
            "confidence": 0.8,
            "tabs": tabs,

        }

        result = _parse_triage_response(data)
        assert len(result.tabs) <= 6

    def test_confidence_clamped(self):
        data = {
            "contentTags": ["learning"],
            "modifiers": [],
            "primaryTag": "learning",
            "userGoal": "Test",
            "confidence": 1.5,
            "tabs": [],

        }

        result = _parse_triage_response(data)
        assert result.confidence == 1.0

    def test_negative_confidence_clamped(self):
        data = {
            "contentTags": ["learning"],
            "modifiers": [],
            "primaryTag": "learning",
            "userGoal": "Test",
            "confidence": -0.5,
            "tabs": [],

        }

        result = _parse_triage_response(data)
        assert result.confidence == 0.0

    def test_invalid_confidence_type(self):
        data = {
            "contentTags": ["learning"],
            "modifiers": [],
            "primaryTag": "learning",
            "userGoal": "Test",
            "confidence": "invalid",
            "tabs": [],

        }

        result = _parse_triage_response(data)
        assert result.confidence == 0.0

    def test_missing_tab_fields_filtered(self):
        data = {
            "contentTags": ["learning"],
            "modifiers": [],
            "primaryTag": "learning",
            "userGoal": "Test",
            "confidence": 0.8,
            "tabs": [
                {"id": "good", "label": "Good Tab"},
                {"no_id": True},
                "not_a_dict",
            ],

        }

        result = _parse_triage_response(data)
        assert len(result.tabs) == 1
        assert result.tabs[0]["id"] == "good"

    def test_empty_tabs_get_defaults(self):
        data = {
            "contentTags": ["food"],
            "modifiers": [],
            "primaryTag": "food",
            "userGoal": "Cook something",
            "confidence": 0.8,
            "tabs": [],

        }

        result = _parse_triage_response(data)
        assert len(result.tabs) > 0
        assert result.tabs[0]["id"] == "ingredients"


class TestBuildFallback:
    """Test _build_fallback helper."""

    def test_default_fallback(self):
        result = _build_fallback()
        assert result.primary_tag == "learning"
        assert result.content_tags == ["learning"]
        assert result.confidence == 0.0
        assert len(result.tabs) > 0

    def test_category_hint_cooking(self):
        result = _build_fallback("cooking")
        assert result.primary_tag == "food"
        assert result.content_tags == ["food"]

    def test_category_hint_fitness(self):
        result = _build_fallback("fitness")
        assert result.primary_tag == "fitness"

    def test_unknown_category(self):
        result = _build_fallback("completely_unknown")
        assert result.primary_tag == "learning"


class TestValidateTags:
    """Test _validate_tags helper."""

    def test_filters_invalid(self):
        result = _validate_tags(["travel", "invalid", "food"], VALID_CONTENT_TAGS, 3)
        assert result == ["travel", "food"]

    def test_limits_count(self):
        result = _validate_tags(["travel", "food", "tech", "music"], VALID_CONTENT_TAGS, 2)
        assert len(result) == 2

    def test_empty_input(self):
        result = _validate_tags([], VALID_CONTENT_TAGS, 3)
        assert result == []
