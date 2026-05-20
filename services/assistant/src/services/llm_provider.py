"""LiteLLM-based multi-provider LLM abstraction for the assistant service.

Provides unified API for calling LLMs across Anthropic, OpenAI, and Gemini
with built-in fallbacks, retries, and streaming support.
"""

from __future__ import annotations

import time
from collections.abc import AsyncGenerator
from typing import Any

from litellm import acompletion, completion_cost
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
from src.services.observability import log_generation

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
        *,
        span_name: str | None = None,
        span_metadata: dict[str, Any] | None = None,
    ) -> str:
        """Generate completion from message list.

        Args:
            messages: List of message dicts with role and content.
            max_tokens: Maximum tokens in response.
            span_name: When non-None, record the call as a Langfuse generation
                span. Best-effort — observability failures are swallowed.
            span_metadata: Extra metadata merged into the generation span.

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
            start_monotonic = time.monotonic()
            response = await acompletion(**kwargs)
            latency_ms = int((time.monotonic() - start_monotonic) * 1000)
            choice = response.choices[0]
            if choice.finish_reason == "length":
                logger.warning(
                    "llm_response_truncated",
                    model=self._model,
                    max_tokens=max_tokens,
                )
            content = choice.message.content or ""
            if span_name:
                usage = getattr(response, "usage", None)
                self._log_generation_safe(
                    span_name=span_name,
                    msg_dicts=messages,
                    content=content,
                    input_tokens=getattr(usage, "prompt_tokens", 0) if usage else 0,
                    output_tokens=getattr(usage, "completion_tokens", 0) if usage else 0,
                    cost_usd=_safe_completion_cost(response=response),
                    latency_ms=latency_ms,
                    finish_reason=choice.finish_reason,
                    extra_metadata=span_metadata,
                )
            return content
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
        *,
        span_name: str | None = None,
        span_metadata: dict[str, Any] | None = None,
    ) -> AsyncGenerator[str, None]:
        """Stream completion tokens from message list.

        Args:
            messages: List of message dicts with role and content.
            max_tokens: Maximum tokens in response.
            span_name: When non-None, record the stream as a Langfuse generation
                on completion. ``stream_options={"include_usage": True}`` is
                added so OpenAI/compatible providers emit a final usage chunk;
                Anthropic/Gemini emit usage natively via LiteLLM normalisation.
            span_metadata: Extra metadata merged into the generation log.

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
        if span_name:
            kwargs["stream_options"] = {"include_usage": True}

        start_monotonic = time.monotonic()
        accumulated: list[str] = []
        usage: Any = None
        finish_reason: str | None = None

        try:
            response = await acompletion(**kwargs)
            async for chunk in response:
                choices = getattr(chunk, "choices", None) or []
                if choices:
                    choice = choices[0]
                    delta = getattr(choice, "delta", None)
                    content = getattr(delta, "content", None) if delta else None
                    if content:
                        accumulated.append(content)
                        yield content
                    fr = getattr(choice, "finish_reason", None)
                    if fr:
                        finish_reason = fr
                chunk_usage = getattr(chunk, "usage", None)
                if chunk_usage is not None:
                    usage = chunk_usage
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
                "llm_auth_error_stream",
                provider=self._extract_provider(self._model),
                error=str(exc),
            )
            raise LLMError(f"LLM authentication failed: {exc}") from exc

        if span_name:
            input_tokens = getattr(usage, "prompt_tokens", 0) if usage else 0
            output_tokens = getattr(usage, "completion_tokens", 0) if usage else 0
            self._log_generation_safe(
                span_name=span_name,
                msg_dicts=messages,
                content="".join(accumulated),
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                cost_usd=_safe_completion_cost(
                    model=self._model,
                    prompt_tokens=input_tokens,
                    completion_tokens=output_tokens,
                ),
                latency_ms=int((time.monotonic() - start_monotonic) * 1000),
                finish_reason=finish_reason,
                extra_metadata={"streamed": True, **(span_metadata or {})},
            )

    def _log_generation_safe(
        self,
        *,
        span_name: str,
        msg_dicts: list[dict],
        content: str,
        input_tokens: int,
        output_tokens: int,
        cost_usd: float,
        latency_ms: int,
        finish_reason: str | None,
        extra_metadata: dict[str, Any] | None,
    ) -> None:
        """Best-effort Langfuse generation log. ``log_generation`` swallows
        SDK failures internally, so no extra guard is needed here.
        """
        log_generation(
            name=span_name,
            model=self._model,
            input_payload=msg_dicts,
            output_payload=content,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cost_usd=cost_usd,
            latency_ms=latency_ms,
            metadata={
                "finishReason": finish_reason,
                **(extra_metadata or {}),
            },
        )

    async def translate_to_english(self, text: str) -> str | None:
        """Translate a short text to English for RAG search.

        Args:
            text: Non-English text to translate.

        Returns:
            English translation, or None on failure.
        """
        messages = [
            {
                "role": "system",
                "content": "Translate the following text to English. "
                           "Return only the translation, nothing else.",
            },
            {"role": "user", "content": text},
        ]
        try:
            result = await self.complete_with_messages(
                messages, max_tokens=500, span_name="query_translate",
            )
            return result.strip() if result else None
        except LLMError:
            # complete_with_messages already logs the detailed error
            return None


def _safe_completion_cost(
    *,
    response: Any | None = None,
    model: str | None = None,
    prompt_tokens: int = 0,
    completion_tokens: int = 0,
) -> float:
    """Best-effort wrapper around ``litellm.completion_cost``.

    LiteLLM raises for models without published pricing; this helper returns
    ``0.0`` instead so observability never breaks an LLM call.
    """
    try:
        if response is not None:
            return float(completion_cost(completion_response=response) or 0.0)
        if model and (prompt_tokens or completion_tokens):
            return float(
                completion_cost(
                    model=model,
                    prompt_tokens=prompt_tokens,
                    completion_tokens=completion_tokens,
                ) or 0.0
            )
    except Exception:  # noqa: BLE001  # litellm raises for unknown-cost models
        return 0.0
    return 0.0
