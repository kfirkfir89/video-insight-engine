"""Tests for shares route validation and helpers."""

import pytest
from httpx import ASGITransport, AsyncClient

from src.config import settings
from src.main import app


@pytest.fixture
def anyio_backend():
    return "asyncio"


def _auth_headers():
    return {"Authorization": f"Bearer {settings.ADMIN_API_KEY}"}


@pytest.mark.anyio
async def test_shares_top_requires_auth():
    """Shares top endpoint should reject unauthenticated requests."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/shares/top")
    assert resp.status_code == 401


@pytest.mark.anyio
async def test_shares_stats_requires_auth():
    """Shares stats endpoint should reject unauthenticated requests."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/shares/stats")
    assert resp.status_code == 401


@pytest.mark.anyio
async def test_shares_top_validates_days():
    """Days parameter should be validated (1-90)."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/shares/top?days=0", headers=_auth_headers())
    assert resp.status_code == 422


@pytest.mark.anyio
async def test_shares_top_validates_limit():
    """Limit parameter should be validated (1-50)."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/shares/top?limit=0", headers=_auth_headers())
    assert resp.status_code == 422


@pytest.mark.anyio
async def test_shares_stats_validates_days():
    """Days parameter should be validated (1-90)."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/shares/stats?days=100", headers=_auth_headers())
    assert resp.status_code == 422
