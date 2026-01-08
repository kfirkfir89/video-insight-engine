from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # MongoDB
    MONGODB_URI: str = "mongodb://vie-mongodb:27017/video-insight-engine"

    # Anthropic
    ANTHROPIC_API_KEY: str
    ANTHROPIC_MODEL: str = "claude-sonnet-4-20250514"

    # Limits
    MAX_VIDEO_DURATION_MINUTES: int = 180
    MIN_VIDEO_DURATION_SECONDS: int = 60

    class Config:
        env_file = ".env"


settings = Settings()
