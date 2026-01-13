from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # MongoDB
    MONGODB_URI: str = "mongodb://vie-mongodb:27017/video-insight-engine"

    # Anthropic
    ANTHROPIC_API_KEY: str
    ANTHROPIC_MODEL: str = "claude-sonnet-4-20250514"
    ANTHROPIC_HAIKU_MODEL: str = "claude-3-5-haiku-20241022"

    # API callback
    API_URL: str = "http://vie-api:3000"
    INTERNAL_SECRET: str = "dev-internal-secret-change-me"

    # Limits
    MAX_VIDEO_DURATION_MINUTES: int = 180
    MIN_VIDEO_DURATION_SECONDS: int = 60
    LLM_TIMEOUT_SECONDS: float = 60.0

    # Token limits for LLM prompts
    MAX_TRANSCRIPT_CHARS: int = 15000
    MAX_SECTION_CHARS: int = 8000

    # Issue #18: Configurable batch size for parallel section processing
    SECTION_BATCH_SIZE: int = 3

    # SponsorBlock API timeout
    SPONSORBLOCK_TIMEOUT: float = 5.0

    # Webshare proxy (optional - for bypassing YouTube IP blocks)
    WEBSHARE_PROXY_USERNAME: str | None = None
    WEBSHARE_PROXY_PASSWORD: str | None = None

    class Config:
        env_file = ".env"


settings = Settings()
