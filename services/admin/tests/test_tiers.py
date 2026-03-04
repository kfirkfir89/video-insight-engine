"""Tests for tiers route validation and access control."""

import pytest
from httpx import ASGITransport, AsyncClient

from src.main import app


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.mark.anyio
async def test_tier_distribution_requires_auth():
    """Tier distribution endpoint should reject unauthenticated requests."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/tiers/distribution")
    assert resp.status_code == 401


@pytest.mark.anyio
async def test_tier_distribution_rejects_wrong_key():
    """Tier distribution endpoint should reject wrong API key."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get(
            "/tiers/distribution",
            headers={"Authorization": "Bearer wrong-key"},
        )
    assert resp.status_code == 401
