from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import FastAPI, Depends

from src.config import settings
from src.logging_config import configure_structlog, get_logger
from src.middleware import add_request_context_middleware
from src.models.schemas import (
    SummarizeRequest,
    SummarizeResponse,
    PlaylistExtractRequest,
    PlaylistExtractResponse,
    PlaylistVideoInfo,
)
from src.dependencies import get_video_repository, get_mongo_client
from src.repositories.mongodb_repository import MongoDBVideoRepository
from src.routes.stream import router as stream_router

# Configure structured logging (JSON in production, console in development)
configure_structlog(json_format=settings.log_format == "json")
logger = get_logger(__name__)

_usage_callback = None


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan: register LLM usage tracking callback."""
    global _usage_callback
    try:
        import litellm
        from llm_common import MongoDBUsageCallback

        client = get_mongo_client()
        db = client.get_default_database()
        _usage_callback = MongoDBUsageCallback(db, service="summarizer", mode="sync")
        litellm.callbacks = [_usage_callback]
        logger.info("llm_usage_callback_registered", mode="sync")
    except ImportError:
        logger.warning("llm_common not installed, usage tracking disabled")
    except Exception as e:
        logger.warning("llm_usage_callback_failed", error=str(e))

    yield

    if _usage_callback:
        try:
            _usage_callback.shutdown_sync()
        except Exception as e:
            logger.warning("callback_shutdown_failed", error=str(e))


app = FastAPI(title="vie-summarizer", lifespan=lifespan)

# Add middleware
add_request_context_middleware(app)

# Register routers
app.include_router(stream_router)


@app.get("/health")
async def health():
    """Health check endpoint with DB and S3 connectivity verification."""
    # Check MongoDB
    try:
        client = get_mongo_client()
        client.admin.command("ping")
        db_status = "connected"
    except Exception as e:
        logger.warning("mongodb_health_check_failed", error=str(e))
        db_status = "disconnected"

    # Check S3 (optional - don't fail health if S3 unavailable)
    s3_status = "not_configured"
    if settings.AWS_ENDPOINT_URL or settings.AWS_ACCESS_KEY_ID:
        try:
            from src.services.s3_client import s3_client
            s3_health = await s3_client.health_check()
            s3_status = s3_health.get("status", "unknown")
        except Exception as e:
            logger.warning("s3_health_check_failed", error=str(e))
            s3_status = "error"

    # Overall status: healthy if DB is connected (S3 is optional)
    overall_status = "healthy" if db_status == "connected" else "degraded"

    return {
        "status": overall_status,
        "service": "vie-summarizer",
        "model": settings.llm_model,
        "database": db_status,
        "s3": s3_status,
    }


@app.get("/")
async def root():
    return {"service": "vie-summarizer", "version": "0.1.0"}


@app.post("/summarize", response_model=SummarizeResponse, status_code=202)
async def summarize(
    request: SummarizeRequest,
    repository: Annotated[MongoDBVideoRepository, Depends(get_video_repository)],
):
    """
    Accept video summarization request.

    This endpoint registers the request and stores provider config.
    Actual processing happens via the streaming endpoint (GET /summarize/stream/{id})
    which the frontend connects to for real-time progress updates.

    NOTE: No background processing is started here - the streaming route handles
    all the actual summarization work. This prevents duplicate processing.
    """
    logger.info(f"Received summarize request: providers={request.providers}")

    # Store provider config in database for streaming route to use
    if request.providers:
        repository.set_provider_config(
            request.videoSummaryId,
            {
                "default": request.providers.default,
                "fast": request.providers.fast,
                "fallback": request.providers.fallback,
            }
        )

    return SummarizeResponse(
        status="accepted",
        videoSummaryId=request.videoSummaryId,
    )


@app.post("/playlist/extract", response_model=PlaylistExtractResponse)
async def extract_playlist(request: PlaylistExtractRequest):
    """
    Extract playlist metadata using yt-dlp.

    Uses extract_flat mode for fast metadata-only extraction.
    Returns playlist info and list of videos with positions.
    """
    from src.services.playlist import extract_playlist_data

    logger.info(f"Extracting playlist: {request.playlist_id} (max={request.max_videos})")

    try:
        playlist = await extract_playlist_data(
            request.playlist_id,
            max_videos=request.max_videos
        )

        return PlaylistExtractResponse(
            playlist_id=playlist.playlist_id,
            title=playlist.title,
            channel=playlist.channel,
            thumbnail_url=playlist.thumbnail_url,
            total_videos=playlist.total_videos,
            videos=[
                PlaylistVideoInfo(
                    video_id=v.video_id,
                    title=v.title,
                    position=v.position,
                    duration=v.duration,
                    thumbnail_url=v.thumbnail_url,
                )
                for v in playlist.videos
            ],
        )
    except ValueError as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=str(e))
