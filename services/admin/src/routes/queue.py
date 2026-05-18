"""Queue observability endpoints — proxy to vie-api's admin queue routes.

vie-api is the source of truth for RabbitMQ topology and the management-API
auth. The admin service forwards calls so the UI keeps a single base URL and
auth model.
"""

from __future__ import annotations

import httpx
import structlog
from fastapi import APIRouter, HTTPException, Query

from src.config import settings

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/queue", tags=["queue"])

_DEFAULT_TIMEOUT = httpx.Timeout(5.0, connect=2.0)


def _admin_headers() -> dict[str, str]:
    return {"X-Admin-Key": settings.ADMIN_API_KEY, "Accept": "application/json"}


async def _proxy_get(path: str, params: dict | None = None) -> dict:
    url = f"{settings.VIE_API_URL.rstrip('/')}/api/admin/queue/{path.lstrip('/')}"
    try:
        async with httpx.AsyncClient(timeout=_DEFAULT_TIMEOUT) as client:
            resp = await client.get(url, headers=_admin_headers(), params=params or {})
    except httpx.RequestError as exc:
        logger.warning("queue_proxy_unreachable", path=path, error=str(exc))
        raise HTTPException(status_code=502, detail="vie-api unreachable") from exc

    if resp.status_code == 401:
        # vie-api rejected our admin key — surfaces as 500 here because the
        # user already proved admin to us; the misconfig is server-side.
        raise HTTPException(status_code=500, detail="vie-api rejected admin key")

    if resp.status_code >= 500:
        raise HTTPException(status_code=502, detail=f"vie-api error: {resp.status_code}")

    return resp.json()


@router.get("/stats")
async def queue_stats() -> dict:
    """Return main + DLQ depth and consumer count for the pipeline queue."""
    return await _proxy_get("stats")


@router.get("/dlq")
async def queue_dlq(limit: int = Query(20, ge=1, le=100)) -> dict:
    """Peek at messages currently in the DLQ. Messages are not consumed."""
    return await _proxy_get("dlq", {"limit": limit})
