"""Configuration settings for vie-admin service."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Admin service settings loaded from environment variables."""

    model_config = SettingsConfigDict(env_file=".env")

    MONGODB_URI: str = "mongodb://vie-mongodb:27017/video-insight-engine"
    ADMIN_API_KEY: str

    # Service URLs for health polling
    VIE_API_URL: str = "http://vie-api:3000"
    VIE_SUMMARIZER_URL: str = "http://vie-summarizer:8000"
    VIE_ASSISTANT_URL: str = "http://vie-assistant:8001"

    # Alert thresholds
    ALERT_COST_THRESHOLD_USD: float = 0.50

    # Webhook receiving llm_alerts JSON POSTs (empty → delivery disabled).
    # Same env var the summarizer/assistant/worker read via llm-common.
    ALERT_WEBHOOK_URL: str = ""

    # Backup dead-man's switch (alert_evaluator.py) — directory holding
    # scripts/backup.sh output (compose mounts the host backups/ dir here,
    # read-only). Missing/unmounted dir → the staleness check is skipped.
    BACKUP_DIR: str = "./backups"
    # 26h = daily cron (03:30) + generous slack for a slow run before alerting.
    BACKUP_MAX_AGE_HOURS: float = 26.0

    # Langfuse — used only to build "Open in Langfuse" deep-links for pipeline
    # runs. The project id is resolved from the keys at runtime when left blank.
    LANGFUSE_BASE_URL: str = "https://cloud.langfuse.com"
    LANGFUSE_PUBLIC_KEY: str = ""
    LANGFUSE_SECRET_KEY: str = ""
    LANGFUSE_PROJECT_ID: str = ""

    # Sentry — empty DSN → init no-ops (dev/CI run without a Sentry project).
    SENTRY_DSN: str = ""
    SENTRY_ENVIRONMENT: str | None = None
    SENTRY_RELEASE: str | None = None  # Usually the deploy SHA.
    SENTRY_TRACES_SAMPLE_RATE: float = 0.0

    # Logging
    LOG_LEVEL: str = "INFO"


settings = Settings()
