"""LLM call wrapper with timeout, retry, and structured logging.

Provides a single function that every pipeline stage uses for LLM calls.
Handles transient failures (timeout, rate limit, API errors) with
exponential backoff. Returns raw string or None (never raises).
"""

from __future__ import annotations

import asyncio
import logging
import time
from typing import TYPE_CHECKING

from litellm.exceptions import APIError as LitellmAPIError, RateLimitError, Timeout as LitellmTimeout

if TYPE_CHECKING:
    from src.services.llm import LLMService

logger = logging.getLogger(__name__)

# Conservative character limits per model family (leaves headroom for system overhead).
# These are safety nets — chunking should prevent them from triggering.
MODEL_CHAR_LIMITS: dict[str, int] = {
    "anthropic/claude-sonnet-4-5-20250929": 600_000,
    "anthropic/claude-3-5-haiku-20241022": 600_000,
    "openai/gpt-4o": 380_000,
    "openai/gpt-4o-mini": 380_000,
    "gemini/gemini-2.5-flash": 3_000_000,
    "gemini/gemini-2.5-flash-lite": 3_000_000,
}

DEFAULT_CHAR_LIMIT = 300_000


def truncate_prompt_if_needed(prompt: str, model: str) -> str:
    """Truncate prompt to model's character limit if exceeded.

    This is a safety net — chunked extraction should prevent it from
    ever triggering. Logs a warning when truncation occurs.
    """
    limit = MODEL_CHAR_LIMITS.get(model, DEFAULT_CHAR_LIMIT)
    if len(prompt) > limit:
        logger.warning(
            "Prompt truncated from %d to %d chars for model %s (limit=%d)",
            len(prompt), limit, model, limit,
        )
        return prompt[:limit] + "\n\n[TRANSCRIPT TRUNCATED DUE TO LENGTH]"
    return prompt


async def call_llm_with_retry(
    llm_service: LLMService,
    prompt: str,
    *,
    max_tokens: int = 4096,
    timeout: float = 60.0,
    max_retries: int = 2,
    stage_name: str = "unknown",
    use_fast_model: bool = False,
    json_mode: bool = False,
    cache_static: str | None = None,
) -> str | None:
    """Call LLM with timeout and retry. Returns raw string or None.

    Args:
        llm_service: LLMService instance with call_llm / call_llm_fast methods.
        prompt: The prompt to send.
        max_tokens: Maximum tokens in response.
        timeout: Per-attempt timeout in seconds.
        max_retries: Maximum retry attempts (0 = no retries).
        stage_name: Name for logging (e.g., "triage", "extraction").
        use_fast_model: When True, route to the fast model (Haiku/mini/flash-lite).

    Returns:
        Raw LLM response string, or None if all attempts failed.
    """
    # Safety net: truncate oversized prompts
    model_name = llm_service.fast_model if use_fast_model else llm_service.model
    prompt = truncate_prompt_if_needed(prompt, model_name)

    for attempt in range(max_retries + 1):
        start = time.monotonic()
        try:
            if use_fast_model:
                raw = await llm_service.call_llm_fast(
                    prompt, max_tokens=max_tokens, timeout=timeout, json_mode=json_mode,
                )
            else:
                raw = await llm_service.call_llm(
                    prompt, max_tokens=max_tokens, timeout=timeout,
                    json_mode=json_mode, cache_static=cache_static,
                )
            duration = time.monotonic() - start

            if raw and raw.strip():
                logger.info(
                    "[%s] LLM call succeeded in %.1fs (attempt %d/%d, model=%s)",
                    stage_name, duration, attempt + 1, max_retries + 1, model_name,
                )
                return raw

            logger.warning(
                "[%s] Empty LLM response in %.1fs (attempt %d/%d)",
                stage_name, duration, attempt + 1, max_retries + 1,
            )

        except asyncio.TimeoutError:
            duration = time.monotonic() - start
            logger.warning(
                "[%s] Timeout after %.1fs (attempt %d/%d)",
                stage_name, duration, attempt + 1, max_retries + 1,
            )

        except (LitellmAPIError, RateLimitError, LitellmTimeout, OSError, ConnectionError) as e:
            # Transient LLM/network errors — safe to retry.
            # Programming errors (TypeError, AttributeError, etc.) propagate immediately.
            duration = time.monotonic() - start
            logger.warning(
                "[%s] LLM error in %.1fs: %s (attempt %d/%d)",
                stage_name, duration, str(e)[:200], attempt + 1, max_retries + 1,
            )

        if attempt < max_retries:
            backoff = 1.0 * (attempt + 1)
            logger.info("[%s] Retrying in %.0fs...", stage_name, backoff)
            await asyncio.sleep(backoff)

    logger.error("[%s] All %d attempts failed", stage_name, max_retries + 1)
    return None
