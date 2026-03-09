"""Tests for intent detection service."""
import json
import pytest
from unittest.mock import AsyncMock, MagicMock

from src.services.pipeline.intent_detector import (
    detect_intent,
    get_canonical_sections,
    CONFIDENCE_THRESHOLD,
    _build_fallback,
    _TYPE_SECTIONS,
)


@pytest.fixture
def mock_llm():
    """Mock LLM service with call_llm method."""
    service = MagicMock()
    service.call_llm = AsyncMock()
    return service


class TestDetectIntent:
    """Test detect_intent function."""

    @pytest.mark.asyncio
    async def test_returns_intent_result_for_valid_response(self, mock_llm):
        mock_llm.call_llm.return_value = json.dumps({
            "outputType": "recipe",
            "confidence": 0.95,
            "userGoal": "Learn to cook pasta carbonara",
            "sections": [
                {"id": "ingredients", "label": "Ingredients", "emoji": "🥘", "description": "Required ingredients"},
                {"id": "steps", "label": "Steps", "emoji": "👨‍🍳", "description": "Cooking steps"},
            ],
        })

        result = await detect_intent(
            mock_llm,
            title="How to Make Carbonara",
            description="A classic Italian pasta recipe",
            duration=600,
            category_hint="cooking",
            transcript_preview="Today we're making carbonara...",
        )

        assert result.output_type == "recipe"
        assert result.confidence == 0.95
        assert result.user_goal == "Learn to cook pasta carbonara"
        assert len(result.sections) == 4  # Standard recipe sections (overview, ingredients, steps, tips)

    @pytest.mark.asyncio
    async def test_falls_back_on_low_confidence(self, mock_llm):
        mock_llm.call_llm.return_value = json.dumps({
            "outputType": "recipe",
            "confidence": 0.3,
            "userGoal": "Not sure",
            "sections": [
                {"id": "test", "label": "Test", "emoji": "🔮", "description": "Test"},
            ],
        })

        result = await detect_intent(
            mock_llm,
            title="Random Video",
            description="Some video",
            duration=300,
            category_hint=None,
            transcript_preview="Hello world...",
        )

        assert result.output_type == "explanation"
        assert result.confidence == 0.3

    @pytest.mark.asyncio
    async def test_falls_back_on_json_parse_error(self, mock_llm):
        mock_llm.call_llm.return_value = "This is not JSON at all"

        result = await detect_intent(
            mock_llm,
            title="Test",
            description="Test",
            duration=300,
            category_hint=None,
            transcript_preview="Test transcript",
        )

        assert result.output_type == "explanation"
        assert result.confidence == 0.5  # empty JSON fallback

    @pytest.mark.asyncio
    async def test_falls_back_on_llm_error(self, mock_llm):
        mock_llm.call_llm.side_effect = TimeoutError("LLM timeout")

        result = await detect_intent(
            mock_llm,
            title="Test",
            description="Test",
            duration=300,
            category_hint=None,
            transcript_preview="Test transcript",
        )

        assert result.output_type == "explanation"
        assert result.confidence == 0.4  # exception fallback

    @pytest.mark.asyncio
    async def test_handles_empty_sections(self, mock_llm):
        mock_llm.call_llm.return_value = json.dumps({
            "outputType": "code_walkthrough",
            "confidence": 0.9,
            "userGoal": "Learn React hooks",
            "sections": [],
        })

        result = await detect_intent(
            mock_llm,
            title="React Hooks",
            description="React tutorial",
            duration=1200,
            category_hint="coding",
            transcript_preview="Let's learn hooks...",
        )

        assert result.output_type == "code_walkthrough"
        assert len(result.sections) == 5  # Standard code_walkthrough sections (overview, setup, code, patterns, cheat_sheet)

    @pytest.mark.asyncio
    async def test_truncates_long_description_and_transcript(self, mock_llm):
        mock_llm.call_llm.return_value = json.dumps({
            "outputType": "explanation",
            "confidence": 0.8,
            "userGoal": "General summary",
            "sections": [
                {"id": "key_points", "label": "Key Points", "emoji": "💡", "description": "Main ideas"},
            ],
        })

        long_desc = "x" * 5000
        long_transcript = "y" * 10000

        await detect_intent(
            mock_llm,
            title="Test",
            description=long_desc,
            duration=600,
            category_hint=None,
            transcript_preview=long_transcript,
        )

        # Verify the prompt was built with truncated content
        call_args = mock_llm.call_llm.call_args
        prompt = call_args[0][0]
        assert len(long_desc) > 1000  # Original is long
        assert "x" * 1001 not in prompt  # Should be truncated


class TestBuildFallback:
    """Test _build_fallback helper."""

    def test_returns_explanation_type(self):
        result = _build_fallback()
        assert result.output_type == "explanation"
        assert result.confidence == 0.0
        assert len(result.sections) == 4  # explanation: key_points, concepts, takeaways, timestamps

    def test_preserves_confidence(self):
        result = _build_fallback(confidence=0.45)
        assert result.confidence == 0.45

    def test_all_output_types_are_valid(self):
        from src.models.output_types import OUTPUT_TYPE_VALUES
        assert "explanation" in OUTPUT_TYPE_VALUES


class TestGetCanonicalSections:
    """Test get_canonical_sections helper."""

    def test_returns_sections_for_known_type(self):
        sections = get_canonical_sections("recipe")
        assert len(sections) == 4
        ids = [s.id for s in sections]
        assert ids == ["overview", "ingredients", "steps", "tips"]

    def test_returns_default_for_unknown_type(self):
        sections = get_canonical_sections("unknown_type")
        assert len(sections) > 0
        # Should fall back to explanation sections
        ids = [s.id for s in sections]
        assert "key_points" in ids

    def test_returns_copy_not_reference(self):
        """Ensure mutations don't affect the original."""
        sections1 = get_canonical_sections("recipe")
        sections2 = get_canonical_sections("recipe")
        assert sections1 is not sections2


class TestTypeSectionsAlignment:
    """Verify _TYPE_SECTIONS IDs match frontend *Tabs.tsx tab IDs.

    This test prevents future drift between backend section IDs
    and frontend tab switch/case values.
    """

    EXPECTED_TAB_IDS: dict[str, list[str]] = {
        "explanation": ["key_points", "concepts", "takeaways", "timestamps"],
        "recipe": ["overview", "ingredients", "steps", "tips"],
        "code_walkthrough": ["overview", "setup", "code", "patterns", "cheat_sheet"],
        "study_kit": ["overview", "concepts", "flashcards", "quiz"],
        "trip_planner": ["trip", "budget", "pack"],
        "workout": ["overview", "exercises", "timer", "tips"],
        "verdict": ["overview", "pros_cons", "specs", "verdict"],
        "highlights": ["speakers", "highlights", "topics"],
        "music_guide": ["credits", "analysis", "structure", "lyrics"],
        "project_guide": ["overview", "materials", "tools", "steps", "safety"],
    }

    def test_all_output_types_have_sections(self):
        from src.models.output_types import OUTPUT_TYPE_VALUES
        for output_type in OUTPUT_TYPE_VALUES:
            assert output_type in _TYPE_SECTIONS, (
                f"Missing _TYPE_SECTIONS entry for output type: {output_type}"
            )

    def test_section_ids_match_frontend_tabs(self):
        for output_type, expected_ids in self.EXPECTED_TAB_IDS.items():
            sections = _TYPE_SECTIONS[output_type]
            actual_ids = [s.id for s in sections]
            assert actual_ids == expected_ids, (
                f"Tab ID mismatch for {output_type}: "
                f"expected {expected_ids}, got {actual_ids}"
            )

    def test_all_expected_types_covered(self):
        from src.models.output_types import OUTPUT_TYPE_VALUES
        for output_type in OUTPUT_TYPE_VALUES:
            assert output_type in self.EXPECTED_TAB_IDS, (
                f"Test coverage gap: {output_type} not in EXPECTED_TAB_IDS"
            )
