"""Tests for LLM retry utility."""

import asyncio
import pytest
from unittest.mock import AsyncMock, MagicMock

from litellm.exceptions import APIError as LitellmAPIError

from src.utils.llm_retry import call_llm_with_retry, truncate_prompt_if_needed


@pytest.fixture
def mock_llm():
    """Mock LLM service with call_llm method."""
    service = MagicMock()
    service.call_llm = AsyncMock()
    service.call_llm_fast = AsyncMock()
    service.model = "anthropic/claude-sonnet-4-6"
    service.fast_model = "anthropic/claude-haiku-4-5-20251001"
    return service


class TestCallLlmWithRetry:
    """Test call_llm_with_retry function."""

    @pytest.mark.asyncio
    async def test_returns_response_on_success(self, mock_llm):
        mock_llm.call_llm.return_value = '{"key": "value"}'

        result = await call_llm_with_retry(
            mock_llm, "test prompt",
            max_tokens=1000, timeout=10.0, max_retries=2, stage_name="test",
        )

        assert result == '{"key": "value"}'
        assert mock_llm.call_llm.call_count == 1

    @pytest.mark.asyncio
    async def test_retries_on_timeout(self, mock_llm):
        mock_llm.call_llm.side_effect = [
            asyncio.TimeoutError(),
            '{"success": true}',
        ]

        result = await call_llm_with_retry(
            mock_llm, "test prompt",
            timeout=5.0, max_retries=1, stage_name="test",
        )

        assert result == '{"success": true}'
        assert mock_llm.call_llm.call_count == 2

    @pytest.mark.asyncio
    async def test_retries_on_exception(self, mock_llm):
        mock_llm.call_llm.side_effect = [
            LitellmAPIError(status_code=500, message="API error", llm_provider="anthropic", model="test-model"),
            '{"recovered": true}',
        ]

        result = await call_llm_with_retry(
            mock_llm, "test prompt",
            timeout=10.0, max_retries=1, stage_name="test",
        )

        assert result == '{"recovered": true}'
        assert mock_llm.call_llm.call_count == 2

    @pytest.mark.asyncio
    async def test_retries_on_empty_response(self, mock_llm):
        mock_llm.call_llm.side_effect = [
            "",
            "   ",
            '{"data": true}',
        ]

        result = await call_llm_with_retry(
            mock_llm, "test prompt",
            timeout=10.0, max_retries=2, stage_name="test",
        )

        assert result == '{"data": true}'
        assert mock_llm.call_llm.call_count == 3

    @pytest.mark.asyncio
    async def test_returns_none_after_all_retries_exhausted(self, mock_llm):
        mock_llm.call_llm.side_effect = asyncio.TimeoutError()

        result = await call_llm_with_retry(
            mock_llm, "test prompt",
            timeout=5.0, max_retries=2, stage_name="test",
        )

        assert result is None
        assert mock_llm.call_llm.call_count == 3

    @pytest.mark.asyncio
    async def test_no_retries_when_max_retries_zero(self, mock_llm):
        mock_llm.call_llm.side_effect = asyncio.TimeoutError()

        result = await call_llm_with_retry(
            mock_llm, "test prompt",
            timeout=5.0, max_retries=0, stage_name="test",
        )

        assert result is None
        assert mock_llm.call_llm.call_count == 1

    @pytest.mark.asyncio
    async def test_passes_correct_params_to_llm(self, mock_llm):
        mock_llm.call_llm.return_value = '{"ok": true}'

        await call_llm_with_retry(
            mock_llm, "my prompt",
            max_tokens=8192, timeout=30.0, max_retries=0, stage_name="triage",
        )

        mock_llm.call_llm.assert_called_once_with(
            "my prompt", max_tokens=8192, timeout=30.0, json_mode=False, cache_static=None,
        )

    @pytest.mark.asyncio
    async def test_returns_none_on_all_empty_responses(self, mock_llm):
        mock_llm.call_llm.return_value = ""

        result = await call_llm_with_retry(
            mock_llm, "test prompt",
            timeout=10.0, max_retries=1, stage_name="test",
        )

        assert result is None
        assert mock_llm.call_llm.call_count == 2

    @pytest.mark.asyncio
    async def test_success_on_first_attempt_no_retry(self, mock_llm):
        mock_llm.call_llm.return_value = "response"

        result = await call_llm_with_retry(
            mock_llm, "prompt",
            timeout=60.0, max_retries=5, stage_name="test",
        )

        assert result == "response"
        assert mock_llm.call_llm.call_count == 1

    @pytest.mark.asyncio
    async def test_mixed_failure_types(self, mock_llm):
        mock_llm.call_llm.side_effect = [
            asyncio.TimeoutError(),
            LitellmAPIError(status_code=429, message="rate limited", llm_provider="anthropic", model="test-model"),
            '{"finally": true}',
        ]

        result = await call_llm_with_retry(
            mock_llm, "prompt",
            timeout=5.0, max_retries=2, stage_name="test",
        )

        assert result == '{"finally": true}'
        assert mock_llm.call_llm.call_count == 3

    @pytest.mark.asyncio
    async def test_use_fast_model_routes_to_call_llm_fast(self, mock_llm):
        mock_llm.call_llm_fast.return_value = '{"fast": true}'

        result = await call_llm_with_retry(
            mock_llm, "test prompt",
            max_tokens=1000, timeout=10.0, max_retries=0, stage_name="test",
            use_fast_model=True,
        )

        assert result == '{"fast": true}'
        mock_llm.call_llm_fast.assert_called_once()
        mock_llm.call_llm.assert_not_called()

    @pytest.mark.asyncio
    async def test_use_fast_model_false_routes_to_call_llm(self, mock_llm):
        mock_llm.call_llm.return_value = '{"default": true}'

        result = await call_llm_with_retry(
            mock_llm, "test prompt",
            max_tokens=1000, timeout=10.0, max_retries=0, stage_name="test",
            use_fast_model=False,
        )

        assert result == '{"default": true}'
        mock_llm.call_llm.assert_called_once()
        mock_llm.call_llm_fast.assert_not_called()


class TestTruncatePromptIfNeeded:
    def test_short_prompt_unchanged(self):
        prompt = "Short prompt"
        result = truncate_prompt_if_needed(prompt, "anthropic/claude-sonnet-4-6")
        assert result == prompt

    def test_long_prompt_truncated(self):
        prompt = "x" * 700_000
        result = truncate_prompt_if_needed(prompt, "anthropic/claude-sonnet-4-6")
        assert len(result) < 700_000
        assert result.endswith("[TRANSCRIPT TRUNCATED DUE TO LENGTH]")

    def test_unknown_model_uses_default_limit(self):
        prompt = "x" * 400_000
        result = truncate_prompt_if_needed(prompt, "unknown/model")
        assert len(result) < 400_000
        assert result.endswith("[TRANSCRIPT TRUNCATED DUE TO LENGTH]")

    def test_gemini_has_large_limit(self):
        prompt = "x" * 500_000
        result = truncate_prompt_if_needed(prompt, "gemini/gemini-2.5-flash")
        assert result == prompt  # 500K < 3M limit
