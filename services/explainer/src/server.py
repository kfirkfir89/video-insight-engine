"""vie-explainer MCP server entry point.

Production MCP server using Starlette + FastMCP with Streamable HTTP transport.
Exposes tools: explain_auto, video_chat
Endpoints: /mcp (MCP tools), /health (Docker health check)
"""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from mcp.server.fastmcp import FastMCP
from mcp.server.transport_security import TransportSecuritySettings
from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Route

from src.config import settings
from src.dependencies import close_mongo_client, get_database, get_services, init_mongo_client
from src.exceptions import LLMError
from src.logging_config import configure_structlog, get_logger

# Configure structured logging
configure_structlog(json_format=settings.log_format == "json")
logger = get_logger(__name__)

# Create MCP server with Docker-compatible host validation
mcp = FastMCP(
    "vie-explainer",
    transport_security=TransportSecuritySettings(
        enable_dns_rebinding_protection=True,
        allowed_hosts=[
            "127.0.0.1:*",
            "localhost:*",
            "[::1]:*",
            "vie-explainer:*",
        ],
    ),
)


@mcp.tool()
async def explain_auto(
    video_summary_id: str,
    target_type: str,
    target_id: str,
) -> str:
    """Generate detailed documentation for a video section or concept.

    Results are cached in systemExpansionCache and reused across all users.

    Args:
        video_summary_id: MongoDB ObjectId of the video summary
        target_type: "section" or "concept"
        target_id: UUID of the section or concept

    Returns:
        Markdown documentation string
    """
    from src.tools.explain_auto import explain_auto as _explain_auto

    services = get_services()
    try:
        return await _explain_auto(
            video_summary_id=video_summary_id,
            target_type=target_type,
            target_id=target_id,
            video_summary_repo=services["video_summary_repo"],
            expansion_repo=services["expansion_repo"],
            llm_service=services["llm_service"],
        )
    except LLMError as e:
        logger.warning("explain_auto LLM error", error=str(e))
        return f"Sorry, I couldn't generate the explanation. {e.message}"


@mcp.tool()
async def video_chat(
    video_summary_id: str,
    user_message: str,
    chat_history: list[dict] | None = None,
) -> str:
    """Chat about a specific video. Answer questions grounded in video content.

    Args:
        video_summary_id: MongoDB ObjectId of the video summary
        user_message: The user's question about the video
        chat_history: Optional array of previous messages [{role, content}]

    Returns:
        Assistant response grounded in video content
    """
    from src.tools.video_chat import video_chat as _video_chat

    services = get_services()

    try:
        return await _video_chat(
            video_summary_id=video_summary_id,
            user_message=user_message,
            chat_history=chat_history or [],
            video_summary_repo=services["video_summary_repo"],
            llm_service=services["llm_service"],
        )
    except LLMError as e:
        logger.warning("video_chat LLM error", error=str(e))
        return f"Sorry, I couldn't respond right now. {e.message}"


# ── Starlette routes ──


async def health_endpoint(request: Request) -> JSONResponse:
    """Docker health check endpoint."""
    try:
        db = get_database()
        await db.command("ping")
        db_status = "connected"
    except Exception as e:
        logger.warning("Health check DB ping failed", error=str(e))
        db_status = "disconnected"

    status = "healthy" if db_status == "connected" else "degraded"
    return JSONResponse({
        "status": status,
        "service": "vie-explainer",
        "version": "2.0.0",
        "transport": "streamable-http",
        "model": settings.llm_model,
        "database": db_status,
    })


# ── Build app ──

# Create MCP Starlette app first (initializes session_manager)
mcp_app = mcp.streamable_http_app()


_usage_callback = None


@asynccontextmanager
async def lifespan(app: Starlette) -> AsyncGenerator[None, None]:
    """Combined lifespan: MongoDB + MCP session manager + LLM tracking."""
    global _usage_callback
    logger.info("Starting vie-explainer MCP server")
    if settings.INTERNAL_SECRET == "dev-internal-secret-change-me":
        if settings.log_format == "json":
            # Production uses JSON logging — refuse to start with default secret
            logger.critical("INTERNAL_SECRET is using the default value — refusing to start in production")
            raise SystemExit(1)
        logger.warning("INTERNAL_SECRET is using the default value — acceptable for local dev only")
    init_mongo_client()

    # Register LLM usage tracking callback (async mode for motor)
    try:
        import litellm
        from llm_common import MongoDBUsageCallback

        db = get_database()
        _usage_callback = MongoDBUsageCallback(db, service="explainer", mode="async")
        await _usage_callback.start_async()
        litellm.callbacks = [_usage_callback]
        logger.info("llm_usage_callback_registered", mode="async")
    except ImportError:
        logger.warning("llm_common not installed, usage tracking disabled")
    except Exception as e:
        logger.warning("llm_usage_callback_failed", error=str(e))

    # Initialize MCP session manager task group (required for tool calls).
    # NOTE: _session_manager is a private API — no public alternative in FastMCP yet.
    # Track as tech debt: replace when FastMCP exposes a public lifespan hook.
    async with mcp._session_manager.run():
        yield

    # Shutdown callback buffer
    if _usage_callback:
        try:
            await _usage_callback.shutdown_async()
        except Exception as e:
            logger.warning("callback_shutdown_failed", error=str(e))

    logger.info("Shutting down vie-explainer MCP server")
    await close_mongo_client()


# Build main Starlette app with combined lifespan
app = Starlette(
    routes=[
        Route("/health", health_endpoint, methods=["GET"]),
    ],
    lifespan=lifespan,
)

# Mount MCP app at root — streamable_http_app() creates internal route at /mcp,
# so the final endpoint is /mcp (matching what vie-api client connects to).
app.mount("/", mcp_app)


def main():
    """Entry point for uvicorn."""
    import uvicorn

    uvicorn.run("src.server:app", host="0.0.0.0", port=8001)


if __name__ == "__main__":
    main()
