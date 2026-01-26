import logging
from typing import Annotated

from fastapi import FastAPI, BackgroundTasks, Depends

from src.config import settings
from src.models.schemas import SummarizeRequest, SummarizeResponse
from src.dependencies import (
    get_video_repository,
    get_llm_provider,
    create_llm_provider,
)
from src.repositories.mongodb_repository import MongoDBVideoRepository
from src.services.llm import LLMService
from src.services.llm_provider import LLMProvider
from src.services.summarizer_service import SummarizeService
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
    background_tasks: BackgroundTasks,
    repository: Annotated[MongoDBVideoRepository, Depends(get_video_repository)],
    default_provider: Annotated[LLMProvider, Depends(get_llm_provider)],
):
    """
    Trigger video summarization.
    Returns immediately, processing happens in background.
    """
    # Debug: Log incoming providers
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

    # Use custom provider if specified (dev tools), otherwise use default
    provider = (
        create_llm_provider(request.providers)
        if request.providers
        else default_provider
    )

    # Create LLM service with the selected provider
    llm_service = LLMService(provider)

    # Create service with injected dependencies
    service = SummarizeService(repository, llm_service)

    # Add background task
    background_tasks.add_task(
        service.process_video,
        request.videoSummaryId,
        request.youtubeId,
        request.url,
        request.userId,
    )

    return SummarizeResponse(
        status="accepted",
        videoSummaryId=request.videoSummaryId,
    )
