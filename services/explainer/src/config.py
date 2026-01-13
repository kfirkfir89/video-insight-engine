"""Configuration settings for vie-explainer service."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # MongoDB
    MONGODB_URI: str = "mongodb://vie-mongodb:27017/video-insight-engine"

    # Anthropic
    ANTHROPIC_API_KEY: str
    ANTHROPIC_MODEL: str = "claude-sonnet-4-20250514"
    LLM_TIMEOUT_SECONDS: float = 60.0

    # Streaming configuration
    # Max concurrent streaming requests (bounded thread pool)
    LLM_STREAM_MAX_WORKERS: int = 10
    # Timeout in seconds waiting for next token during streaming
    LLM_STREAM_TOKEN_TIMEOUT_SECONDS: float = 60.0

    # Logging
    LOG_LEVEL: str = "debug"

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
