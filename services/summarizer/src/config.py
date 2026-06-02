"""Configuration settings for vie-summarizer service."""

import logging
from typing import ClassVar

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

    # Per-stage model overrides (None → fall back to LLM_FAST_MODEL).
    # Defaults reflect the 2026-05-19 fast-tier benchmark winners
    # (reports/fast-model-bench-20260519-074647.md). Override via env to test
    # alternatives without rebuilding.
    # Only the two stages with material wins (enrichment quality +35%,
    # vision -67% cost) are pinned. Classifier/translation stay on the
    # default fast tier (gpt-4o-mini); the Gemini Flash-Lite savings were
    # fractions of a cent — not worth adding a third provider dependency.
    LLM_CLASSIFIER_MODEL: str | None = None
    LLM_CHAPTER_DETECT_MODEL: str | None = None
    LLM_DESCRIPTION_MODEL: str | None = None
    LLM_SYNTHESIS_MODEL: str | None = None
    LLM_ENRICHMENT_MODEL: str | None = "anthropic/claude-haiku-4-5-20251001"
    LLM_TRANSLATION_MODEL: str | None = None
    LLM_VISION_MODEL: str | None = "anthropic/claude-haiku-4-5-20251001"
    # Extraction model override. Default `None` falls through to the primary
    # model (claude-sonnet-4-6 in production), preserving the current cost
    # profile. Set to "anthropic/claude-haiku-4-5-20251001" or another model
    # to A/B against Sonnet without rebuilding. Unlike EXTRACTION_USE_FAST_FIRST
    # (which routes the FIRST pass to the fast tier and escalates retries to
    # primary), this override pins ALL extraction passes — including retries —
    # to the chosen model. Use when you want a clean A/B with no escalation
    # noise; use EXTRACTION_USE_FAST_FIRST when you want a cost-saving first
    # pass with Sonnet as a safety net on failure.
    LLM_EXTRACTION_MODEL: str | None = None

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
    # Videos longer than this run chapter detection + chunked-batch extraction
    # (parallel Sonnet calls). Lowered 1800→900 on 2026-05-24 to halve the
    # wallclock for 15–30 min videos at the cost of a small chapter_detect
    # call (~$0.01) per newly-eligible video. Cost is roughly neutral once
    # prompt caching kicks in across the parallel batches.
    CHUNKED_EXTRACTION_THRESHOLD: int = 900  # seconds (15 min)
    MAX_TOKENS_PER_BATCH: int = 50000  # conservative token limit per extraction batch
    # Hard cap on the wall-clock span a single extraction batch may cover.
    # A batch can fit MAX_TOKENS_PER_BATCH yet still span hours (a talky 3h
    # segment is ~49K tokens) — and the fast model then front-loads and drops
    # the tail (a 4.5h video produced output only up to 1:34). Bounding span to
    # 40 min keeps each batch densely coverable within the 16K output budget.
    MAX_MINUTES_PER_BATCH: int = 40
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
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "console"  # "console" or "json"

    # ─── Langfuse observability ─────────────────────────────────────────
    # Leave keys blank to disable — every Langfuse helper is no-op when
    # init returns None, so tests and offline dev never hit the network.
    LANGFUSE_PUBLIC_KEY: str | None = None
    LANGFUSE_SECRET_KEY: str | None = None
    LANGFUSE_BASE_URL: str = "https://cloud.langfuse.com"
    # Faithfulness judge: fraction of extracted items to spot-check (0 disables).
    LANGFUSE_FAITHFULNESS_SAMPLE_RATE: float = 0.2
    # User-id propagation policy for Langfuse traces. Options:
    #   - "identity" (default): forward the internal user id as-is.
    #   - "hash":     SHA-256 of "<salt>::<id>" truncated to 16 chars.
    #   - "omit":     never include user_id in traces.
    # When compliance forbids per-user identifiers leaving the host, use
    # "omit"; for support-driven debugging keep "identity".
    LANGFUSE_USER_ID_MODE: str = "identity"
    LANGFUSE_USER_ID_HASH_SALT: str = ""

    # ─── Sentry error tracking ──────────────────────────────────────────
    # Empty DSN -> SDK no-ops. Lets dev/CI run without a live project.
    SENTRY_DSN: str = ""
    SENTRY_ENVIRONMENT: str | None = None  # Falls back to ENVIRONMENT when unset.
    SENTRY_RELEASE: str | None = None  # Usually the deploy SHA.
    # 0 disables performance tracing (errors still capture). 0.1 in prod, 1.0 in dev.
    SENTRY_TRACES_SAMPLE_RATE: float = 0.0

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

    # Sound-only force-English: when a music-category video has words-per-second
    # below this threshold, override the detected language to English. Whisper
    # hallucinates languages on instrumental audio; vocal songs stay well above
    # this floor (a sparse vocal song is ~0.33 wps, an instrumental is ~0.03).
    MUSIC_LANGUAGE_FORCE_EN_WPS: float = 0.15

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

    # Pipeline output-schema version. Baked into the REDIS response-cache key so
    # a bump makes every cached VIEResponse in Redis unreachable (it TTLs out).
    # NOTE: this only invalidates the Redis response cache — persisted MongoDB
    # `assembledTabs`/`output` docs are NOT version-keyed and still require a
    # reprocess / DB flush on a schema or props change. Bump on any
    # schemas/*.txt or assembler props change.
    PIPELINE_VERSION: str = "v5"

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

    # Map stage_name (as used in call_llm_with_retry) → settings attribute.
    # Used by stage call sites to look up their per-stage override, and by
    # the vision / description stages (which bypass the retry wrapper) to
    # read their own overrides. ClassVar marks this as a class-level
    # constant — without it, Pydantic v2 might try to interpret it as a
    # configurable field, which would silently break depending on version.
    _STAGE_TO_SETTING: ClassVar[dict[str, str]] = {
        "classifier": "LLM_CLASSIFIER_MODEL",
        "chapter_detect": "LLM_CHAPTER_DETECT_MODEL",
        "description_analysis": "LLM_DESCRIPTION_MODEL",
        "synthesis": "LLM_SYNTHESIS_MODEL",
        "enrichment": "LLM_ENRICHMENT_MODEL",
        "extraction": "LLM_EXTRACTION_MODEL",
        "translation": "LLM_TRANSLATION_MODEL",
        "translation_tabs": "LLM_TRANSLATION_MODEL",
        "translation_meta": "LLM_TRANSLATION_MODEL",
        "translation_labels": "LLM_TRANSLATION_MODEL",
        "vision": "LLM_VISION_MODEL",
    }

    def get_stage_model(self, stage_name: str) -> str | None:
        """Return the per-stage model override or None to use fast/primary."""
        attr = self._STAGE_TO_SETTING.get(stage_name)
        return getattr(self, attr, None) if attr else None

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
