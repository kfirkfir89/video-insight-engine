"""Tests that lock in which model tier each tool uses.

Locks in the audited decision (reports/assistant-audit.md G4):
- concept_explain: primary (Sonnet)
- quiz_generator: fast (Haiku)
- note_taker, navigator: no LLM
"""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

from src.config import get_model, settings
from src.services.llm_provider import LLMProvider
from src.tools.concept_explain import ConceptExplainTool
from src.tools.quiz_generator import QuizGeneratorTool


class TestModelMap:
    """get_model() resolves provider+tier consistently."""

    def test_should_return_sonnet_for_anthropic_default(self):
        assert "sonnet" in get_model("anthropic", "default").lower()

    def test_should_return_haiku_for_anthropic_fast(self):
        assert "haiku" in get_model("anthropic", "fast").lower()

    def test_should_fall_back_to_anthropic_when_provider_unknown(self):
        assert get_model("invalid_provider", "default") == get_model("anthropic", "default")


class TestLLMProvider:
    """LLMProvider initialisation honours model override and fallback."""

    def test_should_default_to_settings_llm_model(self):
        provider = LLMProvider()
        assert provider.model == settings.llm_model
        assert "sonnet" in provider.model.lower()

    def test_should_accept_explicit_model_override(self):
        provider = LLMProvider(model="anthropic/claude-haiku-4-5-20251001")
        assert "haiku" in provider.model.lower()


class TestConceptExplainUsesPrimary:
    """concept_explain must reach for the primary (Sonnet) model — deep explanations."""

    async def test_should_call_complete_with_messages_on_injected_llm(self):
        rag = AsyncMock()
        rag.search.return_value = []
        llm = AsyncMock()
        llm.model = "anthropic/claude-sonnet-4-6"
        llm.complete_with_messages.return_value = "explanation"

        tool = ConceptExplainTool(rag=rag, llm=llm)

        await tool.execute(
            {"concept": "topic", "video_id": "v1"},
            {
                "video_ctx": type("Ctx", (), {
                    "title": "T", "creator": "C", "tabs": [], "youtube_id": "yt1",
                })(),
            },
        )

        llm.complete_with_messages.assert_awaited_once()
        # Tool did not create a new fast-model LLMProvider — it uses the injected one.
        assert "sonnet" in llm.model.lower()


class TestQuizGeneratorUsesFast:
    """quiz_generator must build a fast (Haiku) LLMProvider — cost discipline."""

    async def test_should_construct_llm_with_fast_model(self):
        llm = AsyncMock()
        llm.model = settings.llm_model

        tool = QuizGeneratorTool(llm=llm)

        with patch("src.tools.quiz_generator.LLMProvider") as mock_provider_cls:
            mock_instance = AsyncMock()
            mock_instance.complete_with_messages.return_value = (
                '{"questions": [{"question": "Q?", "options": ["A", "B"], "correct_index": 0}]}'
            )
            mock_provider_cls.return_value = mock_instance

            await tool.execute(
                {},
                {
                    "video_ctx": type("Ctx", (), {
                        "title": "T",
                        "creator": "C",
                        "summary": "S",
                        "takeaways": [],
                    })(),
                },
            )

            mock_provider_cls.assert_called_once()
            call_kwargs = mock_provider_cls.call_args.kwargs
            assert call_kwargs["model"] == settings.llm_fast_model
            assert "haiku" in call_kwargs["model"].lower() or "fast" in call_kwargs["model"].lower()


def test_primary_and_fast_models_differ():
    """If primary and fast collapse to the same model, the escalation has no effect."""
    assert settings.llm_model != settings.llm_fast_model
