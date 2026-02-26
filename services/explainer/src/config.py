"""Configuration settings for vie-explainer service."""

from pydantic_settings import BaseSettings


# Model mapping for each provider
MODEL_MAP = {
    "anthropic": {
        "default": "anthropic/claude-sonnet-4-20250514",
        "fast": "anthropic/claude-3-5-haiku-20241022",
    },
    "openai": {
        "default": "openai/gpt-4o",
        "fast": "openai/gpt-4o-mini",
    },
    "gemini": {
        "default": "gemini/gemini-2.5-flash",
        "fast": "gemini/gemini-2.0-flash-lite",
    },
}


def get_model(provider: str = "gemini", tier: str = "default") -> str:
    """Get model name for provider and tier."""
    provider_models = MODEL_MAP.get(provider, MODEL_MAP["gemini"])
    return provider_models.get(tier, provider_models["default"])


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # MongoDB
    MONGODB_URI: str = "mongodb://vie-mongodb:27017/video-insight-engine"

    # LLM Provider Configuration
    # Explainer defaults to gemini (cheaper for interactive chat); summarizer defaults to anthropic.
    LLM_PROVIDER: str = "gemini"  # anthropic, openai, gemini
    LLM_FAST_PROVIDER: str | None = None  # Optional separate provider for fast model
    LLM_FALLBACK_PROVIDER: str | None = None  # Optional fallback provider
    LLM_MODEL: str | None = None  # Override default model
    LLM_FAST_MODEL: str | None = None  # Override fast model

    # Provider API Keys (set for providers you use)
    ANTHROPIC_API_KEY: str | None = None
    OPENAI_API_KEY: str | None = None
    GEMINI_API_KEY: str | None = None  # For Gemini (LiteLLM expects this name)

    # Internal service communication
    INTERNAL_SECRET: str = "dev-internal-secret-change-me"

    # LLM limits
    LLM_TIMEOUT_SECONDS: float = 60.0
    LLM_NUM_RETRIES: int = 2
    LLM_MAX_TOKENS: int = 4096
    LLM_FAST_MAX_TOKENS: int = 2048

    # Streaming configuration
    LLM_STREAM_MAX_WORKERS: int = 10
    LLM_STREAM_TOKEN_TIMEOUT_SECONDS: float = 60.0

    # Logging
    log_level: str = "INFO"
    log_format: str = "console"  # "console" or "json"

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
    def llm_fallback_models(self) -> list[str] | None:
        """Get fallback model chain if configured."""
        if self.LLM_FALLBACK_PROVIDER:
            return [get_model(self.LLM_FALLBACK_PROVIDER, "default")]
        return None

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
