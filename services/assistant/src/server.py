"""FastAPI application for the vie-assistant service."""

from __future__ import annotations

import hmac
import time
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from uuid import uuid4

from cachetools import TTLCache

from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, StreamingResponse
from motor.motor_asyncio import AsyncIOMotorClient

from llm_common.context import (
    llm_feature_var,
    llm_request_id_var,
    llm_user_id_var,
    llm_video_id_var,
)
from llm_common.middleware import add_request_context_middleware
from llm_common.sentry_init import init_sentry_from_settings

from src.config import settings, validate_internal_secret
from src.exceptions import AppError, NotFoundError, ValidationError
from src.logging_config import configure_structlog, get_logger
from src.models.requests import (
    ActionRequest,
    ChatRequest,
    LibraryChatRequest,
    LibrarySearchRequest,
)
from src.models.responses import ActionResponse
from src.repositories.notes_repository import NotesRepository
from src.repositories.qdrant_repository import QdrantRepository
from src.repositories.video_repository import MongoVideoRepository
from src.services.api_client import ApiClient
from src.services.assistant import AssistantService
from src.services.context_builder import ContextBuilder
from src.services.llm_provider import LLMProvider
from src.services.observability import flush_langfuse, init_langfuse, session_trace, span
from src.services.rag import RAGService
from src.tools.concept_explain import ConceptExplainTool
from src.tools.cross_reference import CrossReferenceTool
from src.tools.folder_organizer import FolderOrganizerTool
from src.tools.library_organizer import LibraryOrganizerTool
from src.tools.navigator import NavigatorTool
from src.tools.note_taker import NoteTakerTool
from src.tools.quiz_generator import QuizGeneratorTool
from src.tools.video_generator import VideoGeneratorTool
from src.tools.video_qa import VideoQATool

# Configure structured logging before anything else
configure_structlog(json_format=settings.LOG_FORMAT == "json")
logger = get_logger(__name__)

# --- In-memory rate limiting (bounded) ---
_RATE_LIMIT_MAX: int = 30  # /chat requests per window
_RATE_LIMIT_WINDOW: int = 60  # seconds
_LIBRARY_RATE_LIMIT_MAX: int = 60  # /library/search — cheap, no LLM
_ACTION_RATE_LIMIT_MAX: int = 30  # /action — 30 calls per 60s sliding window (≈1 every 2s on average)
_rate_tracker: TTLCache[str, list[float]] = TTLCache(maxsize=10000, ttl=_RATE_LIMIT_WINDOW * 2)
_library_rate_tracker: TTLCache[str, list[float]] = TTLCache(
    maxsize=10000, ttl=_RATE_LIMIT_WINDOW * 2,
)
_action_rate_tracker: TTLCache[str, list[float]] = TTLCache(
    maxsize=10000, ttl=_RATE_LIMIT_WINDOW * 2,
)


def _check_rate_limit(key: str) -> bool:
    """Return True if the chat rate limit is exceeded for *key*."""
    return _check_bucket(_rate_tracker, key, _RATE_LIMIT_MAX)


def _check_library_rate_limit(key: str) -> bool:
    """Return True if the library search rate limit is exceeded for *key*."""
    return _check_bucket(_library_rate_tracker, key, _LIBRARY_RATE_LIMIT_MAX)


def _check_action_rate_limit(key: str) -> bool:
    """Return True if the action rate limit is exceeded for *key*."""
    return _check_bucket(_action_rate_tracker, key, _ACTION_RATE_LIMIT_MAX)


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


def _init_sentry_from_settings() -> bool:
    """Boot Sentry from assistant settings.

    Thin local wrapper over the shared :func:`init_sentry_from_settings` —
    kept so tests can patch this single entry point. Empty DSN no-ops.
    """
    return init_sentry_from_settings(settings, service="vie-assistant")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan: initialise dependencies and register callbacks."""
    validate_internal_secret()

    # Sentry first — every other lifespan step's boot errors flow through it.
    try:
        sentry_enabled = _init_sentry_from_settings()
        logger.info("sentry_init", enabled=sentry_enabled)
    except Exception as exc:  # noqa: BLE001
        logger.warning("sentry_init_failed", error=str(exc))

    # Langfuse observability — no-op when LANGFUSE_PUBLIC_KEY/SECRET_KEY are unset.
    init_langfuse()

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

        # Async mode: this service uses Motor (async). Sync mode would hand the
        # SyncBuffer's background thread a Motor collection, whose insert_many
        # needs the event loop -> "no current event loop in thread" on flush.
        usage_callback = MongoDBUsageCallback(db, service="assistant", mode="async")
        await usage_callback.start_async()
        litellm.callbacks = [usage_callback]
        logger.info("llm_usage_callback_registered", mode="async")
    except ImportError:
        logger.warning("llm_common_not_installed_usage_tracking_disabled")
    except Exception as exc:
        logger.warning("llm_usage_callback_failed", error=str(exc))

    # Outbound vie-api client for folder/library actions (reuses INTERNAL_SECRET).
    api_client = ApiClient(settings.VIE_API_URL, settings.INTERNAL_SECRET)
    app.state.api_client = api_client

    # Assemble services
    llm = LLMProvider()  # primary (Sonnet) — tools keep their audited tier
    # The chat + agentic loop use their own provider so they can run on a
    # cheaper/faster model (LLM_CHAT_MODEL, default Haiku) without downgrading
    # the Sonnet-pinned tools that share `llm` below.
    chat_llm = LLMProvider(
        model=settings.llm_chat_model,
        fallback_models=settings.llm_fallback_models,
    )
    context_builder = ContextBuilder()
    notes_repo = NotesRepository(db)
    assistant_service = AssistantService(
        llm=chat_llm,
        rag=rag_service,
        video_repo=video_repo,
        context_builder=context_builder,
        settings=settings,
        api_client=api_client,
    )

    # Register tools — uses primary (Sonnet) by default; quiz uses fast tier internally.
    assistant_service.register_tool(VideoQATool(rag=rag_service, llm=llm))
    assistant_service.register_tool(NavigatorTool(video_repo=video_repo))
    assistant_service.register_tool(QuizGeneratorTool(llm=llm))
    assistant_service.register_tool(NoteTakerTool(notes_repo=notes_repo))
    assistant_service.register_tool(ConceptExplainTool(rag=rag_service, llm=llm))
    assistant_service.register_tool(CrossReferenceTool(rag=rag_service, llm=llm))
    # vie-api-backed action tools (folders, library organize, generate).
    assistant_service.register_tool(FolderOrganizerTool(api_client))
    assistant_service.register_tool(LibraryOrganizerTool(api_client, llm))
    assistant_service.register_tool(VideoGeneratorTool(api_client))

    app.state.assistant_service = assistant_service
    # Expose rag_service directly for /library/search (no LLM needed).
    app.state.rag_service = rag_service

    logger.info(
        "assistant_service_ready",
        chat_model=chat_llm.model,
        tool_model=llm.model,
        port=settings.ASSISTANT_PORT,
    )

    yield

    # Cleanup
    await flush_langfuse()
    await api_client.aclose()
    mongo_client.close()
    if usage_callback:
        try:
            await usage_callback.shutdown_async()
        except Exception as exc:
            logger.warning("callback_shutdown_failed", error=str(exc))


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    application = FastAPI(title="vie-assistant", lifespan=lifespan)
    add_request_context_middleware(application)

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

        # vie-api forwards X-User-Id; X-Session-Id is optional and groups
        # consecutive chat turns under one Langfuse session.
        user_id = req.headers.get("X-User-Id")
        session_id = req.headers.get("X-Session-Id")
        request_id = req.headers.get("X-Request-ID")

        # Propagate tracking context onto every llm_usage row for this request.
        llm_feature_var.set("assistant:rag_chat")
        llm_video_id_var.set(request.video_id)
        llm_user_id_var.set(user_id)
        llm_request_id_var.set(request_id)

        return StreamingResponse(
            service.chat(
                video_id=request.video_id,
                message=request.message,
                history=request.conversation_history,
                user_id=user_id,
                session_id=session_id,
            ),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no",
            },
        )

    @application.post("/library/chat", response_model=None)
    async def library_chat(
        request: LibraryChatRequest,
        req: Request,
        x_internal_secret: str = Header(..., alias="X-Internal-Secret"),
    ) -> StreamingResponse | JSONResponse:
        """Stream a library-wide chat response across the user's videos via SSE.

        Trusts the caller (vie-api) to derive ``video_ids`` server-side from the
        user's owned videos. Same SSE event shapes as ``/chat``.
        """
        if not hmac.compare_digest(x_internal_secret, settings.INTERNAL_SECRET):
            raise HTTPException(status_code=403, detail="Forbidden")

        # Bucket per upstream user so the per-LLM-call limit can't be bypassed
        # by varying the video_ids set; shared "anonymous" bucket as fallback.
        user_id = req.headers.get("X-User-Id")
        rate_key = user_id or "anonymous"
        if _check_rate_limit(rate_key):
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

        session_id = req.headers.get("X-Session-Id")
        request_id = req.headers.get("X-Request-ID")

        # Propagate tracking context onto every llm_usage row for this request.
        llm_feature_var.set("assistant:library_chat")
        llm_user_id_var.set(user_id)
        llm_request_id_var.set(request_id)

        return StreamingResponse(
            service.library_chat(
                video_ids=list(request.video_ids),
                message=request.message,
                history=request.conversation_history,
                user_id=user_id,
                session_id=session_id,
                inventory=[lv.model_dump() for lv in request.library],
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

    @application.post("/action")
    async def action(
        request: ActionRequest,
        req: Request,
        x_internal_secret: str = Header(..., alias="X-Internal-Secret"),
    ) -> JSONResponse:
        """Perform a structured action on a video.

        Dispatches to a registered tool based on ``action`` (save_note,
        quiz_me, find_moment, explain). The caller (vie-api) is expected to
        have verified ownership before forwarding.
        """
        if not hmac.compare_digest(x_internal_secret, settings.INTERNAL_SECRET):
            raise HTTPException(status_code=403, detail="Forbidden")

        user_id = req.headers.get("X-User-Id")
        request_id = req.headers.get("X-Request-ID")
        rate_key = user_id or request.video_id or "anonymous"
        if _check_action_rate_limit(rate_key):
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

        # Propagate tracking context onto every llm_usage row for this request.
        llm_feature_var.set(f"assistant:action:{request.action}")
        llm_video_id_var.set(request.video_id)
        llm_user_id_var.set(user_id)
        llm_request_id_var.set(request_id)

        trace_id = uuid4().hex[:12]
        async with session_trace(
            video_id=request.video_id or "",
            user_id=user_id,
            tags=["action", f"action:{request.action}"],
            metadata={"action": request.action, "traceId": trace_id},
        ):
            async with span(f"action:{request.action}"):
                try:
                    result = await service.dispatch_action(
                        action=request.action,
                        video_id=request.video_id,
                        params=dict(request.params),
                        user_id=user_id,
                    )
                except ValidationError as exc:
                    logger.warning(
                        "action_validation_failed",
                        trace_id=trace_id,
                        action=request.action,
                        error=exc.message,
                    )
                    return JSONResponse(
                        status_code=exc.status_code,
                        content=ActionResponse(
                            success=False,
                            action=request.action,
                            data=None,
                            error=exc.message,
                            trace_id=trace_id,
                        ).model_dump(),
                    )
                except NotFoundError as exc:
                    return JSONResponse(
                        status_code=exc.status_code,
                        content=ActionResponse(
                            success=False,
                            action=request.action,
                            data=None,
                            error=exc.message,
                            trace_id=trace_id,
                        ).model_dump(),
                    )
                except AppError as exc:
                    logger.exception(
                        "action_app_error",
                        trace_id=trace_id,
                        action=request.action,
                    )
                    return JSONResponse(
                        status_code=exc.status_code,
                        content=ActionResponse(
                            success=False,
                            action=request.action,
                            data=None,
                            error=exc.message,
                            trace_id=trace_id,
                        ).model_dump(),
                    )

                return JSONResponse(
                    status_code=200,
                    content=ActionResponse(
                        success=True,
                        action=request.action,
                        data=result,
                        error=None,
                        trace_id=trace_id,
                    ).model_dump(),
                )

    return application


app = create_app()
