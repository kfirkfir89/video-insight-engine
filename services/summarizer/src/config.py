"""Configuration settings for vie-summarizer service."""

import logging

from pydantic import Field
from pydantic_settings import BaseSettings

_DEFAULT_INTERNAL_SECRET = "dev-internal-secret-change-me"


# Model mapping for each provider
MODEL_MAP = {
    "anthropic": {
        "default": "anthropic/claude-sonnet-4-5-20250929",
        "fast": "anthropic/claude-3-5-haiku-20241022",
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

    # Environment
    ENVIRONMENT: str = ""  # development, test, staging, production

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
    INTERNAL_SECRET: str = Field(default=_DEFAULT_INTERNAL_SECRET, repr=False)

    # Limits
    # WARNING: 600 min (10 hours) is the hard cap.  Audio transcription of very
    # long videos is expensive ($3.60 Whisper + up to 30 min processing for 10h).
    # Deploy rate-limiting on the API gateway before exposing to untrusted users.
    MAX_VIDEO_DURATION_MINUTES: int = 600
    MIN_VIDEO_DURATION_SECONDS: int = 60
    LLM_TIMEOUT_SECONDS: float = 60.0
    LLM_NUM_RETRIES: int = 2
    LLM_MAX_TOKENS: int = 4096
    LLM_FAST_MAX_TOKENS: int = 4096

    # Token limits for LLM prompts (large safety nets - modern LLMs handle full transcripts)
    MAX_TRANSCRIPT_CHARS: int = 500000  # ~500K chars = well within all LLM limits
    MAX_CHAPTER_CHARS: int = 100000  # ~100K chars per chapter

    # Chapter-based chunked extraction
    CHAPTER_BATCH_SIZE: int = 3
    CHUNKED_EXTRACTION_THRESHOLD: int = 1800  # seconds (30 min) — videos longer than this use chunked extraction
    MAX_TOKENS_PER_BATCH: int = 50000  # conservative token limit per extraction batch
    CHUNKED_EXTRACTION_TIMEOUT: float = 300.0  # 5 min — per-batch timeout for chunked extraction

    # Timeout constants for pipeline stages
    TRANSCRIPT_FETCH_TIMEOUT: float = 30.0
    GEMINI_UPLOAD_TIMEOUT: float = 300.0

    # SponsorBlock API timeout
    SPONSORBLOCK_TIMEOUT: float = 5.0

    # Webshare proxy (optional - for bypassing YouTube IP blocks)
    WEBSHARE_PROXY_USERNAME: str | None = None
    WEBSHARE_PROXY_PASSWORD: str | None = None

    # Whisper fallback (Phase 4 - for videos without captions)
    # Max duration set to 600 min (10 hours) to support ultra-long content.
    # Cost implication: 10-hour video ≈ $3.60 Whisper API + up to 30 min processing.
    WHISPER_ENABLED: bool = True
    WHISPER_MAX_DURATION_MINUTES: int = 600

    # Logging
    log_level: str = "INFO"
    log_format: str = "console"  # "console" or "json"

    # S3 — uses existing vie-transcripts bucket for all media (frames, transcripts, audio)
    S3_BUCKET: str = "vie-transcripts"
    S3_PRESIGNED_URL_EXPIRY: int = 3600  # Presigned URL validity in seconds (1 hour)
    AWS_REGION: str = "us-east-1"
    AWS_ENDPOINT_URL: str | None = None  # Optional: custom endpoint for CI/CD testing (LocalStack)
    AWS_ACCESS_KEY_ID: str | None = None
    AWS_SECRET_ACCESS_KEY: str | None = None

    # Qdrant vector DB (for transcript chunk storage / RAG)
    QDRANT_HOST: str = "localhost"
    QDRANT_PORT: int = 6333
    QDRANT_ENABLED: bool = True

    # Redis response cache
    REDIS_URL: str = "redis://localhost:6379"
    REDIS_ENABLED: bool = True
    REDIS_CACHE_TTL: int = 60 * 60 * 24 * 30  # 30 days

    # Advanced transcript cleaning (spaCy + TF-IDF)
    TRANSCRIPT_CLEANING_ENABLED: bool = True

    # Scene-based frame extraction (additive to timestamp extraction)
    SCENE_EXTRACTION_ENABLED: bool = True
    SCENE_THRESHOLD: float = 0.3
    SCENE_MAX_FRAMES: int = 100

    # Vision LLM analysis on top-scored frames
    FRAME_VISION_ENABLED: bool = True
    FRAME_VISION_MAX_FRAMES: int = 8
    FRAME_VISION_TIMEOUT: float = 30.0

    # Frame extraction (visual blocks)
    # Default False for local dev (yt-dlp/ffmpeg may not be installed).
    # docker-compose.yml sets FRAME_EXTRACTION_ENABLED=true for container environments.
    FRAME_EXTRACTION_ENABLED: bool = False
    MAX_FRAMES_PER_VISUAL: int = 6     # Cap frames[] array length per visual block
    MAX_FRAMES_PER_CHAPTER: int = 12   # Total frames across all visual blocks in one chapter
    FRAME_MIN_SPACING_SECONDS: int = 20    # Min gap between frames in same block
    FRAME_WITHIN_BLOCK_DEDUP_THRESHOLD: int = 12  # aHash hamming distance (relaxed for within-block)

    # Prompt versioning (for regeneration tracking)
    PROMPT_VERSION: str = "v1.0"

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

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()


_PROD_ENVS = frozenset({"production", "prod", "staging", "stg"})
_DEV_ENVS = frozenset({"", "development", "dev", "test", "local"})


def validate_secrets() -> None:
    """Fail-fast if INTERNAL_SECRET is using the default value in production/staging.

    Called from application lifespan (not import time) to avoid breaking test imports.
    """
    env_name = settings.ENVIRONMENT.lower()
    if settings.INTERNAL_SECRET != _DEFAULT_INTERNAL_SECRET:
        return

    if env_name in _PROD_ENVS:
        raise ValueError(
            f"INTERNAL_SECRET must be set via environment variable in {env_name}! "
            "Using the default value is a security risk."
        )
    if env_name not in _DEV_ENVS:
        logging.getLogger(__name__).warning(
            "INTERNAL_SECRET is using the default value (ENVIRONMENT=%s) "
            "— set it via environment variable in production!", env_name,
        )
