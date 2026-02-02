"""vie-explainer HTTP server - wraps MCP tools as REST endpoints."""

import json
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse

from src.config import settings
from src.logging_config import configure_structlog, get_logger
from src.middleware import add_request_context_middleware
from src.dependencies import (
    ChatRepoDep,
    ExpansionRepoDep,
    LLMServiceDep,
    MemorizedItemRepoDep,
    VideoSummaryRepoDep,
    close_mongo_client,
    get_database,
    init_mongo_client,
)
from src.exceptions import (
    ExplainerError,
    ResourceNotFoundError,
    UnauthorizedError,
    ValidationError,
)
from src.schemas import (
    ExplainAutoRequest,
    ExplainAutoResponse,
    ExplainChatRequest,
    ExplainChatResponse,
)
from src.tools.explain_auto import explain_auto
from src.tools.explain_chat import explain_chat
from src.tools.explain_chat_stream import explain_chat_stream

# Configure structured logging (JSON in production, console in development)
configure_structlog(json_format=settings.log_format == "json")
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler for startup/shutdown."""
    # Startup
    logger.info("Starting vie-explainer service")
    init_mongo_client()
    yield
    # Shutdown
    logger.info("Shutting down vie-explainer service")
    await close_mongo_client()


app = FastAPI(
    title="vie-explainer",
    description="Video content explanation service",
    version="1.0.0",
    lifespan=lifespan,
)

# Add middleware
add_request_context_middleware(app)


@app.get("/health")
async def health():
    """Health check endpoint with DB connectivity verification."""
    try:
        # Verify MongoDB connection
        db = get_database()
        await db.command("ping")
        db_status = "connected"
    except Exception as e:
        logger.warning("mongodb_health_check_failed", error=str(e))
        db_status = "disconnected"

    return {
        "status": "healthy" if db_status == "connected" else "degraded",
        "service": "vie-explainer",
        "model": settings.llm_model,
        "database": db_status,
    }


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "service": "vie-explainer",
        "version": "1.0.0",
        "endpoints": [
            "/health",
            "/explain/auto",
            "/explain/chat",
            "/explain/chat/stream",
        ],
    }


@app.post("/explain/auto", response_model=ExplainAutoResponse)
async def explain_auto_endpoint(
    request: ExplainAutoRequest,
    video_summary_repo: VideoSummaryRepoDep,
    expansion_repo: ExpansionRepoDep,
    llm_service: LLMServiceDep,
):
    """
    Generate detailed documentation for a video section or concept.
    Results are cached in MongoDB and reused across all users.
    """
    try:
        expansion = await explain_auto(
            video_summary_id=request.videoSummaryId,
            target_type=request.targetType,
            target_id=request.targetId,
            video_summary_repo=video_summary_repo,
            expansion_repo=expansion_repo,
            llm_service=llm_service,
        )

        return ExplainAutoResponse(expansion=expansion)

    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ResourceNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ExplainerError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.exception("Unexpected error in explain_auto")
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")


@app.post("/explain/chat", response_model=ExplainChatResponse)
async def explain_chat_endpoint(
    request: ExplainChatRequest,
    memorized_item_repo: MemorizedItemRepoDep,
    chat_repo: ChatRepoDep,
    llm_service: LLMServiceDep,
):
    """
    Interactive conversation about a memorized item.
    Personalized per user, chat history maintained in MongoDB.
    """
    try:
        result = await explain_chat(
            memorized_item_id=request.memorizedItemId,
            user_id=request.userId,
            message=request.message,
            memorized_item_repo=memorized_item_repo,
            chat_repo=chat_repo,
            llm_service=llm_service,
            chat_id=request.chatId,
        )

        return ExplainChatResponse(
            response=result["response"],
            chatId=result["chatId"],
        )

    except UnauthorizedError as e:
        raise HTTPException(status_code=401, detail=str(e))
    except ResourceNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ExplainerError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.exception("Unexpected error in explain_chat")
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")


@app.post("/explain/chat/stream")
async def explain_chat_stream_endpoint(
    request: ExplainChatRequest,
    memorized_item_repo: MemorizedItemRepoDep,
    chat_repo: ChatRepoDep,
    llm_service: LLMServiceDep,
):
    """
    Stream chat response via Server-Sent Events (SSE).
    Tokens are streamed in real-time as they are generated.
    """
    try:

        async def generate():
            async for token, chat_id in explain_chat_stream(
                memorized_item_id=request.memorizedItemId,
                user_id=request.userId,
                message=request.message,
                memorized_item_repo=memorized_item_repo,
                chat_repo=chat_repo,
                llm_service=llm_service,
                chat_id=request.chatId,
            ):
                yield f"data: {json.dumps({'token': token, 'chatId': chat_id})}\n\n"
            yield "data: [DONE]\n\n"

        return StreamingResponse(
            generate(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            },
        )

    except UnauthorizedError as e:
        raise HTTPException(status_code=401, detail=str(e))
    except ResourceNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.exception("Unexpected error in explain_chat_stream")
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")
