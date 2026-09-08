"""Health monitoring endpoints."""

from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Query

from src.dependencies import get_database
from src.services.health_checker import get_current_health

router = APIRouter(prefix="/health", tags=["health"])


@router.get("/services")
async def health_services():
    """Current health of all services."""
    return get_current_health()


def rollup_status(health: dict[str, dict]) -> str:
    """Collapse per-service statuses into one word.

    ``down`` beats ``degraded`` beats ``healthy``; ``timeout`` (a probe that
    never answered) counts as degraded rather than silently passing. An empty
    map — the poller hasn't completed a cycle yet — is ``unknown``, not
    ``healthy`` (``all([])`` is True and used to report a green system at boot).
    """
    statuses = [s.get("status") for s in health.values()]
    if not statuses:
        return "unknown"
    if any(s == "down" for s in statuses):
        return "down"
    if any(s != "healthy" for s in statuses):
        return "degraded"
    return "healthy"


@router.get("/overview")
async def health_overview():
    """Aggregated system status."""
    health = get_current_health()
    return {
        "status": rollup_status(health),
        "services": health,
        "checked_at": datetime.now(UTC).isoformat(),
    }


@router.get("/history")
async def health_history(
    service: str | None = None,
    hours: int = Query(24, ge=1, le=168),
):
    """Health snapshots from health_history collection."""
    db = get_database()
    cutoff = datetime.now(UTC) - timedelta(hours=hours)
    query: dict = {"timestamp": {"$gte": cutoff}}
    if service:
        query["service"] = service

    cursor = db.health_history.find(query, {"_id": 0}).sort("timestamp", -1).limit(500)
    return await cursor.to_list(500)


@router.get("/uptime")
async def health_uptime(
    service: str | None = None,
    days: int = Query(7, ge=1, le=30),
):
    """Uptime percentage calculation."""
    db = get_database()
    cutoff = datetime.now(UTC) - timedelta(days=days)
    query: dict = {"timestamp": {"$gte": cutoff}}
    if service:
        query["service"] = service

    pipeline = [
        {"$match": query},
        {
            "$group": {
                "_id": "$service",
                "total": {"$sum": 1},
                "healthy": {"$sum": {"$cond": [{"$eq": ["$status", "healthy"]}, 1, 0]}},
            }
        },
    ]
    results = await db.health_history.aggregate(pipeline).to_list(10)
    return {
        r["_id"]: {
            "uptime_pct": round(r["healthy"] / r["total"] * 100, 2) if r["total"] > 0 else 0,
            "total_checks": r["total"],
            "healthy_checks": r["healthy"],
        }
        for r in results
    }
