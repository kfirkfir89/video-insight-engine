"""Queue observability endpoints — proxy to vie-api's admin queue routes.

vie-api is the source of truth for RabbitMQ topology and the management-API
auth. The admin service forwards calls so the UI keeps a single base URL and
auth model.
"""

from __future__ import annotations

import json

import httpx
import structlog
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from src.config import settings

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/queue", tags=["queue"])

_DEFAULT_TIMEOUT = httpx.Timeout(5.0, connect=2.0)


def _admin_headers() -> dict[str, str]:
    return {"X-Admin-Key": settings.ADMIN_API_KEY, "Accept": "application/json"}


def _upstream_url(path: str) -> str:
    return f"{settings.VIE_API_URL.rstrip('/')}/api/admin/queue/{path.lstrip('/')}"


def _upstream_detail(resp: httpx.Response) -> dict | str:
    """vie-api's error envelope (``{error, message[, replayed]}``) when the body
    is a JSON object, else a generic status line.

    Kept structured so a mid-drain ``REPLAY_FAILED`` keeps its partial
    ``replayed`` count — the operator needs to know how many DLQ messages were
    already re-published before the failure. Raw non-JSON bodies are not
    forwarded (they could be proxy/HTML error pages).
    """
    try:
        parsed = json.loads(resp.text)
    except ValueError:
        parsed = None
    if isinstance(parsed, dict):
        return parsed
    return f"vie-api error: {resp.status_code}"


def _translate_upstream(resp: httpx.Response) -> dict:
    if resp.status_code == 401:
        # vie-api rejected our admin key — surfaces as 500 here because the
        # user already proved admin to us; the misconfig is server-side.
        raise HTTPException(status_code=500, detail="vie-api rejected admin key")
    if resp.status_code == 503:
        # vie-api's own "queue disabled / no channel" answer — a real state,
        # not a transport failure. Pass the reason through.
        raise HTTPException(status_code=503, detail=_upstream_detail(resp))
    if resp.status_code >= 500:
        raise HTTPException(status_code=502, detail=_upstream_detail(resp))
    if resp.status_code >= 400:
        raise HTTPException(status_code=resp.status_code, detail=_upstream_detail(resp))
    try:
        return resp.json()
    except ValueError as exc:
        raise HTTPException(status_code=502, detail="vie-api returned a non-JSON body") from exc


async def _proxy_get(path: str, params: dict | None = None) -> dict:
    try:
        async with httpx.AsyncClient(timeout=_DEFAULT_TIMEOUT) as client:
            resp = await client.get(
                _upstream_url(path), headers=_admin_headers(), params=params or {}
            )
    except httpx.RequestError as exc:
        logger.warning("queue_proxy_unreachable", path=path, error=str(exc))
        raise HTTPException(status_code=502, detail="vie-api unreachable") from exc
    return _translate_upstream(resp)


async def _proxy_post(path: str, body: dict, timeout: httpx.Timeout) -> dict:
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(_upstream_url(path), headers=_admin_headers(), json=body)
    except httpx.RequestError as exc:
        logger.warning("queue_proxy_unreachable", path=path, error=str(exc))
        raise HTTPException(status_code=502, detail="vie-api unreachable") from exc
    return _translate_upstream(resp)


@router.get("/stats")
async def queue_stats() -> dict:
    """Return main + DLQ depth and consumer count for the pipeline queue."""
    return await _proxy_get("stats")


@router.get("/dlq")
async def queue_dlq(limit: int = Query(20, ge=1, le=100)) -> dict:
    """Peek at messages currently in the DLQ. Messages are not consumed."""
    return await _proxy_get("dlq", {"limit": limit})


class ReplayRequest(BaseModel):
    """Body for POST /queue/replay — mirrors vie-api's cap (1–500, default 100)."""

    max: int = Field(100, ge=1, le=500)


# Replay drains up to 500 messages with publisher confirms — give it room.
_REPLAY_TIMEOUT = httpx.Timeout(30.0, connect=2.0)


@router.post("/replay")
async def queue_replay(body: ReplayRequest) -> dict:
    """Re-publish DLQ messages to the main queue (attempt reset to 1).

    vie-api owns the AMQP channel and does the confirm-then-ack drain; this
    proxy only exists so the UI keeps one base URL + auth model. Returns
    ``{"replayed": N}``.
    """
    logger.info("queue_replay_requested", max=body.max)
    return await _proxy_post("replay", {"max": body.max}, _REPLAY_TIMEOUT)
