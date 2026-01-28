import logging
from typing import Annotated

from fastapi import FastAPI, Depends

from src.config import settings
from src.models.schemas import (
    SummarizeRequest,
    SummarizeResponse,
    PlaylistExtractRequest,
    PlaylistExtractResponse,
    PlaylistVideoInfo,
)
from src.dependencies import get_video_repository
from src.repositories.mongodb_repository import MongoDBVideoRepository
from src.routes.stream import router as stream_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(title="vie-summarizer")

# Register routers
app.include_router(stream_router)


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "service": "vie-summarizer",
        "model": settings.llm_model,
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
