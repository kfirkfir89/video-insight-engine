"""Configuration settings for vie-summarizer service."""

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

    # Environment
    ENVIRONMENT: str = ""  # development, test, staging, production

    # MongoDB
    MONGODB_URI: str = "mongodb://vie-mongodb:27017/video-insight-engine"

    # LLM Provider Configuration
    LLM_PROVIDER: str = "anthropic"  # anthropic, openai, gemini
    LLM_FAST_PROVIDER: str | None = None  # Optional separate provider for fast model
    LLM_FALLBACK_PROVIDER: str | None = None  # Optional fallback provider
    LLM_MODEL: str | None = None  # Override default model (e.g., "anthropic/claude-sonnet-4-6")
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
    # Parallel concurrency for the chunked extraction batches. Defaults to 2
    # because production has hit Anthropic 529 (overloaded) at 3 concurrent
    # Sonnet calls; 2 keeps tail latency stable while still ~halving wall time.
    EXTRACTION_PARALLEL_BATCHES: int = 2
    # Force-split target — kept aligned with EXTRACTION_PARALLEL_BATCHES * 2
    # so a single round of the parallel limit drains half the chunks.
    EXTRACTION_FORCE_SPLIT_CHUNKS: int = 4
    # Phase 4 / P2: route the *first* extraction pass through the fast model.
    # Default OFF — flip via env after the corpus eval (scripts/eval_extraction_models.py)
    # confirms quality delta < 0.05 across all primary domains. Retries always
    # escalate to the primary model regardless of this flag.
    EXTRACTION_USE_FAST_FIRST: bool = False

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

    # Embedding model — drop-in alternatives must keep VECTOR_SIZE=384 (e.g. BAAI/bge-small-en-v1.5).
    EMBEDDING_MODEL_NAME: str = "all-MiniLM-L6-v2"

    # Redis response cache
    REDIS_URL: str = "redis://localhost:6379"
    REDIS_ENABLED: bool = True
    REDIS_CACHE_TTL: int = 60 * 60 * 24 * 30  # 30 days

    # Pipeline event broker (Redis Streams).
    # Lock TTL must outlive the longest realistic pipeline run; stream TTL
    # gives late joiners a chance to drain after the producer finishes.
    PIPELINE_LOCK_TTL_SECONDS: int = 600  # 10 min — auto-expire if producer crashes
    PIPELINE_STREAM_TTL_SECONDS: int = 120  # 2 min retention after DONE
    PIPELINE_STREAM_MAXLEN: int = 2000  # MAXLEN ~ for XADD ring-buffer

    # Advanced transcript cleaning (spaCy + TF-IDF)
    TRANSCRIPT_CLEANING_ENABLED: bool = True

    # Scene-based frame extraction (additive to timestamp extraction)
    SCENE_EXTRACTION_ENABLED: bool = True
    SCENE_THRESHOLD: float = 0.3
    SCENE_MAX_FRAMES: int = 100

    # Vision LLM analysis on top-scored frames.
    # Sending 8 base64 frames to Sonnet legitimately takes 30-50s under load;
    # a 60s budget is the right line between "catches real stalls" and "loses
    # context to premature timeout."
    FRAME_VISION_ENABLED: bool = True
    FRAME_VISION_MAX_FRAMES: int = 8
    FRAME_VISION_TIMEOUT: float = 60.0

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

    # ─── RabbitMQ worker ────────────────────────────────────────────────
    # AMQP URL — kept aligned with the API's RABBITMQ_URL in docker-compose.
    RABBITMQ_URL: str = "amqp://vie:vie-dev@vie-rabbitmq:5672/"
    # Concurrent jobs processed in one worker process. Cap matches the LLM
    # provider's parallelism — 2 keeps Anthropic 529 (overloaded) rare.
    WORKER_CONCURRENCY: int = 2
    # Re-publish a failed message up to this many times before sending to DLQ.
    # Tracked via the x-attempt header so retries survive restarts.
    WORKER_MAX_RETRIES: int = 3
    # Initial backoff for retry republish (seconds). Doubles each attempt.
    WORKER_RETRY_BACKOFF_SECONDS: float = 5.0
    # Prefetch — RabbitMQ pushes at most this many unacked messages to one
    # consumer. Setting it ~= 2x concurrency keeps the pipeline full without
    # holding messages a second consumer could be processing.
    WORKER_PREFETCH: int = 4

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
