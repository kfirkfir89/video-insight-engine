"""Tests for usage route input validation and security."""

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
async def test_invalid_cursor_id_returns_400():
    """Invalid before_id should return 400, not 500."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/usage/recent?before_id=invalid-id", headers=_auth_headers())
    assert resp.status_code == 400


@pytest.mark.anyio
async def test_video_id_max_length_enforced():
    """video_id path param should be capped at 64 chars."""
    long_id = "a" * 100
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get(f"/usage/video/{long_id}", headers=_auth_headers())
    assert resp.status_code == 422  # FastAPI validation error
