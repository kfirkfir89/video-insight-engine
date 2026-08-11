"""Tests for usage by-output-type endpoint validation and the total_tokens computation."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import ASGITransport, AsyncClient

from src.config import settings
from src.main import app
from src.routes import usage as usage_module


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


def _auth_headers() -> dict[str, str]:
    return {"Authorization": f"Bearer {settings.ADMIN_API_KEY}"}


@pytest.fixture
def mock_db(monkeypatch: pytest.MonkeyPatch) -> MagicMock:
    """Replace get_database in the usage route module with an empty-results mock.

    Motor's aggregate() is sync and returns a cursor; to_list() is async.
    Also clears the route-level TTL cache so each test hits the mock.
    """
    db = MagicMock()
    cursor = MagicMock()
    cursor.to_list = AsyncMock(return_value=[])
    db.llm_usage.aggregate.return_value = cursor
    monkeypatch.setattr(usage_module, "get_database", lambda: db)
    usage_module._cache.clear()
    return db


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
async def test_stats_returns_total_tokens(mock_db: MagicMock):
    """usage/stats should include a computed total_tokens field."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/usage/stats", headers=_auth_headers())
    assert resp.status_code == 200
    data = resp.json()
    assert "total_tokens" in data
    expected = (data.get("total_tokens_in") or 0) + (data.get("total_tokens_out") or 0)
    assert data["total_tokens"] == expected


@pytest.mark.anyio
async def test_stats_total_tokens_computed_from_aggregation(mock_db: MagicMock):
    """total_tokens should equal tokens_in + tokens_out from the aggregation result."""
    mock_db.llm_usage.aggregate.return_value.to_list = AsyncMock(
        return_value=[
            {
                "_id": None,
                "total_calls": 3,
                "total_tokens_in": 1200,
                "total_tokens_out": 800,
                "total_cost_usd": 0.05,
                "avg_duration_ms": 900.0,
                "success_count": 3,
                "failure_count": 0,
            }
        ]
    )
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/usage/stats", headers=_auth_headers())
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_tokens"] == 2000
    assert "_id" not in data


@pytest.mark.anyio
async def test_stats_total_tokens_defaults_to_zero(mock_db: MagicMock):
    """total_tokens should be 0 when there is no usage data."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/usage/stats?days=1", headers=_auth_headers())
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_tokens"] == 0
