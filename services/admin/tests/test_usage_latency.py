"""p50/p95 latency on the usage aggregations (observability-fix 2.3).

Every latency figure used to be a ``$avg``. The ``$percentile`` accumulator
(MongoDB 7) is added to /usage/stats, /usage/by-feature and /usage/by-model,
and its array result is unpacked into ``p50_duration_ms`` / ``p95_duration_ms``.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import ASGITransport, AsyncClient

from src.config import settings
from src.main import app
from src.routes import usage as usage_module
from src.routes.usage import LATENCY_PERCENTILE_STAGE, _unpack_latency


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


def _auth_headers() -> dict[str, str]:
    return {"Authorization": f"Bearer {settings.ADMIN_API_KEY}"}


@pytest.fixture
def mock_db(monkeypatch: pytest.MonkeyPatch) -> MagicMock:
    db = MagicMock()
    cursor = MagicMock()
    cursor.to_list = AsyncMock(return_value=[])
    db.llm_usage.aggregate.return_value = cursor
    monkeypatch.setattr(usage_module, "get_database", lambda: db)
    usage_module._cache.clear()
    return db


def _group_stage(db: MagicMock) -> dict:
    pipeline = db.llm_usage.aggregate.call_args.args[0]
    return next(stage["$group"] for stage in pipeline if "$group" in stage)


class TestUnpackLatency:
    def test_should_expand_percentile_array_into_named_fields(self):
        row = {"_id": "x", "latency_percentiles": [120.0, 980.5]}
        assert _unpack_latency(row) == {
            "_id": "x",
            "p50_duration_ms": 120.0,
            "p95_duration_ms": 980.5,
        }

    def test_should_tolerate_missing_percentiles(self):
        assert _unpack_latency({"_id": "x"}) == {"_id": "x"}

    def test_stage_should_target_duration_ms(self):
        assert LATENCY_PERCENTILE_STAGE["$percentile"]["input"] == "$duration_ms"
        assert LATENCY_PERCENTILE_STAGE["$percentile"]["p"] == [0.5, 0.95]


@pytest.mark.anyio
@pytest.mark.parametrize(
    ("path", "key"),
    [("/usage/stats", None), ("/usage/by-feature", "feature"), ("/usage/by-model", "model")],
)
async def test_aggregations_should_request_percentiles(mock_db: MagicMock, path, key):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get(path, headers=_auth_headers())
    assert resp.status_code == 200
    assert _group_stage(mock_db)["latency_percentiles"] == LATENCY_PERCENTILE_STAGE


@pytest.mark.anyio
async def test_by_feature_should_return_p95(mock_db: MagicMock):
    mock_db.llm_usage.aggregate.return_value.to_list = AsyncMock(
        return_value=[
            {
                "_id": "summarize:plan",
                "calls": 3,
                "cost_usd": 0.1,
                "avg_duration_ms": 500.0,
                "latency_percentiles": [450.0, 900.0],
            }
        ]
    )
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/usage/by-feature", headers=_auth_headers())
    row = resp.json()[0]
    assert row["feature"] == "summarize:plan"
    assert row["p50_duration_ms"] == 450.0
    assert row["p95_duration_ms"] == 900.0
    assert "latency_percentiles" not in row


@pytest.mark.anyio
async def test_stats_should_return_p95(mock_db: MagicMock):
    mock_db.llm_usage.aggregate.return_value.to_list = AsyncMock(
        return_value=[
            {
                "_id": None,
                "total_calls": 2,
                "total_tokens_in": 1,
                "total_tokens_out": 1,
                "total_cost_usd": 0.01,
                "avg_duration_ms": 10.0,
                "latency_percentiles": [9.0, 19.0],
                "success_count": 2,
                "failure_count": 0,
            }
        ]
    )
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/usage/stats", headers=_auth_headers())
    body = resp.json()
    assert body["p95_duration_ms"] == 19.0
    assert "latency_percentiles" not in body
