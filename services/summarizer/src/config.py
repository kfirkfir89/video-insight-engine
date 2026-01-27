"""Configuration settings for vie-summarizer service."""

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
        "default": "gemini/gemini-3-flash-preview",
        "fast": "gemini/gemini-2.5-flash-lite",
    },
}


def get_model(provider: str = "anthropic", tier: str = "default") -> str:
    """Get model name for provider and tier."""
    return MODEL_MAP.get(provider, MODEL_MAP["anthropic"]).get(tier, "default")


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # MongoDB
    MONGODB_URI: str = "mongodb://vie-mongodb:27017/video-insight-engine"

    # LLM Provider Configuration
    LLM_PROVIDER: str = "anthropic"  # anthropic, openai, gemini
    LLM_FAST_PROVIDER: str | None = None  # Optional separate provider for fast model
    LLM_FALLBACK_PROVIDER: str | None = None  # Optional fallback provider
    LLM_MODEL: str | None = None  # Override default model (e.g., "anthropic/claude-sonnet-4-20250514")
    LLM_FAST_MODEL: str | None = None  # Override fast model

    # Provider API Keys (set for providers you use)
    ANTHROPIC_API_KEY: str | None = None
    OPENAI_API_KEY: str | None = None
    GEMINI_API_KEY: str | None = None  # For Gemini (LiteLLM expects this name)

    # API callback
    API_URL: str = "http://vie-api:3000"
    INTERNAL_SECRET: str = "dev-internal-secret-change-me"

    # Limits
    MAX_VIDEO_DURATION_MINUTES: int = 180
    MIN_VIDEO_DURATION_SECONDS: int = 60
    LLM_TIMEOUT_SECONDS: float = 60.0
    LLM_NUM_RETRIES: int = 2
    LLM_MAX_TOKENS: int = 4096
    LLM_FAST_MAX_TOKENS: int = 2048

    # Token limits for LLM prompts (large safety nets - modern LLMs handle full transcripts)
    MAX_TRANSCRIPT_CHARS: int = 500000  # ~500K chars = well within all LLM limits
    MAX_SECTION_CHARS: int = 100000  # ~100K chars per section

    # Issue #18: Configurable batch size for parallel section processing
    SECTION_BATCH_SIZE: int = 3

    # SponsorBlock API timeout
    SPONSORBLOCK_TIMEOUT: float = 5.0

    # Webshare proxy (optional - for bypassing YouTube IP blocks)
    WEBSHARE_PROXY_USERNAME: str | None = None
    WEBSHARE_PROXY_PASSWORD: str | None = None

    # Whisper fallback (Phase 4 - for videos without captions)
    WHISPER_ENABLED: bool = True
    WHISPER_MAX_DURATION_MINUTES: int = 60

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


settings = Settings()
