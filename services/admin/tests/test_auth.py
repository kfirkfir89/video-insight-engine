"""Tests for admin auth middleware."""

import pytest
from httpx import ASGITransport, AsyncClient

from src.main import app


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.mark.anyio
async def test_health_no_auth():
    """Health endpoint should be accessible without auth."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "healthy"


@pytest.mark.anyio
async def test_usage_requires_auth():
    """Usage endpoints should require auth."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/usage/stats")
    assert resp.status_code == 401


@pytest.mark.anyio
async def test_usage_wrong_key():
    """Wrong API key should return 401."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/usage/stats", headers={"Authorization": "Bearer wrong-key"})
    assert resp.status_code == 401


@pytest.mark.anyio
async def test_usage_correct_key():
    """Correct API key should pass auth (may get 500 from no DB, but not 401)."""
    from src.config import settings
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        try:
            resp = await client.get("/usage/stats", headers={"Authorization": f"Bearer {settings.ADMIN_API_KEY}"})
            # Auth passes — may be 500 (no DB in test) or 200, but never 401
            assert resp.status_code != 401
        except RuntimeError as e:
            # Expected when MongoDB not initialized — auth already passed
            assert "MongoDB" in str(e)
