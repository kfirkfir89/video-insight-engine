"""Tests for adaptive extraction service."""
import json
import pytest
from unittest.mock import AsyncMock, MagicMock

from src.services.pipeline.extractor import (
    extract,
    _estimate_tokens,
    SINGLE_THRESHOLD,
    OVERFLOW_THRESHOLD,
    SEGMENTATION_DURATION_MINUTES,
)
from src.models.output_types import output_type_to_prompt_name
from src.models.output_types import IntentResult, OutputSection


@pytest.fixture
def mock_llm():
    """Mock LLM service."""
    service = MagicMock()
    service.call_llm = AsyncMock()
    return service


@pytest.fixture
def mock_intent():
    """Mock intent result."""
    return IntentResult(
        outputType="explanation",
        confidence=0.9,
        userGoal="Learn about the topic",
        sections=[
            OutputSection(id="key_points", label="Key Points", emoji="💡", description="Main ideas"),
            OutputSection(id="concepts", label="Concepts", emoji="📚", description="Key terms"),
        ],
    )


def _make_transcript(word_count: int) -> str:
    """Generate a transcript with approximately the given word count."""
    return " ".join(["word"] * word_count)


def _explanation_response() -> str:
    """Valid ExplanationOutput JSON."""
    return json.dumps({
        "keyPoints": [
            {"emoji": "💡", "title": "Point 1", "detail": "Detail 1"},
        ],
        "concepts": [
            {"name": "Concept 1", "definition": "Definition 1", "emoji": "📚"},
        ],
        "takeaways": ["Takeaway 1"],
        "timestamps": [],
    })


def _recipe_response() -> str:
    """Valid RecipeOutput JSON."""
    return json.dumps({
        "meta": {"prepTime": 10, "cookTime": 20, "totalTime": 30, "servings": 4, "difficulty": "easy"},
        "ingredients": [{"name": "Pasta", "amount": "500", "unit": "g"}],
        "steps": [{"number": 1, "instruction": "Boil water"}],
        "tips": [],
    })


class TestExtractSingleStrategy:
    """Test single extraction for short transcripts."""

    @pytest.mark.asyncio
    async def test_single_extraction_for_short_transcript(self, mock_llm, mock_intent):
        mock_llm.call_llm.return_value = _explanation_response()
        transcript = _make_transcript(2000)
        video_data = {"title": "Test", "channel": "Test", "duration": 600}

        events = []
        async for evt in extract(mock_llm, "explanation", transcript, video_data, mock_intent):
            events.append(evt)

        # Should have progress events + extraction_complete
        progress_events = [e for e in events if e["event"] == "extraction_progress"]
        complete_events = [e for e in events if e["event"] == "extraction_complete"]

        assert len(progress_events) >= 3
        assert len(complete_events) == 1
        assert complete_events[0]["outputType"] == "explanation"
        assert "keyPoints" in complete_events[0]["data"]

        # Should use single call (1 LLM call)
        assert mock_llm.call_llm.call_count == 1

    @pytest.mark.asyncio
    async def test_single_extraction_with_recipe_type(self, mock_llm, mock_intent):
        mock_llm.call_llm.return_value = _recipe_response()
        transcript = _make_transcript(1000)
        video_data = {"title": "Pasta Recipe", "channel": "Chef", "duration": 300}

        events = []
        async for evt in extract(mock_llm, "recipe", transcript, video_data, mock_intent):
            events.append(evt)

        complete = [e for e in events if e["event"] == "extraction_complete"][0]
        assert complete["outputType"] == "recipe"
        assert "ingredients" in complete["data"]


class TestExtractOverflowStrategy:
    """Test overflow extraction for medium transcripts."""

    @pytest.mark.asyncio
    async def test_overflow_extraction_succeeds_first_try(self, mock_llm, mock_intent):
        mock_llm.call_llm.return_value = _explanation_response()
        transcript = _make_transcript(8000)
        video_data = {"title": "Test", "channel": "Test", "duration": 1800}

        events = []
        async for evt in extract(mock_llm, "explanation", transcript, video_data, mock_intent):
            events.append(evt)

        complete = [e for e in events if e["event"] == "extraction_complete"]
        assert len(complete) == 1
        assert mock_llm.call_llm.call_count == 1  # No retry needed

    @pytest.mark.asyncio
    async def test_overflow_extraction_retries_on_validation_error(self, mock_llm, mock_intent):
        # First call returns invalid data, second returns valid
        mock_llm.call_llm.side_effect = [
            json.dumps({"keyPoints": "not_a_list"}),  # Invalid
            _explanation_response(),  # Valid retry
        ]
        transcript = _make_transcript(8000)
        video_data = {"title": "Test", "channel": "Test", "duration": 1800}

        events = []
        async for evt in extract(mock_llm, "explanation", transcript, video_data, mock_intent):
            events.append(evt)

        complete = [e for e in events if e["event"] == "extraction_complete"]
        assert len(complete) == 1
        assert mock_llm.call_llm.call_count == 2  # 1 primary + 1 retry


class TestExtractSegmentedStrategy:
    """Test segmented extraction for very long transcripts (>3h AND >20K words)."""

    @pytest.mark.asyncio
    async def test_segmented_extraction_splits_transcript(self, mock_llm, mock_intent):
        """Videos >3h with >20K words use segmented extraction."""
        mock_llm.call_llm.return_value = _explanation_response()
        transcript = _make_transcript(25000)
        # Duration >3h (200 min = 12000 seconds)
        video_data = {"title": "Long Video", "channel": "Test", "duration": 12000}

        events = []
        async for evt in extract(mock_llm, "explanation", transcript, video_data, mock_intent):
            events.append(evt)

        complete = [e for e in events if e["event"] == "extraction_complete"]
        assert len(complete) == 1
        # Should use 2+ segments
        assert mock_llm.call_llm.call_count >= 2

    @pytest.mark.asyncio
    async def test_long_transcript_short_duration_uses_overflow(self, mock_llm, mock_intent):
        """Videos <3h with >20K words use overflow, NOT segmented."""
        mock_llm.call_llm.return_value = _explanation_response()
        transcript = _make_transcript(25000)
        # Duration <3h (2h = 7200 seconds)
        video_data = {"title": "Long Video", "channel": "Test", "duration": 7200}

        events = []
        async for evt in extract(mock_llm, "explanation", transcript, video_data, mock_intent):
            events.append(evt)

        complete = [e for e in events if e["event"] == "extraction_complete"]
        assert len(complete) == 1
        # Should use overflow (1 call), not segmented
        assert mock_llm.call_llm.call_count == 1

    @pytest.mark.asyncio
    async def test_segmented_extraction_merges_lists(self, mock_llm, mock_intent):
        # Each segment returns different key points
        mock_llm.call_llm.side_effect = [
            json.dumps({
                "keyPoints": [{"emoji": "1️⃣", "title": "Point A", "detail": "From segment 1"}],
                "concepts": [{"name": "C1", "definition": "Def 1", "emoji": "📗"}],
                "takeaways": ["T1"],
            }),
            json.dumps({
                "keyPoints": [{"emoji": "2️⃣", "title": "Point B", "detail": "From segment 2"}],
                "concepts": [{"name": "C2", "definition": "Def 2", "emoji": "📘"}],
                "takeaways": ["T2"],
            }),
        ]
        transcript = _make_transcript(25000)
        # Duration >3h
        video_data = {"title": "Long Video", "channel": "Test", "duration": 12000}

        events = []
        async for evt in extract(mock_llm, "explanation", transcript, video_data, mock_intent):
            events.append(evt)

        complete = [e for e in events if e["event"] == "extraction_complete"][0]
        # Lists should be merged (concatenated)
        assert len(complete["data"]["keyPoints"]) == 2
        assert len(complete["data"]["concepts"]) == 2
        assert len(complete["data"]["takeaways"]) == 2

    @pytest.mark.asyncio
    async def test_segmented_with_chapters_uses_chapter_splits(self, mock_llm, mock_intent):
        """When chapters are available, use them as split boundaries."""
        mock_llm.call_llm.return_value = _explanation_response()
        transcript = _make_transcript(25000)
        # Duration >3h, with chapters
        video_data = {
            "title": "Long Video",
            "channel": "Test",
            "duration": 12000,
            "chapters": [
                {"title": "Part 1", "start": 0},
                {"title": "Part 2", "start": 3600},
                {"title": "Part 3", "start": 7200},
            ],
        }

        events = []
        async for evt in extract(mock_llm, "explanation", transcript, video_data, mock_intent):
            events.append(evt)

        complete = [e for e in events if e["event"] == "extraction_complete"]
        assert len(complete) == 1
        # Should use chapter-based segments (3 chapters = 3 segments)
        assert mock_llm.call_llm.call_count == 3


class TestEstimateTokens:
    """Test token estimation."""

    def test_estimate_tokens_basic(self):
        text = " ".join(["word"] * 100)
        tokens = _estimate_tokens(text)
        assert tokens == 133  # 100 * 1.33

    def test_estimate_tokens_empty(self):
        assert _estimate_tokens("") == 0


class TestTypeToPromptName:
    """Test output type to prompt name mapping."""

    def test_explanation_maps_to_smart(self):
        assert output_type_to_prompt_name("explanation") == "smart"

    def test_code_walkthrough_maps_to_code(self):
        assert output_type_to_prompt_name("code_walkthrough") == "code"

    def test_study_kit_maps_to_study(self):
        assert output_type_to_prompt_name("study_kit") == "study"

    def test_trip_planner_maps_to_trip(self):
        assert output_type_to_prompt_name("trip_planner") == "trip"

    def test_unmapped_type_returns_itself(self):
        assert output_type_to_prompt_name("recipe") == "recipe"
        assert output_type_to_prompt_name("workout") == "workout"
        assert output_type_to_prompt_name("verdict") == "verdict"
        assert output_type_to_prompt_name("highlights") == "highlights"


class TestThresholds:
    """Verify threshold constants."""

    def test_single_threshold(self):
        assert SINGLE_THRESHOLD == 5333

    def test_overflow_threshold(self):
        assert OVERFLOW_THRESHOLD == 20000

    def test_overflow_is_greater_than_single(self):
        assert OVERFLOW_THRESHOLD > SINGLE_THRESHOLD

    def test_segmentation_duration_is_3_hours(self):
        assert SEGMENTATION_DURATION_MINUTES == 180
