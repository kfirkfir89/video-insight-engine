"""Pydantic models for LLM usage records."""

import structlog
from datetime import UTC, datetime

from pydantic import BaseModel, Field

logger = structlog.get_logger(__name__)


class UsageRecord(BaseModel):
    """A single LLM API call record stored in MongoDB."""

    model: str
    provider: str
    tokens_in: int = 0
    tokens_out: int = 0
    cost_usd: float = 0.0
    feature: str = "unknown"
    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))
    success: bool = True
    duration_ms: int = 0
    request_id: str | None = None
    video_id: str | None = None
    is_stream: bool = False
    service: str = "unknown"
    prompt_preview: str = ""
    prompt_hash: str = ""
    cache_hit: bool = False
    cache_creation_tokens: int = 0
    cache_read_tokens: int = 0
    cache_savings_usd: float = 0.0
    litellm_version: str = ""
    error_message: str | None = None


# Per-model input pricing (USD per 1M tokens) for the cache-savings estimate.
# Cached reads bill at ~10% of normal input; the savings are the delta between
# what we would have paid (input rate) and what was actually billed (cache_read).
_CACHE_RATES_USD_PER_M: dict[str, dict[str, float]] = {
    "anthropic/claude-sonnet-4-6": {"input": 3.00, "cache_read": 0.30},
    "anthropic/claude-sonnet-4-5": {"input": 3.00, "cache_read": 0.30},
    "anthropic/claude-haiku-4-5-20251001": {"input": 1.00, "cache_read": 0.10},
    "anthropic/claude-haiku-4-5": {"input": 1.00, "cache_read": 0.10},
}


_LOGGED_MISSING_RATE_MODELS: set[str] = set()


def compute_cache_savings_usd(model: str, cache_read_tokens: int) -> float:
    """Estimate USD saved by serving cached input tokens.

    Returns 0.0 for unmapped models — better to under-report than to invent
    savings from a guess. When an Anthropic model is missing from the rate
    map (typical signal: a model rename in config that wasn't mirrored here),
    log once per model so the drift is visible without flooding the buffer.
    """
    if cache_read_tokens <= 0:
        return 0.0
    rates = _CACHE_RATES_USD_PER_M.get(model)
    if not rates:
        if model.startswith("anthropic/") and model not in _LOGGED_MISSING_RATE_MODELS:
            _LOGGED_MISSING_RATE_MODELS.add(model)
            logger.info(
                "cache.rate_missing",
                model=model,
                hint="add to llm_common.models._CACHE_RATES_USD_PER_M",
            )
        return 0.0
    delta = rates["input"] - rates["cache_read"]
    return (cache_read_tokens / 1_000_000) * delta


def extract_provider(model: str) -> str:
    """Extract provider from model string (e.g., 'anthropic/claude-...' -> 'anthropic')."""
    return model.split("/")[0] if "/" in model else "unknown"
