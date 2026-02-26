"""Pydantic models for LLM usage records."""

from datetime import UTC, datetime

from pydantic import BaseModel, Field


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
    litellm_version: str = ""
    error_message: str | None = None


def extract_provider(model: str) -> str:
    """Extract provider from model string (e.g., 'anthropic/claude-...' -> 'anthropic')."""
    return model.split("/")[0] if "/" in model else "unknown"
