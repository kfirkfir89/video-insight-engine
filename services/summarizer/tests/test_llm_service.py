"""Tests for LLMService with LiteLLM multi-provider support."""

import pytest
from unittest.mock import AsyncMock

from src.services.llm import LLMService
from src.services.video.youtube import _load_persona_rules


class TestLLMService:
    """Tests for LLMService class with LLMProvider."""

    def test_init(self, mock_llm_provider):
        """Test service initialization with LLMProvider."""
        service = LLMService(mock_llm_provider)
        assert service._provider is mock_llm_provider

    def test_provider_property(self, mock_llm_provider):
        """Test provider property returns the underlying provider."""
        service = LLMService(mock_llm_provider)
        assert service.provider is mock_llm_provider

    def test_fast_model_property(self, mock_llm_provider):
        """Test fast_model property returns provider's fast model."""
        mock_llm_provider.fast_model = "claude-3-haiku"
        service = LLMService(mock_llm_provider)
        assert service.fast_model == "claude-3-haiku"

    @pytest.mark.asyncio
    async def test_call_llm_success(self, mock_llm_provider):
        """Test successful LLM call."""
        mock_llm_provider.complete = AsyncMock(return_value="Hello world")
        service = LLMService(mock_llm_provider)
        result = await service.call_llm("test prompt")
        assert result == "Hello world"
        mock_llm_provider.complete.assert_called_once_with("test prompt", max_tokens=2000)

    @pytest.mark.asyncio
    async def test_call_llm_custom_max_tokens(self, mock_llm_provider):
        """Test LLM call with custom max_tokens."""
        mock_llm_provider.complete = AsyncMock(return_value="response")
        service = LLMService(mock_llm_provider)
        await service.call_llm("prompt", max_tokens=4096)
        mock_llm_provider.complete.assert_called_once_with("prompt", max_tokens=4096)

    @pytest.mark.asyncio
    async def test_stream_llm_yields_tokens(self, mock_llm_provider):
        """Test streaming LLM response yields tokens."""
        async def mock_stream(*args, **kwargs):
            for token in ["Hello", " ", "world"]:
                yield token

        mock_llm_provider.stream = mock_stream
        service = LLMService(mock_llm_provider)

        tokens = []
        async for token in service.stream_llm("test prompt"):
            tokens.append(token)

        assert tokens == ["Hello", " ", "world"]


class TestLoadPersonaRules:
    """Tests for _load_persona_rules helper."""

    def test_persona_rules_structure(self):
        """Test that persona_rules.json has the expected structure."""
        _load_persona_rules.cache_clear()
        rules = _load_persona_rules()

        assert "personas" in rules
        assert "default_persona" in rules
        assert rules["default_persona"] == "standard"

    def test_persona_rules_has_required_personas(self):
        """Test that required personas are defined in rules."""
        rules = _load_persona_rules()
        personas = rules["personas"]

        assert "code" in personas
        assert "recipe" in personas
        assert "interview" in personas
        assert "review" in personas

    def test_persona_config_structure(self):
        """Test that each persona config has keywords and categories."""
        rules = _load_persona_rules()

        for persona_name, config in rules["personas"].items():
            assert "keywords" in config, f"'{persona_name}' missing 'keywords'"
            assert "categories" in config, f"'{persona_name}' missing 'categories'"
            assert isinstance(config["keywords"], list)
            assert isinstance(config["categories"], list)
            assert len(config["keywords"]) > 0
            assert len(config["categories"]) > 0
