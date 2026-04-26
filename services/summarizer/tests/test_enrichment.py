"""Tests for enrichment service."""
import json
import pytest
from unittest.mock import AsyncMock, MagicMock

from src.services.pipeline.enrichment import enrich, ENRICHMENT_MAP, _has_meaningful_data


@pytest.fixture
def mock_llm():
    """Mock LLM service.

    Enrichment uses call_llm_with_retry(use_fast_model=True) which calls
    call_llm_fast(). We mock both and keep them in sync via a shared holder.
    """
    service = MagicMock()
    service.call_llm = AsyncMock()
    service.call_llm_fast = AsyncMock()
    service.model = "anthropic/claude-sonnet-4-6"
    service.fast_model = "anthropic/claude-haiku-4-5-20251001"
    return service


def _set_llm_return(mock_llm, value):
    """Set return value on both call_llm and call_llm_fast."""
    mock_llm.call_llm.return_value = value
    mock_llm.call_llm_fast.return_value = value


class TestEnrich:
    """Test enrich function."""

    @pytest.mark.asyncio
    async def test_food_tag_gets_enrichment(self, mock_llm):
        _set_llm_return(mock_llm, json.dumps({
            "quiz": [
                {
                    "question": "What temperature for pasta water?",
                    "options": ["Boiling", "Warm", "Cold", "Room temp"],
                    "correctIndex": 0,
                    "explanation": "Pasta needs a rolling boil",
                }
            ],
            "flashcards": [{"front": "Al dente", "back": "Firm to the bite"}],
        }))
        result = await enrich(mock_llm, "food", {"ingredients": [{"name": "pasta"}]}, "Recipe Video")
        assert result is not None
        assert len(result.quiz) == 1
        mock_llm.call_llm_fast.assert_called_once()

    @pytest.mark.asyncio
    async def test_tech_primary_with_learning_content_tag_runs_enrichment(self, mock_llm):
        """primary_tag='tech' has no mapping, but 'learning' in content_tags should trigger enrichment."""
        _set_llm_return(mock_llm, json.dumps({
            "quiz": [
                {
                    "question": "What is MCP?",
                    "options": ["Protocol", "Language", "Framework", "Database"],
                    "correctIndex": 0,
                    "explanation": "Model Context Protocol",
                }
            ],
            "flashcards": [
                {"front": "MCP", "back": "Model Context Protocol"},
            ],
        }))

        result = await enrich(
            mock_llm,
            "tech",
            {"concepts": [{"name": "MCP", "definition": "A protocol"}]},
            "MCP vs Skills",
            content_tags=["tech", "learning"],
        )

        assert result is not None
        assert len(result.quiz) == 1
        mock_llm.call_llm_fast.assert_called_once()

    @pytest.mark.asyncio
    async def test_tech_primary_no_content_tags_gets_enrichment(self, mock_llm):
        """primary_tag='tech' with no content_tags — now gets enrichment via direct mapping."""
        _set_llm_return(mock_llm, json.dumps({
            "quiz": [
                {
                    "question": "What is Docker?",
                    "options": ["Container runtime", "Language", "Database", "OS"],
                    "correctIndex": 0,
                    "explanation": "Docker is a container runtime",
                }
            ],
            "flashcards": [{"front": "Docker", "back": "Container platform"}],
        }))
        result = await enrich(mock_llm, "tech", {"concepts": [{"name": "Docker"}]}, "Tech Video")
        assert result is not None
        assert len(result.quiz) == 1
        mock_llm.call_llm_fast.assert_called_once()

    @pytest.mark.asyncio
    async def test_tech_primary_content_tags_no_learning_gets_enrichment(self, mock_llm):
        """primary_tag='tech', content_tags without 'learning' — now gets enrichment via direct mapping."""
        _set_llm_return(mock_llm, json.dumps({
            "quiz": [
                {
                    "question": "What is a REST API?",
                    "options": ["Interface", "Database", "Language", "OS"],
                    "correctIndex": 0,
                    "explanation": "REST is an API architecture",
                }
            ],
            "flashcards": [{"front": "REST", "back": "Representational State Transfer"}],
        }))
        result = await enrich(
            mock_llm, "tech", {"concepts": [{"name": "REST"}]}, "Tech Video",
            content_tags=["tech", "review"],
        )
        assert result is not None
        assert len(result.quiz) == 1
        mock_llm.call_llm_fast.assert_called_once()

    @pytest.mark.asyncio
    async def test_fitness_tag_gets_enrichment(self, mock_llm):
        _set_llm_return(mock_llm, json.dumps({
            "quiz": [
                {
                    "question": "What muscle does a squat target?",
                    "options": ["Quads", "Biceps", "Abs", "Chest"],
                    "correctIndex": 0,
                    "explanation": "Squats primarily target quadriceps",
                }
            ],
            "flashcards": [{"front": "Squat", "back": "Compound lower body exercise"}],
        }))
        result = await enrich(mock_llm, "fitness", {"exercises": [{"name": "Squat"}]}, "Workout Video")
        assert result is not None
        assert len(result.quiz) == 1
        mock_llm.call_llm_fast.assert_called_once()

    @pytest.mark.asyncio
    async def test_enriches_learning_with_quiz(self, mock_llm):
        _set_llm_return(mock_llm, json.dumps({
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
        }))

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
        _set_llm_return(mock_llm, json.dumps({
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
        }))

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
    async def test_review_gets_enrichment(self, mock_llm):
        """review tag now gets enrichment."""
        _set_llm_return(mock_llm, json.dumps({
            "quiz": [
                {
                    "question": "What was the main pro?",
                    "options": ["Battery life", "Weight", "Price", "Screen"],
                    "correctIndex": 0,
                    "explanation": "Battery life was highlighted as the top feature",
                }
            ],
            "flashcards": [{"front": "Main verdict", "back": "Recommended for battery life"}],
        }))
        result = await enrich(
            mock_llm,
            "review",
            {"verdict": {"summary": "Great battery"}},
            "Product Review",
        )

        assert result is not None
        assert len(result.quiz) == 1
        mock_llm.call_llm_fast.assert_called_once()

    @pytest.mark.asyncio
    async def test_returns_none_on_llm_error(self, mock_llm):
        mock_llm.call_llm.side_effect = TimeoutError("timeout")
        mock_llm.call_llm_fast.side_effect = TimeoutError("timeout")

        result = await enrich(
            mock_llm,
            "learning",
            {"data": "test"},
            "Test",
        )

        assert result is None

    @pytest.mark.asyncio
    async def test_returns_none_on_empty_response(self, mock_llm):
        _set_llm_return(mock_llm, "I can't generate that")

        result = await enrich(
            mock_llm,
            "learning",
            {"data": "test"},
            "Test",
        )

        assert result is None


class TestEnrichmentMap:
    """Test enrichment configuration."""

    def test_all_primary_domains_have_enrichment(self):
        expected = {"learning", "tech", "fitness", "food", "music", "travel", "review", "project"}
        for domain in expected:
            assert domain in ENRICHMENT_MAP, f"{domain} missing from ENRICHMENT_MAP"

    def test_supported_tags_count(self):
        # 10 primary domains + "default" entry
        assert len(ENRICHMENT_MAP) == 11

    def test_each_domain_has_own_prompt(self):
        """Each domain maps to its own prompt file in enrich/ subfolder."""
        expected_prompts = {
            "learning": "enrich/enrich_study.txt",
            "tech": "enrich/enrich_tech.txt",
            "fitness": "enrich/enrich_fitness.txt",
            "food": "enrich/enrich_food.txt",
            "music": "enrich/enrich_music.txt",
            "travel": "enrich/enrich_travel.txt",
            "review": "enrich/enrich_review.txt",
            "project": "enrich/enrich_project.txt",
        }
        for domain, expected_path in expected_prompts.items():
            assert ENRICHMENT_MAP[domain] == expected_path, (
                f"{domain} uses {ENRICHMENT_MAP[domain]}, expected {expected_path}"
            )


class TestHasMeaningfulData:
    """Test _has_meaningful_data helper."""

    def test_returns_true_for_nonempty_list(self):
        assert _has_meaningful_data({"domain": {"items": [{"name": "test"}]}}) is True

    def test_returns_true_for_long_string(self):
        assert _has_meaningful_data({"domain": {"summary": "A long enough string"}}) is True

    def test_returns_false_for_empty_dict(self):
        assert _has_meaningful_data({}) is False

    def test_returns_false_for_empty_nested(self):
        assert _has_meaningful_data({"domain": {"items": [], "summary": ""}}) is False

    def test_returns_false_for_short_strings(self):
        assert _has_meaningful_data({"domain": {"key": "short"}}) is False

    def test_returns_true_for_top_level_list(self):
        assert _has_meaningful_data({"items": [{"name": "test"}]}) is True

    def test_returns_true_for_top_level_long_string(self):
        assert _has_meaningful_data({"summary": "A long enough string value"}) is True

    def test_returns_false_for_none_values(self):
        assert _has_meaningful_data({"domain": {"key": None}}) is False


class TestEnrichSynthesisFallback:
    """Test enrichment synthesis fallback when extraction is empty."""

    @pytest.fixture
    def mock_llm(self):
        service = MagicMock()
        service.call_llm = AsyncMock()
        service.call_llm_fast = AsyncMock()
        service.model = "anthropic/claude-sonnet-4-6"
        service.fast_model = "anthropic/claude-haiku-4-5-20251001"
        return service

    @pytest.mark.asyncio
    async def test_uses_synthesis_when_extraction_empty(self, mock_llm):
        """When extraction is empty, synthesis data should be used as context."""
        _set_llm_return(mock_llm, json.dumps({
            "quiz": [
                {
                    "question": "What was the main topic?",
                    "options": ["AI", "Cooking", "Sports", "Music"],
                    "correctIndex": 0,
                    "explanation": "The video was about AI",
                }
            ],
            "flashcards": [{"front": "Key point", "back": "AI is transformative"}],
        }))

        result = await enrich(
            mock_llm,
            "learning",
            {},  # Empty extraction
            "AI Overview Video",
            synthesis_data={
                "masterSummary": "This video covers AI fundamentals and applications.",
                "keyTakeaways": ["AI is transformative", "Machine learning is a subset"],
                "tldr": "An overview of AI",
            },
        )

        assert result is not None
        assert len(result.quiz) == 1
        # Verify the LLM was called (synthesis used as fallback context)
        mock_llm.call_llm_fast.assert_called_once()

    @pytest.mark.asyncio
    async def test_uses_extraction_when_available(self, mock_llm):
        """When extraction has data, it should be used instead of synthesis."""
        _set_llm_return(mock_llm, json.dumps({
            "quiz": [
                {
                    "question": "What is Python?",
                    "options": ["Language", "Snake", "Framework", "OS"],
                    "correctIndex": 0,
                    "explanation": "Python is a programming language",
                }
            ],
            "flashcards": [{"front": "Python", "back": "A programming language"}],
        }))

        result = await enrich(
            mock_llm,
            "learning",
            {"concepts": [{"name": "Python", "definition": "A language"}]},
            "Learn Python",
            synthesis_data={"masterSummary": "Should not be used"},
        )

        assert result is not None
        # Verify LLM was called with extraction data (not synthesis)
        call_args = mock_llm.call_llm_fast.call_args
        prompt = call_args[0][0] if call_args[0] else call_args[1].get("prompt", "")
        assert "Python" in prompt
        assert "Should not be used" not in prompt
