"""Configuration settings for vie-explainer service."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # MongoDB
    MONGODB_URI: str = "mongodb://vie-mongodb:27017/video-insight-engine"

    # Anthropic
    ANTHROPIC_API_KEY: str
    ANTHROPIC_MODEL: str = "claude-sonnet-4-20250514"

    # Logging
    LOG_LEVEL: str = "debug"

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
