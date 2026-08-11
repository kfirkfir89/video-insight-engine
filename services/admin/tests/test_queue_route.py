"""Tests for /queue proxy route — forwards to vie-api admin queue endpoints."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
from httpx import ASGITransport, AsyncClient

from src.config import settings
from src.main import app


@pytest.fixture
def anyio_backend():
    return "asyncio"


def _auth_headers() -> dict[str, str]:
    return {"Authorization": f"Bearer {settings.ADMIN_API_KEY}"}


def _mock_async_client(response: MagicMock) -> MagicMock:
    """Build a context-manager mock that yields an AsyncClient with `.get` returning `response`."""
    instance = MagicMock()
    instance.get = AsyncMock(return_value=response)
    cm = MagicMock()
    cm.__aenter__ = AsyncMock(return_value=instance)
    cm.__aexit__ = AsyncMock(return_value=False)
    return MagicMock(return_value=cm)


@pytest.mark.anyio
async def test_queue_stats_requires_auth():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/queue/stats")
    assert resp.status_code == 401


@pytest.mark.anyio
async def test_queue_stats_wrong_key():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/queue/stats", headers={"Authorization": "Bearer wrong"})
    assert resp.status_code == 401


@pytest.mark.anyio
async def test_queue_stats_proxies_response_body():
    """Happy path: vie-api returns stats JSON, admin returns it verbatim."""
    upstream = MagicMock()
    upstream.status_code = 200
    upstream.json = MagicMock(
        return_value={
            "main": {"messages": 3, "ready": 2, "inFlight": 1, "consumers": 2},
            "dlq": {"messages": 0},
        }
    )

    with patch("src.routes.queue.httpx.AsyncClient", _mock_async_client(upstream)):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get("/queue/stats", headers=_auth_headers())

    assert resp.status_code == 200
    body = resp.json()
    assert body["main"]["consumers"] == 2
    assert body["dlq"]["messages"] == 0


@pytest.mark.anyio
async def test_queue_stats_returns_502_when_vie_api_unreachable():
    """Connection failures to vie-api must surface as 502, not 500."""

    def _raise(*args, **kwargs):
        raise httpx.ConnectError("connection refused")

    instance = MagicMock()
    instance.get = AsyncMock(side_effect=_raise)
    cm = MagicMock()
    cm.__aenter__ = AsyncMock(return_value=instance)
    cm.__aexit__ = AsyncMock(return_value=False)

    with patch("src.routes.queue.httpx.AsyncClient", MagicMock(return_value=cm)):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get("/queue/stats", headers=_auth_headers())

    assert resp.status_code == 502
    assert resp.json()["detail"] == "vie-api unreachable"


@pytest.mark.anyio
async def test_queue_stats_returns_500_on_admin_key_mismatch():
    """vie-api rejecting our admin key is a server misconfig, not a client error."""
    upstream = MagicMock()
    upstream.status_code = 401
    upstream.json = MagicMock(return_value={"error": "UNAUTHORIZED"})

    with patch("src.routes.queue.httpx.AsyncClient", _mock_async_client(upstream)):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get("/queue/stats", headers=_auth_headers())

    assert resp.status_code == 500


@pytest.mark.anyio
async def test_queue_dlq_validates_limit_lower_bound():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/queue/dlq?limit=0", headers=_auth_headers())
    assert resp.status_code == 422


@pytest.mark.anyio
async def test_queue_dlq_validates_limit_upper_bound():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/queue/dlq?limit=500", headers=_auth_headers())
    assert resp.status_code == 422


@pytest.mark.anyio
async def test_queue_dlq_forwards_limit_param():
    """limit= must be passed through to vie-api as a query string parameter."""
    upstream = MagicMock()
    upstream.status_code = 200
    upstream.json = MagicMock(return_value={"messages": []})

    instance = MagicMock()
    instance.get = AsyncMock(return_value=upstream)
    cm = MagicMock()
    cm.__aenter__ = AsyncMock(return_value=instance)
    cm.__aexit__ = AsyncMock(return_value=False)

    with patch("src.routes.queue.httpx.AsyncClient", MagicMock(return_value=cm)):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get("/queue/dlq?limit=42", headers=_auth_headers())

    assert resp.status_code == 200
    assert instance.get.await_count == 1
    call_kwargs = instance.get.await_args.kwargs
    assert call_kwargs["params"] == {"limit": 42}
    assert call_kwargs["headers"]["X-Admin-Key"] == settings.ADMIN_API_KEY
