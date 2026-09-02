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
    "vie-assistant": settings.VIE_ASSISTANT_URL,
}

# Infra observed through vie-api's readiness probe: its ``checks`` map says
# whether the API can actually reach each dependency, which is the question
# that matters (a green Redis nobody can connect to is still an outage).
API_READY_DEPENDENCIES = ("redis", "rabbitmq")


def get_current_health() -> dict[str, dict]:
    return dict(_current_health)


# Liveness bodies differ per service: vie-api answers ``{"status": "ok"}``,
# the Python services ``{"status": "healthy"}``. Both mean healthy.
_HEALTHY_WORDS = frozenset({"ok", "healthy", "up"})


def _normalize_status(reported: object, status_code: int) -> str:
    if status_code != 200:
        return "degraded"
    if reported is None:
        return "healthy"
    word = str(reported).lower()
    return "healthy" if word in _HEALTHY_WORDS else word


async def _check_service(client: httpx.AsyncClient, name: str, url: str) -> dict:
    try:
        resp = await client.get(f"{url}/health", timeout=TIMEOUT)
        data = resp.json()
        return {
            "service": name,
            "status": _normalize_status(data.get("status"), resp.status_code),
            "response_ms": int(resp.elapsed.total_seconds() * 1000),
            "details": data,
        }
    except httpx.TimeoutException:
        return {"service": name, "status": "timeout", "response_ms": TIMEOUT * 1000}
    except Exception as e:
        return {"service": name, "status": "down", "error": str(e)}


async def _check_api_dependencies(client: httpx.AsyncClient) -> list[dict]:
    """Redis + RabbitMQ as seen by vie-api's ``GET /ready`` (2s per check inside).

    When vie-api itself can't be reached (or answers garbage) the probe has
    observed nothing about Redis/RabbitMQ, so they are ``unknown`` — not
    ``down``. Reporting ``down`` here charged every vie-api restart against
    Redis/RabbitMQ uptime in ``health_history``.
    """
    try:
        resp = await client.get(f"{settings.VIE_API_URL}/ready", timeout=TIMEOUT)
        checks = resp.json().get("checks", {})
    except httpx.TimeoutException:
        return [{"service": name, "status": "timeout"} for name in API_READY_DEPENDENCIES]
    except Exception as e:
        return [
            {"service": name, "status": "unknown", "error": f"vie-api /ready unreachable: {e}"}
            for name in API_READY_DEPENDENCIES
        ]
    results = []
    for name in API_READY_DEPENDENCIES:
        state = checks.get(name)
        if state is None:
            # Queue disabled → no rabbitmq check; report it so the grid stays honest.
            results.append({"service": name, "status": "unknown"})
        else:
            results.append({"service": name, "status": "healthy" if state == "ok" else "down"})
    return results


async def _check_qdrant(client: httpx.AsyncClient) -> dict:
    """``/readyz`` answers 200 "all shards are ready" only once collections load."""
    try:
        resp = await client.get(f"{settings.QDRANT_URL}/readyz", timeout=TIMEOUT)
        status = "healthy" if resp.status_code == 200 else "degraded"
        return {
            "service": "qdrant",
            "status": status,
            "response_ms": int(resp.elapsed.total_seconds() * 1000),
        }
    except httpx.TimeoutException:
        return {"service": "qdrant", "status": "timeout", "response_ms": TIMEOUT * 1000}
    except Exception as e:
        return {"service": "qdrant", "status": "down", "error": str(e)}


async def _check_worker(client: httpx.AsyncClient) -> dict:
    """Worker liveness = at least one consumer on the pipeline queue.

    The worker has no HTTP surface; the RabbitMQ consumer count (via vie-api's
    admin queue proxy) is the only signal visible from here. Zero consumers
    with the queue reachable means every worker is gone — ``down``.
    """
    try:
        resp = await client.get(
            f"{settings.VIE_API_URL}/api/admin/queue/stats",
            headers={"X-Admin-Key": settings.ADMIN_API_KEY},
            timeout=TIMEOUT,
        )
        if resp.status_code != 200:
            return {
                "service": "vie-summarizer-worker",
                "status": "unknown",
                "error": f"queue stats {resp.status_code}",
            }
        stats = resp.json()
        consumers = int(stats.get("main", {}).get("consumers", 0))
        return {
            "service": "vie-summarizer-worker",
            "status": "healthy" if consumers > 0 else "down",
            "details": {"consumers": consumers, "dlq": stats.get("dlq", {}).get("messages", 0)},
        }
    except httpx.TimeoutException:
        return {"service": "vie-summarizer-worker", "status": "timeout"}
    except Exception as e:
        return {"service": "vie-summarizer-worker", "status": "down", "error": str(e)}


def _reconcile_rabbitmq(results: list[dict]) -> None:
    """Fill in RabbitMQ from the queue-stats probe when /ready doesn't cover it.

    With ``USE_QUEUE_PIPELINE=false`` the API has no channel and its /ready
    omits the rabbitmq check, yet the broker is still up and the worker
    consumes from it. The worker probe went through the management API, so a
    successful answer there proves RabbitMQ is reachable.
    """
    by_service = {r["service"]: r for r in results}
    rabbit = by_service.get("rabbitmq")
    worker = by_service.get("vie-summarizer-worker")
    if rabbit is None or rabbit.get("status") != "unknown" or worker is None:
        return
    if "details" in worker:
        rabbit["status"] = "healthy"
        rabbit["details"] = {"via": "management-api"}


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
        checks.append(_check_qdrant(client))
        checks.append(_check_worker(client))
        checks.append(_check_api_dependencies(client))
        gathered = await asyncio.gather(*checks, return_exceptions=True)

    results: list[dict] = []
    for item in gathered:
        if isinstance(item, Exception):
            continue
        results.extend(item if isinstance(item, list) else [item])
    _reconcile_rabbitmq(results)

    now = datetime.now(UTC)
    snapshots = []
    for result in results:
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
