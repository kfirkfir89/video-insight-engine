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
    VIE_EXPLAINER_URL: str = "http://vie-explainer:8001"

    # Alert thresholds
    ALERT_COST_THRESHOLD_USD: float = 0.50

    # Logging
    LOG_LEVEL: str = "INFO"


settings = Settings()
