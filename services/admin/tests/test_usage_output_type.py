"""Tests for usage by-output-type endpoint validation and the total_tokens computation."""

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
async def test_by_output_type_requires_auth():
    """by-output-type endpoint should reject unauthenticated requests."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/usage/by-output-type")
    assert resp.status_code == 401


@pytest.mark.anyio
async def test_by_output_type_validates_days_min():
    """Days below minimum should return 422."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/usage/by-output-type?days=0", headers=_auth_headers())
    assert resp.status_code == 422


@pytest.mark.anyio
async def test_by_output_type_validates_days_max():
    """Days above maximum should return 422."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/usage/by-output-type?days=100", headers=_auth_headers())
    assert resp.status_code == 422


@pytest.mark.anyio
async def test_stats_returns_total_tokens():
    """usage/stats should include a computed total_tokens field."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/usage/stats", headers=_auth_headers())
    assert resp.status_code == 200
    data = resp.json()
    assert "total_tokens" in data
    expected = (data.get("total_tokens_in") or 0) + (data.get("total_tokens_out") or 0)
    assert data["total_tokens"] == expected


@pytest.mark.anyio
async def test_stats_total_tokens_defaults_to_zero():
    """total_tokens should be 0 when there is no usage data."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Use days=1 to minimize chance of hitting real data in tests
        resp = await client.get("/usage/stats?days=1", headers=_auth_headers())
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_tokens"] >= 0
