"""LiteLLM-based multi-provider LLM abstraction.

Provides unified API for calling LLMs across Anthropic, OpenAI, and Gemini
with built-in fallbacks, retries, and cost tracking.
"""

import logging
from collections.abc import AsyncGenerator
from datetime import UTC, datetime
from typing import Any

from litellm import acompletion, completion_cost
from litellm.exceptions import (
    APIError,
    AuthenticationError,
    RateLimitError,
    ServiceUnavailableError,
    Timeout,
)
from pydantic import BaseModel

from src.config import settings

logger = logging.getLogger(__name__)


class Message(BaseModel):
    """Chat message for LLM conversation."""

    role: str  # "system", "user", "assistant"
    content: str


class CompletionResult(BaseModel):
    """Result from an LLM completion."""

    content: str
    model: str
    input_tokens: int
    output_tokens: int
    cost_usd: float
    duration_ms: int


class LLMProvider:
    """Multi-provider LLM abstraction using LiteLLM.

    Supports Anthropic, OpenAI, and Gemini with automatic fallbacks.
    """

    def __init__(
        self,
        model: str | None = None,
        fast_model: str | None = None,
        fallback_models: list[str] | None = None,
        timeout: float | None = None,
        num_retries: int | None = None,
    ):
        """Initialize LLM provider.

        Args:
            model: Model to use (e.g., "anthropic/claude-sonnet-4-20250514")
            fast_model: Fast model for quick tasks (e.g., "anthropic/claude-3-5-haiku-20241022")
            fallback_models: List of fallback models if primary fails
            timeout: Request timeout in seconds
            num_retries: Number of retries on failure
        """
        self._model = model or settings.llm_model
        self._fast_model = fast_model or settings.llm_fast_model
        self._fallback_models = fallback_models or settings.llm_fallback_models
        self._timeout = timeout or settings.LLM_TIMEOUT_SECONDS
        self._num_retries = num_retries or settings.LLM_NUM_RETRIES

    @property
    def model(self) -> str:
        """Get the configured model."""
        return self._model

    @property
    def fast_model(self) -> str:
        """Get the configured fast model for quick tasks."""
        return self._fast_model

    def _extract_provider(self, model: str) -> str:
        """Extract provider from model string."""
        return model.split("/")[0] if "/" in model else "unknown"

    async def complete(
        self,
        prompt: str,
        max_tokens: int = 2000,
        system_prompt: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> str:
        """Generate completion from prompt.

        Args:
            prompt: User prompt
            max_tokens: Maximum tokens in response
            system_prompt: Optional system prompt
            metadata: Optional metadata for tracking (user_id, feature, etc.)

        Returns:
            Generated text content

        Raises:
            RateLimitError: Rate limit exceeded
            AuthenticationError: Invalid API key
            Timeout: Request timed out
            APIError: General API error
        """
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        return await self.complete_with_messages(messages, max_tokens, metadata)

    async def complete_fast(
        self,
        prompt: str,
        max_tokens: int = 50,
        timeout: float = 5.0,
    ) -> str:
        """Generate quick completion using fast model.

        Uses the fast model (e.g., Haiku) for simple classifications
        and quick responses. Has shorter timeout than regular complete().

        Args:
            prompt: User prompt
            max_tokens: Maximum tokens in response (default 50)
            timeout: Request timeout in seconds (default 5.0)

        Returns:
            Generated text content

        Raises:
            RateLimitError: Rate limit exceeded
            Timeout: Request timed out
            APIError: General API error
        """
        try:
            kwargs: dict[str, Any] = {
                "model": self._fast_model,
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": max_tokens,
                "timeout": timeout,
                "num_retries": 1,  # Fewer retries for fast calls
            }

            response = await acompletion(**kwargs)
            choice = response.choices[0]
            if choice.finish_reason == "length":
                logger.warning(
                    "LLM response truncated (finish_reason=length), model=%s, max_tokens=%d",
                    self._fast_model, max_tokens,
                )
            return choice.message.content or ""

        except RateLimitError as e:
            logger.warning("Rate limited by %s: %s", self._extract_provider(self._fast_model), e)
            raise
        except Timeout as e:
            logger.warning("Fast model timeout after %ss: %s", timeout, e)
            raise
        except APIError as e:
            logger.error("Fast model API error: %s", e)
            raise

    async def complete_with_messages(
        self,
        messages: list[dict | Message],
        max_tokens: int = 2000,
        metadata: dict[str, Any] | None = None,
    ) -> str:
        """Generate completion from message list.

        Args:
            messages: List of messages (dict or Message objects)
            max_tokens: Maximum tokens in response
            metadata: Optional metadata for tracking

        Returns:
            Generated text content
        """
        # Convert Message objects to dicts
        msg_dicts = [
            m.model_dump() if isinstance(m, Message) else m for m in messages
        ]

        try:
            # Build kwargs, only including optional params if set
            kwargs: dict[str, Any] = {
                "model": self._model,
                "messages": msg_dicts,
                "max_tokens": max_tokens,
                "timeout": self._timeout,
                "num_retries": self._num_retries,
            }
            if self._fallback_models:
                kwargs["fallbacks"] = self._fallback_models
            if metadata:
                kwargs["metadata"] = metadata

            response = await acompletion(**kwargs)
            choice = response.choices[0]
            if choice.finish_reason == "length":
                logger.warning(
                    "LLM response truncated (finish_reason=length), model=%s, max_tokens=%d",
                    self._model, max_tokens,
                )
            return choice.message.content or ""

        except RateLimitError as e:
            logger.warning("Rate limited by %s: %s", self._extract_provider(self._model), e)
            raise
        except AuthenticationError as e:
            logger.error("Auth error for %s: %s", self._extract_provider(self._model), e)
            raise
        except Timeout as e:
            logger.warning("Timeout after %ss: %s", self._timeout, e)
            raise
        except ServiceUnavailableError as e:
            logger.warning("Service unavailable: %s", e)
            raise
        except APIError as e:
            logger.error("API error: %s", e)
            raise

    async def complete_with_tracking(
        self,
        prompt: str,
        max_tokens: int = 2000,
        system_prompt: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> CompletionResult:
        """Generate completion with full tracking info.

        Args:
            prompt: User prompt
            max_tokens: Maximum tokens in response
            system_prompt: Optional system prompt
            metadata: Optional metadata for tracking

        Returns:
            CompletionResult with content and usage info
        """
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        start_time = datetime.now(UTC)

        # Build kwargs, only including optional params if set
        kwargs: dict[str, Any] = {
            "model": self._model,
            "messages": messages,
            "max_tokens": max_tokens,
            "timeout": self._timeout,
            "num_retries": self._num_retries,
        }
        if self._fallback_models:
            kwargs["fallbacks"] = self._fallback_models
        if metadata:
            kwargs["metadata"] = metadata

        response = await acompletion(**kwargs)

        if response.choices[0].finish_reason == "length":
            logger.warning(
                "LLM response truncated (finish_reason=length), model=%s, max_tokens=%d",
                self._model, max_tokens,
            )

        end_time = datetime.now(UTC)
        duration_ms = int((end_time - start_time).total_seconds() * 1000)

        # Calculate cost using LiteLLM's built-in function
        cost = 0.0
        try:
            cost = completion_cost(completion_response=response)
        except Exception as e:
            logger.warning("Could not calculate cost: %s", e)

        return CompletionResult(
            content=response.choices[0].message.content or "",
            model=response.model or self._model,
            input_tokens=response.usage.prompt_tokens if response.usage else 0,
            output_tokens=response.usage.completion_tokens if response.usage else 0,
            cost_usd=cost,
            duration_ms=duration_ms,
        )

    async def stream(
        self,
        prompt: str,
        max_tokens: int = 2000,
        system_prompt: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> AsyncGenerator[str, None]:
        """Stream completion tokens from prompt.

        Args:
            prompt: User prompt
            max_tokens: Maximum tokens in response
            system_prompt: Optional system prompt
            metadata: Optional metadata for tracking

        Yields:
            String tokens as generated
        """
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        async for token in self.stream_with_messages(messages, max_tokens, metadata):
            yield token

    async def stream_with_messages(
        self,
        messages: list[dict | Message],
        max_tokens: int = 2000,
        metadata: dict[str, Any] | None = None,
    ) -> AsyncGenerator[str, None]:
        """Stream completion tokens from message list.

        Args:
            messages: List of messages
            max_tokens: Maximum tokens in response
            metadata: Optional metadata for tracking

        Yields:
            String tokens as generated
        """
        # Convert Message objects to dicts
        msg_dicts = [
            m.model_dump() if isinstance(m, Message) else m for m in messages
        ]

        try:
            # Build kwargs, only including optional params if set
            kwargs: dict[str, Any] = {
                "model": self._model,
                "messages": msg_dicts,
                "max_tokens": max_tokens,
                "timeout": self._timeout,
                "num_retries": self._num_retries,
                "stream": True,
            }
            if self._fallback_models:
                kwargs["fallbacks"] = self._fallback_models
            if metadata:
                kwargs["metadata"] = metadata

            response = await acompletion(**kwargs)

            async for chunk in response:
                content = chunk.choices[0].delta.content
                if content:
                    yield content

        except RateLimitError as e:
            logger.warning("Rate limited during stream: %s", e)
            raise
        except AuthenticationError as e:
            logger.error("Auth error during stream: %s", e)
            raise
        except Timeout as e:
            logger.warning("Stream timeout: %s", e)
            raise
        except APIError as e:
            logger.error("API error during stream: %s", e)
            raise


# Default provider instance (can be overridden via DI)
_default_provider: LLMProvider | None = None


def get_llm_provider() -> LLMProvider:
    """Get or create default LLM provider instance."""
    global _default_provider
    if _default_provider is None:
        _default_provider = LLMProvider()
    return _default_provider
