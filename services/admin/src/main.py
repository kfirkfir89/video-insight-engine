"""vie-admin FastAPI app — LLM usage monitoring and system health."""

import asyncio
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from pathlib import Path

import structlog
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from src.auth import ApiKeyMiddleware
from src.dependencies import close_mongo_client, get_database, init_mongo_client
from src.routes.alerts import router as alerts_router
from src.routes.health import router as health_router
from src.routes.shares import router as shares_router
from src.routes.tiers import router as tiers_router
from src.routes.usage import router as usage_router
from src.services.aggregator import aggregate_daily
from src.services.health_checker import health_poller_loop

logger = structlog.get_logger(__name__)

_health_task: asyncio.Task | None = None


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    global _health_task
    init_mongo_client()

    # Create TTL and query indexes in parallel
    db = get_database()
    try:
        await asyncio.gather(
            db.llm_usage.create_index("timestamp", expireAfterSeconds=7_776_000),  # 90 days
            db.health_history.create_index("timestamp", expireAfterSeconds=2_592_000),  # 30 days
            db.llm_usage.create_index([("cost_usd", -1)]),
            db.llm_usage.create_index([("model", 1), ("timestamp", -1)]),
            db.llm_usage.create_index([("video_id", 1)]),
            db.llm_usage.create_index([("service", 1)]),
            db.llm_usage.create_index([("prompt_hash", 1)]),
        )
    except Exception as e:
        logger.warning("index_creation_failed", error=str(e))

    # Start health poller
    _health_task = asyncio.create_task(health_poller_loop())

    yield

    if _health_task:
        _health_task.cancel()
        try:
            await _health_task
        except asyncio.CancelledError:
            pass
    await close_mongo_client()


app = FastAPI(
    title="vie-admin",
    lifespan=lifespan,
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)

# CORS — restrict to known origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:8002",
    ],
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)

# Auth middleware
app.add_middleware(ApiKeyMiddleware)

# Register routers
app.include_router(usage_router)
app.include_router(health_router)
app.include_router(alerts_router)
app.include_router(shares_router)
app.include_router(tiers_router)


@app.get("/health")
async def root_health():
    return {"status": "healthy", "service": "vie-admin"}


@app.post("/admin/aggregate-daily")
async def trigger_aggregation(target_date: str | None = Query(None)):
    try:
        return await aggregate_daily(target_date)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


# Mount static files for React UI (if built)
static_dir = Path(__file__).parent.parent / "static"
if static_dir.exists():
    app.mount("/", StaticFiles(directory=str(static_dir), html=True), name="static")
