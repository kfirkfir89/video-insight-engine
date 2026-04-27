"""FastAPI application for the vie-assistant service."""

from __future__ import annotations

import hmac
import time
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from cachetools import TTLCache

from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, StreamingResponse
from motor.motor_asyncio import AsyncIOMotorClient

from src.config import settings, validate_internal_secret
from src.exceptions import AppError
from src.logging_config import configure_structlog, get_logger
from src.models.requests import ActionRequest, ChatRequest, LibrarySearchRequest
from src.repositories.qdrant_repository import QdrantRepository
from src.repositories.video_repository import MongoVideoRepository
from src.services.assistant import AssistantService
from src.services.context_builder import ContextBuilder
from src.services.llm_provider import LLMProvider
from src.services.rag import RAGService

# Configure structured logging before anything else
configure_structlog(json_format=settings.LOG_FORMAT == "json")
logger = get_logger(__name__)

# --- In-memory rate limiting (bounded) ---
_RATE_LIMIT_MAX: int = 30  # /chat requests per window
_RATE_LIMIT_WINDOW: int = 60  # seconds
_LIBRARY_RATE_LIMIT_MAX: int = 60  # /library/search — cheap, no LLM
_rate_tracker: TTLCache[str, list[float]] = TTLCache(maxsize=10000, ttl=_RATE_LIMIT_WINDOW * 2)
_library_rate_tracker: TTLCache[str, list[float]] = TTLCache(
    maxsize=10000, ttl=_RATE_LIMIT_WINDOW * 2,
)


def _check_rate_limit(key: str) -> bool:
    """Return True if the chat rate limit is exceeded for *key*."""
    return _check_bucket(_rate_tracker, key, _RATE_LIMIT_MAX)


def _check_library_rate_limit(key: str) -> bool:
    """Return True if the library search rate limit is exceeded for *key*."""
    return _check_bucket(_library_rate_tracker, key, _LIBRARY_RATE_LIMIT_MAX)


def _check_bucket(tracker: TTLCache, key: str, limit: int) -> bool:
    """Sliding-window rate limit on a TTLCache bucket."""
    now = time.time()
    window_start = now - _RATE_LIMIT_WINDOW
    timestamps = [t for t in tracker.get(key, []) if t > window_start]
    if len(timestamps) >= limit:
        tracker[key] = timestamps
        return True
    timestamps.append(now)
    tracker[key] = timestamps
    return False


async def _verify_internal_secret(
    x_internal_secret: str = Header(..., alias="X-Internal-Secret"),
) -> None:
    """Validate the internal service-to-service secret."""
    if not hmac.compare_digest(x_internal_secret, settings.INTERNAL_SECRET):
        raise HTTPException(status_code=403, detail="Forbidden")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan: initialise dependencies and register callbacks."""
    validate_internal_secret()

    # MongoDB
    mongo_client = AsyncIOMotorClient(settings.MONGODB_URI)
    db = mongo_client.get_default_database()
    video_repo = MongoVideoRepository(db)
    logger.info("mongodb_connected")

    # Qdrant
    qdrant_repo = QdrantRepository(
        url=settings.QDRANT_URL,
        collection=settings.QDRANT_COLLECTION,
    )

    # RAG (preload embedding model)
    rag_service = RAGService(qdrant_repo=qdrant_repo)
    try:
        await rag_service.preload_model()
        logger.info("sentence_transformer_model_preloaded")
    except Exception as exc:
        logger.warning("sentence_transformer_preload_failed", error=str(exc))

    # LLM usage callback
    usage_callback = None
    try:
        import litellm
        from llm_common import MongoDBUsageCallback

        usage_callback = MongoDBUsageCallback(db, service="assistant", mode="sync")
        litellm.callbacks = [usage_callback]
        logger.info("llm_usage_callback_registered", mode="sync")
    except ImportError:
        logger.warning("llm_common_not_installed_usage_tracking_disabled")
    except Exception as exc:
        logger.warning("llm_usage_callback_failed", error=str(exc))

    # Assemble services
    llm = LLMProvider()
    context_builder = ContextBuilder()
    app.state.assistant_service = AssistantService(
        llm=llm,
        rag=rag_service,
        video_repo=video_repo,
        context_builder=context_builder,
        settings=settings,
    )
    # Expose rag_service directly for /library/search (no LLM needed).
    app.state.rag_service = rag_service

    logger.info("assistant_service_ready", model=llm.model, port=settings.ASSISTANT_PORT)

    yield

    # Cleanup
    mongo_client.close()
    if usage_callback:
        try:
            usage_callback.shutdown_sync()
        except Exception as exc:
            logger.warning("callback_shutdown_failed", error=str(exc))


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    application = FastAPI(title="vie-assistant", lifespan=lifespan)

    # --- Exception handlers ---

    @application.exception_handler(AppError)
    async def app_error_handler(_request: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": exc.message, "code": exc.code},
        )

    @application.exception_handler(RequestValidationError)
    async def validation_error_handler(
        _request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content={"error": "Validation error", "details": exc.errors()},
        )

    @application.exception_handler(Exception)
    async def generic_error_handler(_request: Request, exc: Exception) -> JSONResponse:
        logger.exception("unhandled_error", error=str(exc))
        return JSONResponse(
            status_code=500,
            content={"error": "Internal server error", "code": "INTERNAL_ERROR"},
        )

    # --- Routes ---

    @application.get("/health")
    async def health() -> dict:
        """Health check endpoint."""
        return {
            "status": "healthy",
            "service": "vie-assistant",
            "model": settings.llm_model,
        }

    @application.post("/chat", response_model=None)
    async def chat(
        request: ChatRequest,
        req: Request,
        x_internal_secret: str = Header(..., alias="X-Internal-Secret"),
    ) -> StreamingResponse | JSONResponse:
        """Stream a chat response about a video via SSE."""
        if not hmac.compare_digest(x_internal_secret, settings.INTERNAL_SECRET):
            raise HTTPException(status_code=403, detail="Forbidden")

        if _check_rate_limit(request.video_id):
            return JSONResponse(
                status_code=429,
                content={
                    "error": "Rate limit exceeded — try again shortly",
                    "code": "RATE_LIMIT_EXCEEDED",
                },
            )

        service: AssistantService | None = getattr(req.app.state, "assistant_service", None)
        if service is None:
            raise HTTPException(status_code=503, detail="Service not ready")

        return StreamingResponse(
            service.chat(
                video_id=request.video_id,
                message=request.message,
                history=request.conversation_history,
            ),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no",
            },
        )

    @application.post("/library/search")
    async def library_search(
        request: LibrarySearchRequest,
        req: Request,
        x_internal_secret: str = Header(..., alias="X-Internal-Secret"),
    ) -> JSONResponse:
        """Semantic search across a library of videos.

        Trusts the caller (Node api gateway) to enforce ``video_ids``
        ownership before forwarding. Pure retrieval — no LLM.
        """
        if not hmac.compare_digest(x_internal_secret, settings.INTERNAL_SECRET):
            raise HTTPException(status_code=403, detail="Forbidden")

        # Bucket per upstream caller (vie-api forwards X-User-Id) so the
        # 60/min guarantee can't be bypassed by varying the video_ids set.
        # Falls back to a shared "anonymous" bucket when the header isn't
        # forwarded — strictly tighter than the previous payload-derived key.
        rate_key = req.headers.get("X-User-Id") or "anonymous"
        if _check_library_rate_limit(rate_key):
            return JSONResponse(
                status_code=429,
                content={
                    "error": "Rate limit exceeded — try again shortly",
                    "code": "RATE_LIMIT_EXCEEDED",
                },
            )

        rag: RAGService | None = getattr(req.app.state, "rag_service", None)
        if rag is None:
            raise HTTPException(status_code=503, detail="Service not ready")

        results = await rag.search_library(
            query=request.query,
            video_ids=list(request.video_ids),
            top_k=request.top_k,
            sources=list(request.sources) if request.sources else None,
        )
        return JSONResponse(
            status_code=200,
            content={"results": [r.model_dump() for r in results]},
        )

    @application.post("/action", status_code=501)
    async def action(
        _request: ActionRequest,
        x_internal_secret: str = Header(..., alias="X-Internal-Secret"),
    ) -> JSONResponse:
        """Perform a structured action on a video (Phase 2)."""
        if not hmac.compare_digest(x_internal_secret, settings.INTERNAL_SECRET):
            raise HTTPException(status_code=403, detail="Forbidden")

        return JSONResponse(
            status_code=501,
            content={"error": "Actions are not yet implemented", "code": "NOT_IMPLEMENTED"},
        )

    return application


app = create_app()
