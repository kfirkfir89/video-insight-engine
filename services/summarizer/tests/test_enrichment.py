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
    async def test_returns_none_for_unsupported_type(self, mock_llm):
        result = await enrich(mock_llm, "recipe", {"data": "test"}, "Recipe Video")
        assert result is None
        mock_llm.call_llm.assert_not_called()

    @pytest.mark.asyncio
    async def test_returns_none_for_explanation_type(self, mock_llm):
        result = await enrich(mock_llm, "explanation", {"data": "test"}, "Test Video")
        assert result is None

    @pytest.mark.asyncio
    async def test_enriches_study_kit_with_quiz(self, mock_llm):
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
            "study_kit",
            {"concepts": [{"name": "Python", "definition": "A language"}]},
            "Learn Python",
        )

        assert result is not None
        assert len(result.quiz) == 1
        assert len(result.flashcards) == 1

    @pytest.mark.asyncio
    async def test_enriches_code_with_cheat_sheet(self, mock_llm):
        mock_llm.call_llm.return_value = json.dumps({
            "cheatSheet": [
                {"title": "List comprehension", "code": "[x for x in range(10)]", "description": "Create lists"},
            ],
        })

        result = await enrich(
            mock_llm,
            "code_walkthrough",
            {"snippets": [{"language": "python", "code": "print('hi')", "explanation": "Hello"}]},
            "Python Tips",
        )

        assert result is not None
        assert len(result.cheat_sheet) == 1

    @pytest.mark.asyncio
    async def test_returns_none_on_llm_error(self, mock_llm):
        mock_llm.call_llm.side_effect = TimeoutError("timeout")

        result = await enrich(
            mock_llm,
            "study_kit",
            {"data": "test"},
            "Test",
        )

        assert result is None

    @pytest.mark.asyncio
    async def test_returns_none_on_empty_response(self, mock_llm):
        mock_llm.call_llm.return_value = "I can't generate that"

        result = await enrich(
            mock_llm,
            "study_kit",
            {"data": "test"},
            "Test",
        )

        assert result is None


class TestEnrichmentMap:
    """Test enrichment configuration."""

    def test_study_kit_has_enrichment(self):
        assert "study_kit" in ENRICHMENT_MAP

    def test_code_walkthrough_has_enrichment(self):
        assert "code_walkthrough" in ENRICHMENT_MAP

    def test_only_two_types_supported(self):
        assert len(ENRICHMENT_MAP) == 2
