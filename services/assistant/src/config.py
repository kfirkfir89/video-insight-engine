"""Configuration settings for vie-assistant service."""

from __future__ import annotations

import logging

from pydantic import Field
from pydantic_settings import BaseSettings

_DEFAULT_INTERNAL_SECRET = "dev-internal-secret-change-me"

# Model mapping for each provider
MODEL_MAP = {
    "anthropic": {
        "default": "anthropic/claude-sonnet-4-6",
        "fast": "anthropic/claude-haiku-4-5-20251001",
    },
    "openai": {
        "default": "openai/gpt-4o",
        "fast": "openai/gpt-4o-mini",
    },
    "gemini": {
        "default": "gemini/gemini-2.5-flash",
        "fast": "gemini/gemini-2.5-flash-lite",
    },
}


def get_model(provider: str = "anthropic", tier: str = "default") -> str:
    """Get model name for provider and tier."""
    provider_models = MODEL_MAP.get(provider, MODEL_MAP["anthropic"])
    return provider_models.get(tier, provider_models["default"])


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Server
    ASSISTANT_PORT: int = 8001

    # MongoDB
    MONGODB_URI: str = "mongodb://vie-mongodb:27017/video-insight-engine"

    # Qdrant
    QDRANT_URL: str = "http://vie-qdrant:6333"
    QDRANT_COLLECTION: str = "transcript_chunks"

    # Internal auth
    INTERNAL_SECRET: str = Field(default=_DEFAULT_INTERNAL_SECRET, repr=False)

    # vie-api gateway (outbound internal calls — reuses INTERNAL_SECRET)
    VIE_API_URL: str = "http://vie-api:3000"

    # LLM Provider Configuration
    LLM_PROVIDER: str = "anthropic"
    LLM_FAST_PROVIDER: str | None = None
    LLM_FALLBACK_PROVIDER: str | None = None
    LLM_MODEL: str | None = None
    LLM_FAST_MODEL: str | None = None
    # Model for the RAG chat + agentic loop specifically. Unset → primary
    # provider's fast tier (Haiku) — chat is high-volume/latency-sensitive.
    LLM_CHAT_MODEL: str | None = None

    # Provider API Keys
    ANTHROPIC_API_KEY: str | None = None
    OPENAI_API_KEY: str | None = None
    GEMINI_API_KEY: str | None = None

    # LLM limits
    LLM_TIMEOUT_SECONDS: float = 60.0
    LLM_NUM_RETRIES: int = 2

    # Assistant limits
    MAX_CONTEXT_CHUNKS: int = 8
    MAX_CONVERSATION_TURNS: int = 20

    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "console"

    # ─── Langfuse observability ─────────────────────────────────────────
    # Leave keys blank to disable — every Langfuse helper is no-op when
    # init returns None, so tests and offline dev never hit the network.
    LANGFUSE_PUBLIC_KEY: str | None = None
    LANGFUSE_SECRET_KEY: str | None = None
    LANGFUSE_BASE_URL: str = "https://cloud.langfuse.com"
    # User-id propagation policy. See summarizer/src/config.py for semantics.
    LANGFUSE_USER_ID_MODE: str = "identity"
    LANGFUSE_USER_ID_HASH_SALT: str = ""

    # ─── Sentry error tracking ──────────────────────────────────────────
    # Empty DSN -> SDK no-ops. Lets dev/CI run without a live project.
    SENTRY_DSN: str = ""
    SENTRY_ENVIRONMENT: str | None = None
    SENTRY_RELEASE: str | None = None
    SENTRY_TRACES_SAMPLE_RATE: float = 0.0

    @property
    def llm_model(self) -> str:
        """Get the configured LLM model with provider prefix."""
        if self.LLM_MODEL:
            return self.LLM_MODEL
        return get_model(self.LLM_PROVIDER, "default")

    @property
    def llm_fast_model(self) -> str:
        """Get the configured fast LLM model with provider prefix."""
        if self.LLM_FAST_MODEL:
            return self.LLM_FAST_MODEL
        provider = self.LLM_FAST_PROVIDER or self.LLM_PROVIDER
        return get_model(provider, "fast")

    @property
    def llm_chat_model(self) -> str:
        """Model for the RAG chat + agentic loop.

        Defaults to the PRIMARY provider's fast tier (Haiku for anthropic) —
        chat is high-volume and latency-sensitive. Deliberately resolves via
        ``get_model(LLM_PROVIDER, "fast")`` rather than ``llm_fast_model`` so
        chat stays on the same provider family regardless of
        ``LLM_FAST_PROVIDER``. Pin a specific model with ``LLM_CHAT_MODEL``.
        """
        if self.LLM_CHAT_MODEL:
            return self.LLM_CHAT_MODEL
        return get_model(self.LLM_PROVIDER, "fast")

    @property
    def llm_fallback_models(self) -> list[str] | None:
        """Get fallback model chain if configured."""
        if self.LLM_FALLBACK_PROVIDER:
            return [get_model(self.LLM_FALLBACK_PROVIDER, "default")]
        return None

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()


def validate_internal_secret() -> None:
    """Warn if INTERNAL_SECRET is using the default value.

    Called from application lifespan (not import time) to avoid breaking test imports.
    """
    if settings.INTERNAL_SECRET == _DEFAULT_INTERNAL_SECRET:
        logging.getLogger(__name__).warning(
            "INTERNAL_SECRET is using the default value — set it via environment variable in production!"
        )
