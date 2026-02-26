"""Tests for aggregator input validation."""

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
async def test_invalid_date_format_handled():
    """Invalid target_date should return 422, not crash."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/admin/aggregate-daily?target_date=not-a-date", headers=_auth_headers())
    assert resp.status_code == 422
    data = resp.json()
    assert "detail" in data
