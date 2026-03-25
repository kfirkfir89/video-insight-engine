"""LiteLLM-based multi-provider LLM abstraction for the assistant service.

Provides unified API for calling LLMs across Anthropic, OpenAI, and Gemini
with built-in fallbacks, retries, and streaming support.
"""

from __future__ import annotations

from collections.abc import AsyncGenerator
from typing import Any

from litellm import acompletion
from litellm.exceptions import (
    APIError,
    AuthenticationError,
    RateLimitError,
    ServiceUnavailableError as LiteLLMServiceUnavailable,
    Timeout,
)

from src.config import settings
from src.exceptions import LLMError
from src.logging_config import get_logger

logger = get_logger(__name__)



class LLMProvider:
    """Multi-provider LLM abstraction using LiteLLM.

    Supports Anthropic, OpenAI, and Gemini with automatic fallbacks.
    """

    def __init__(
        self,
        model: str | None = None,
        fallback_models: list[str] | None = None,
        timeout: float | None = None,
        num_retries: int | None = None,
    ) -> None:
        self._model = model or settings.llm_model
        self._fallback_models = fallback_models or settings.llm_fallback_models
        self._timeout = timeout if timeout is not None else settings.LLM_TIMEOUT_SECONDS
        self._num_retries = num_retries if num_retries is not None else settings.LLM_NUM_RETRIES

    @property
    def model(self) -> str:
        """Get the configured model."""
        return self._model

    def _extract_provider(self, model: str) -> str:
        """Extract provider from model string."""
        return model.split("/")[0] if "/" in model else "unknown"

    async def complete_with_messages(
        self,
        messages: list[dict],
        max_tokens: int = 2000,
    ) -> str:
        """Generate completion from message list.

        Args:
            messages: List of message dicts with role and content.
            max_tokens: Maximum tokens in response.

        Returns:
            Generated text content.

        Raises:
            LLMError: On any LLM provider failure.
        """
        kwargs: dict[str, Any] = {
            "model": self._model,
            "messages": messages,
            "max_tokens": max_tokens,
            "timeout": self._timeout,
            "num_retries": self._num_retries,
        }
        if self._fallback_models:
            kwargs["fallbacks"] = self._fallback_models

        try:
            response = await acompletion(**kwargs)
            choice = response.choices[0]
            if choice.finish_reason == "length":
                logger.warning(
                    "llm_response_truncated",
                    model=self._model,
                    max_tokens=max_tokens,
                )
            return choice.message.content or ""
        except (RateLimitError, Timeout, LiteLLMServiceUnavailable, APIError) as exc:
            logger.error(
                "llm_completion_failed",
                model=self._model,
                provider=self._extract_provider(self._model),
                error=str(exc),
            )
            raise LLMError(f"LLM completion failed: {exc}") from exc
        except AuthenticationError as exc:
            logger.error(
                "llm_auth_error",
                provider=self._extract_provider(self._model),
                error=str(exc),
            )
            raise LLMError(f"LLM authentication failed: {exc}") from exc

    async def stream_with_messages(
        self,
        messages: list[dict],
        max_tokens: int = 2000,
    ) -> AsyncGenerator[str, None]:
        """Stream completion tokens from message list.

        Args:
            messages: List of message dicts with role and content.
            max_tokens: Maximum tokens in response.

        Yields:
            String tokens as generated.

        Raises:
            LLMError: On any LLM provider failure.
        """
        kwargs: dict[str, Any] = {
            "model": self._model,
            "messages": messages,
            "max_tokens": max_tokens,
            "timeout": self._timeout,
            "num_retries": self._num_retries,
            "stream": True,
        }
        if self._fallback_models:
            kwargs["fallbacks"] = self._fallback_models

        try:
            response = await acompletion(**kwargs)
            async for chunk in response:
                content = chunk.choices[0].delta.content
                if content:
                    yield content
        except (RateLimitError, Timeout, LiteLLMServiceUnavailable, APIError) as exc:
            logger.error(
                "llm_stream_failed",
                model=self._model,
                provider=self._extract_provider(self._model),
                error=str(exc),
            )
            raise LLMError(f"LLM stream failed: {exc}") from exc
        except AuthenticationError as exc:
            logger.error(
                "llm_auth_error",
                provider=self._extract_provider(self._model),
                error=str(exc),
            )
            raise LLMError(f"LLM authentication failed: {exc}") from exc
