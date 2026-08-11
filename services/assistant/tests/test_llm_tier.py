"""Tests that lock in which model tier each tool uses.

Locks in the audited decision (reports/assistant-audit.md G4):
- concept_explain: primary (Sonnet)
- quiz_generator: fast (Haiku)
- note_taker, navigator: no LLM
"""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

from src.config import MODEL_MAP, get_model, settings
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

    def test_should_resolve_unknown_provider_to_anthropic_map(self):
        """Unknown provider falls back to the anthropic map, NOT openai."""
        assert get_model("unknown_provider", "default") == MODEL_MAP["anthropic"]["default"]
        assert "sonnet" in get_model("unknown_provider", "default").lower()

    def test_should_resolve_unknown_tier_to_default_tier(self):
        """Unknown tier falls back to the provider's default tier (Sonnet), NOT fast."""
        assert get_model("anthropic", "unknown_tier") == MODEL_MAP["anthropic"]["default"]
        assert "sonnet" in get_model("anthropic", "unknown_tier").lower()


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


class TestChatModel:
    """The RAG chat / agentic loop uses its own configurable model tier."""

    def test_chat_model_defaults_to_primary_provider_fast_tier(self, monkeypatch):
        """Unset LLM_CHAT_MODEL → primary provider's fast tier (Haiku), NOT Sonnet.

        Resolves via get_model(LLM_PROVIDER, 'fast') deliberately — so it ignores
        LLM_FAST_PROVIDER and stays on the primary provider family.
        """
        monkeypatch.setattr(settings, "LLM_CHAT_MODEL", None)
        monkeypatch.setattr(settings, "LLM_PROVIDER", "anthropic")
        assert settings.llm_chat_model == get_model("anthropic", "fast")
        assert "haiku" in settings.llm_chat_model.lower()
        assert "sonnet" not in settings.llm_chat_model.lower()

    def test_chat_model_honours_explicit_override(self, monkeypatch):
        monkeypatch.setattr(settings, "LLM_CHAT_MODEL", "anthropic/claude-sonnet-4-6")
        assert settings.llm_chat_model == "anthropic/claude-sonnet-4-6"

    def test_chat_default_ignores_fast_provider(self, monkeypatch):
        """Even with LLM_FAST_PROVIDER=openai, the chat default stays on the
        primary provider's fast tier (not gpt-4o-mini)."""
        monkeypatch.setattr(settings, "LLM_CHAT_MODEL", None)
        monkeypatch.setattr(settings, "LLM_PROVIDER", "anthropic")
        monkeypatch.setattr(settings, "LLM_FAST_PROVIDER", "openai")
        assert settings.llm_chat_model == get_model("anthropic", "fast")
        assert "gpt" not in settings.llm_chat_model.lower()
