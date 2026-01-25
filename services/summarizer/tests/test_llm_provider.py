"""Tests for LLMProvider multi-provider abstraction."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, UTC

from src.services.llm_provider import (
    LLMProvider,
    Message,
    CompletionResult,
    get_llm_provider,
)


class TestMessage:
    """Tests for Message model."""

    def test_message_creation(self):
        msg = Message(role="user", content="Hello")
        assert msg.role == "user"
        assert msg.content == "Hello"

    def test_message_system_role(self):
        msg = Message(role="system", content="You are helpful")
        assert msg.role == "system"


class TestCompletionResult:
    """Tests for CompletionResult model."""

    def test_completion_result_creation(self):
        result = CompletionResult(
            content="Hello world",
            model="anthropic/claude-sonnet-4-20250514",
            input_tokens=10,
            output_tokens=5,
            cost_usd=0.001,
            duration_ms=500,
        )
        assert result.content == "Hello world"
        assert result.model == "anthropic/claude-sonnet-4-20250514"
        assert result.input_tokens == 10
        assert result.output_tokens == 5
        assert result.cost_usd == 0.001
        assert result.duration_ms == 500


class TestLLMProvider:
    """Tests for LLMProvider class."""

    def test_init_default_model(self):
        """Test initialization with default model."""
        with patch("src.services.llm_provider.settings") as mock_settings:
            mock_settings.llm_model = "anthropic/claude-sonnet-4-20250514"
            mock_settings.llm_fallback_models = None
            mock_settings.LLM_TIMEOUT_SECONDS = 60.0
            mock_settings.LLM_NUM_RETRIES = 2

            provider = LLMProvider()
            assert provider.model == "anthropic/claude-sonnet-4-20250514"

    def test_init_custom_model(self):
        """Test initialization with custom model."""
        with patch("src.services.llm_provider.settings") as mock_settings:
            mock_settings.llm_model = "anthropic/claude-sonnet-4-20250514"
            mock_settings.llm_fallback_models = None
            mock_settings.LLM_TIMEOUT_SECONDS = 60.0
            mock_settings.LLM_NUM_RETRIES = 2

            provider = LLMProvider(model="openai/gpt-4o")
            assert provider.model == "openai/gpt-4o"

    def test_extract_provider(self):
        """Test provider extraction from model string."""
        with patch("src.services.llm_provider.settings") as mock_settings:
            mock_settings.llm_model = "anthropic/claude-sonnet-4-20250514"
            mock_settings.llm_fallback_models = None
            mock_settings.LLM_TIMEOUT_SECONDS = 60.0
            mock_settings.LLM_NUM_RETRIES = 2

            provider = LLMProvider()
            assert provider._extract_provider("anthropic/claude-sonnet-4-20250514") == "anthropic"
            assert provider._extract_provider("openai/gpt-4o") == "openai"
            assert provider._extract_provider("gemini/gemini-1.5-pro") == "gemini"
            assert provider._extract_provider("no-slash") == "unknown"

    @pytest.mark.asyncio
    async def test_complete_success(self):
        """Test successful completion."""
        with patch("src.services.llm_provider.acompletion") as mock_acompletion:
            mock_response = MagicMock()
            mock_response.choices = [MagicMock()]
            mock_response.choices[0].message.content = "Hello world"
            mock_acompletion.return_value = mock_response

            with patch("src.services.llm_provider.settings") as mock_settings:
                mock_settings.llm_model = "anthropic/claude-sonnet-4-20250514"
                mock_settings.llm_fallback_models = None
                mock_settings.LLM_TIMEOUT_SECONDS = 60.0
                mock_settings.LLM_NUM_RETRIES = 2

                provider = LLMProvider()
                result = await provider.complete("Test prompt")

                assert result == "Hello world"
                mock_acompletion.assert_called_once()

    @pytest.mark.asyncio
    async def test_complete_with_messages(self):
        """Test completion with message list."""
        with patch("src.services.llm_provider.acompletion") as mock_acompletion:
            mock_response = MagicMock()
            mock_response.choices = [MagicMock()]
            mock_response.choices[0].message.content = "Response"
            mock_acompletion.return_value = mock_response

            with patch("src.services.llm_provider.settings") as mock_settings:
                mock_settings.llm_model = "anthropic/claude-sonnet-4-20250514"
                mock_settings.llm_fallback_models = None
                mock_settings.LLM_TIMEOUT_SECONDS = 60.0
                mock_settings.LLM_NUM_RETRIES = 2

                provider = LLMProvider()
                messages = [
                    {"role": "system", "content": "You are helpful"},
                    {"role": "user", "content": "Hello"},
                ]
                result = await provider.complete_with_messages(messages)

                assert result == "Response"

    @pytest.mark.asyncio
    async def test_complete_with_message_objects(self):
        """Test completion with Message objects."""
        with patch("src.services.llm_provider.acompletion") as mock_acompletion:
            mock_response = MagicMock()
            mock_response.choices = [MagicMock()]
            mock_response.choices[0].message.content = "Response"
            mock_acompletion.return_value = mock_response

            with patch("src.services.llm_provider.settings") as mock_settings:
                mock_settings.llm_model = "anthropic/claude-sonnet-4-20250514"
                mock_settings.llm_fallback_models = None
                mock_settings.LLM_TIMEOUT_SECONDS = 60.0
                mock_settings.LLM_NUM_RETRIES = 2

                provider = LLMProvider()
                messages = [
                    Message(role="system", content="You are helpful"),
                    Message(role="user", content="Hello"),
                ]
                result = await provider.complete_with_messages(messages)

                assert result == "Response"

    @pytest.mark.asyncio
    async def test_complete_with_tracking(self):
        """Test completion with usage tracking."""
        with patch("src.services.llm_provider.acompletion") as mock_acompletion:
            mock_response = MagicMock()
            mock_response.choices = [MagicMock()]
            mock_response.choices[0].message.content = "Hello"
            mock_response.model = "anthropic/claude-sonnet-4-20250514"
            mock_response.usage = MagicMock()
            mock_response.usage.prompt_tokens = 10
            mock_response.usage.completion_tokens = 5
            mock_acompletion.return_value = mock_response

            with patch("src.services.llm_provider.completion_cost") as mock_cost:
                mock_cost.return_value = 0.001

                with patch("src.services.llm_provider.settings") as mock_settings:
                    mock_settings.llm_model = "anthropic/claude-sonnet-4-20250514"
                    mock_settings.llm_fallback_models = None
                    mock_settings.LLM_TIMEOUT_SECONDS = 60.0
                    mock_settings.LLM_NUM_RETRIES = 2

                    provider = LLMProvider()
                    result = await provider.complete_with_tracking("Test")

                    assert isinstance(result, CompletionResult)
                    assert result.content == "Hello"
                    assert result.input_tokens == 10
                    assert result.output_tokens == 5
                    assert result.cost_usd == 0.001

    @pytest.mark.asyncio
    async def test_stream(self):
        """Test streaming completion."""
        with patch("src.services.llm_provider.acompletion") as mock_acompletion:
            # Create async generator mock
            async def mock_stream():
                chunks = [
                    MagicMock(choices=[MagicMock(delta=MagicMock(content="Hello"))]),
                    MagicMock(choices=[MagicMock(delta=MagicMock(content=" "))]),
                    MagicMock(choices=[MagicMock(delta=MagicMock(content="world"))]),
                ]
                for chunk in chunks:
                    yield chunk

            mock_acompletion.return_value = mock_stream()

            with patch("src.services.llm_provider.settings") as mock_settings:
                mock_settings.llm_model = "anthropic/claude-sonnet-4-20250514"
                mock_settings.llm_fallback_models = None
                mock_settings.LLM_TIMEOUT_SECONDS = 60.0
                mock_settings.LLM_NUM_RETRIES = 2

                provider = LLMProvider()
                tokens = []
                async for token in provider.stream("Test"):
                    tokens.append(token)

                assert tokens == ["Hello", " ", "world"]

    @pytest.mark.asyncio
    async def test_fallback_models_passed(self):
        """Test that fallback models are passed to acompletion."""
        with patch("src.services.llm_provider.acompletion") as mock_acompletion:
            mock_response = MagicMock()
            mock_response.choices = [MagicMock()]
            mock_response.choices[0].message.content = "Response"
            mock_acompletion.return_value = mock_response

            with patch("src.services.llm_provider.settings") as mock_settings:
                mock_settings.llm_model = "anthropic/claude-sonnet-4-20250514"
                mock_settings.llm_fallback_models = ["openai/gpt-4o"]
                mock_settings.LLM_TIMEOUT_SECONDS = 60.0
                mock_settings.LLM_NUM_RETRIES = 2

                provider = LLMProvider()
                await provider.complete("Test")

                # Check that fallbacks were passed
                call_kwargs = mock_acompletion.call_args.kwargs
                assert call_kwargs.get("fallbacks") == ["openai/gpt-4o"]


class TestGetLLMProvider:
    """Tests for get_llm_provider factory function."""

    def test_get_llm_provider_singleton(self):
        """Test that get_llm_provider returns cached instance."""
        # Reset global
        import src.services.llm_provider as llm_module
        llm_module._default_provider = None

        with patch("src.services.llm_provider.settings") as mock_settings:
            mock_settings.llm_model = "anthropic/claude-sonnet-4-20250514"
            mock_settings.llm_fallback_models = None
            mock_settings.LLM_TIMEOUT_SECONDS = 60.0
            mock_settings.LLM_NUM_RETRIES = 2

            provider1 = get_llm_provider()
            provider2 = get_llm_provider()

            assert provider1 is provider2
