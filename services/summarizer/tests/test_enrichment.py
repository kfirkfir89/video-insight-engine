"""Tests for enrichment service."""
import json
import pytest
from unittest.mock import AsyncMock, MagicMock

from src.services.pipeline.enrichment import enrich, ENRICHMENT_MAP


@pytest.fixture
def mock_llm():
    """Mock LLM service."""
    service = MagicMock()
    service.call_llm = AsyncMock()
    return service


class TestEnrich:
    """Test enrich function."""

    @pytest.mark.asyncio
    async def test_returns_none_for_unsupported_tag(self, mock_llm):
        result = await enrich(mock_llm, "food", {"data": "test"}, "Recipe Video")
        assert result is None
        mock_llm.call_llm.assert_not_called()

    @pytest.mark.asyncio
    async def test_returns_none_for_fitness_tag(self, mock_llm):
        result = await enrich(mock_llm, "fitness", {"data": "test"}, "Test Video")
        assert result is None

    @pytest.mark.asyncio
    async def test_enriches_learning_with_quiz(self, mock_llm):
        mock_llm.call_llm.return_value = json.dumps({
            "quiz": [
                {
                    "question": "What is Python?",
                    "options": ["Language", "Snake", "Framework", "OS"],
                    "correctIndex": 0,
                    "explanation": "Python is a programming language",
                }
            ],
            "flashcards": [
                {"front": "What is a variable?", "back": "A named storage location"},
            ],
        })

        result = await enrich(
            mock_llm,
            "learning",
            {"concepts": [{"name": "Python", "definition": "A language"}]},
            "Learn Python",
        )

        assert result is not None
        assert len(result.quiz) == 1
        assert len(result.flashcards) == 1

    @pytest.mark.asyncio
    async def test_enriches_learning_with_scenarios(self, mock_llm):
        mock_llm.call_llm.return_value = json.dumps({
            "quiz": [
                {
                    "question": "What is Python?",
                    "options": ["Language", "Snake", "Framework", "OS"],
                    "correctIndex": 0,
                    "explanation": "Python is a programming language",
                }
            ],
            "flashcards": [
                {"front": "What is a variable?", "back": "A named storage location"},
            ],
            "scenarios": [
                {
                    "question": "You need to store user data. Which approach?",
                    "emoji": "🤔",
                    "options": [
                        {"text": "Use a dictionary", "correct": True, "explanation": "Dict is key-value"},
                        {"text": "Use a list", "correct": False, "explanation": "List is ordered"},
                    ],
                }
            ],
        })

        result = await enrich(
            mock_llm,
            "learning",
            {"concepts": [{"name": "Python", "definition": "A language"}]},
            "Learn Python",
        )

        assert result is not None
        assert len(result.scenarios) == 1
        assert result.scenarios[0].question == "You need to store user data. Which approach?"
        assert len(result.scenarios[0].options) == 2

    @pytest.mark.asyncio
    async def test_review_not_enriched(self, mock_llm):
        """review tag does not get enrichment."""
        result = await enrich(
            mock_llm,
            "review",
            {"product": "Test"},
            "Product Review",
        )

        assert result is None
        mock_llm.call_llm.assert_not_called()

    @pytest.mark.asyncio
    async def test_returns_none_on_llm_error(self, mock_llm):
        mock_llm.call_llm.side_effect = TimeoutError("timeout")

        result = await enrich(
            mock_llm,
            "learning",
            {"data": "test"},
            "Test",
        )

        assert result is None

    @pytest.mark.asyncio
    async def test_returns_none_on_empty_response(self, mock_llm):
        mock_llm.call_llm.return_value = "I can't generate that"

        result = await enrich(
            mock_llm,
            "learning",
            {"data": "test"},
            "Test",
        )

        assert result is None


class TestEnrichmentMap:
    """Test enrichment configuration."""

    def test_learning_has_enrichment(self):
        assert "learning" in ENRICHMENT_MAP

    def test_tech_not_in_enrichment(self):
        """Tech extraction already produces cheatSheet — no separate enrichment."""
        assert "tech" not in ENRICHMENT_MAP

    def test_food_not_in_enrichment(self):
        assert "food" not in ENRICHMENT_MAP

    def test_supported_tags_count(self):
        assert len(ENRICHMENT_MAP) == 1
