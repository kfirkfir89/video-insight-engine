"""LLM call telemetry — Langfuse generation logging extracted from the provider.

Kept as standalone helpers so :mod:`src.services.llm_provider` stays focused
on completion plumbing. Every helper here is best-effort: observability
outages must never bubble out of an LLM call.
"""

from __future__ import annotations

import logging
import time
from typing import Any

from litellm.cost_calculator import completion_cost

from src.services.observability import log_generation

logger = logging.getLogger(__name__)


def stopwatch_ms_since(start_monotonic: float) -> int:
    """Convert a ``time.monotonic()`` start into elapsed milliseconds."""
    return int((time.monotonic() - start_monotonic) * 1000)


def record_generation(
    *,
    span_name: str,
    model: str,
    msg_dicts: list[dict[str, Any]],
    content: str,
    response: Any,
    latency_ms: int,
    finish_reason: str | None,
    extra_metadata: dict[str, Any] | None,
) -> None:
    """Best-effort Langfuse generation log.

    Wrapped in a broad try/except — observability outages must never
    bubble out of an LLM call.
    """
    try:
        usage = getattr(response, "usage", None)
        input_tokens = getattr(usage, "prompt_tokens", 0) if usage else 0
        output_tokens = getattr(usage, "completion_tokens", 0) if usage else 0
        cost = 0.0
        try:
            cost = completion_cost(completion_response=response) or 0.0
        except Exception as exc:  # noqa: BLE001 — cost lookup is non-critical
            logger.debug("Cost lookup failed (span=%s): %s", span_name, exc)
        log_generation(
            name=span_name,
            model=model,
            input_payload=msg_dicts,
            output_payload=content,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cost_usd=cost,
            latency_ms=latency_ms,
            metadata={
                "finishReason": finish_reason,
                **(extra_metadata or {}),
            },
        )
    except Exception as exc:  # noqa: BLE001
        logger.debug("Generation record skipped (span=%s): %s", span_name, exc)
