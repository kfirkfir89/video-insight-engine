"""Background health poller for all VIE services."""

import asyncio
from datetime import UTC, datetime

import httpx
import structlog

from src.config import settings
from src.dependencies import get_database

logger = structlog.get_logger(__name__)

POLL_INTERVAL = 30  # seconds
TIMEOUT = 5  # seconds per service

_current_health: dict[str, dict] = {}

SERVICES = {
    "vie-api": settings.VIE_API_URL,
    "vie-summarizer": settings.VIE_SUMMARIZER_URL,
    "vie-explainer": settings.VIE_EXPLAINER_URL,
}


def get_current_health() -> dict[str, dict]:
    return dict(_current_health)


async def _check_service(client: httpx.AsyncClient, name: str, url: str) -> dict:
    try:
        resp = await client.get(f"{url}/health", timeout=TIMEOUT)
        data = resp.json()
        return {
            "service": name,
            "status": data.get("status", "healthy") if resp.status_code == 200 else "degraded",
            "response_ms": int(resp.elapsed.total_seconds() * 1000),
            "details": data,
        }
    except httpx.TimeoutException:
        return {"service": name, "status": "timeout", "response_ms": TIMEOUT * 1000}
    except Exception as e:
        return {"service": name, "status": "down", "error": str(e)}


async def _check_mongodb() -> dict:
    try:
        db = get_database()
        await db.command("ping")
        return {"service": "mongodb", "status": "healthy"}
    except Exception as e:
        return {"service": "mongodb", "status": "down", "error": str(e)}


async def _poll_once() -> None:
    global _current_health
    async with httpx.AsyncClient() as client:
        checks = [_check_service(client, name, url) for name, url in SERVICES.items()]
        checks.append(_check_mongodb())
        results = await asyncio.gather(*checks, return_exceptions=True)

    now = datetime.now(UTC)
    snapshots = []
    for result in results:
        if isinstance(result, Exception):
            continue
        result["timestamp"] = now
        _current_health[result["service"]] = result
        snapshots.append(result.copy())

    # Store snapshots in health_history
    if snapshots:
        try:
            db = get_database()
            await db.health_history.insert_many(snapshots, ordered=False)
        except Exception as e:
            logger.error("health_snapshot_store_failed", error=str(e))


async def health_poller_loop() -> None:
    """Run health polling in background. Call via asyncio.create_task in lifespan."""
    logger.info("health_poller_started", interval=POLL_INTERVAL)
    while True:
        try:
            await _poll_once()
        except Exception as e:
            logger.error("health_poll_failed", error=str(e))
        await asyncio.sleep(POLL_INTERVAL)
