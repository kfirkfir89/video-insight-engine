"""Health poller infra checks (observability-fix 2.2a).

The poller used to probe only the three HTTP services + Mongo; Redis, RabbitMQ,
Qdrant and the worker were invisible. These tests pin each new check's mapping.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import httpx
import pytest

from src.services import health_checker as hc

pytestmark = pytest.mark.anyio


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


def _response(status_code: int, body: dict | None = None, elapsed_ms: int = 5) -> MagicMock:
    resp = MagicMock()
    resp.status_code = status_code
    resp.json = MagicMock(return_value=body or {})
    resp.elapsed.total_seconds.return_value = elapsed_ms / 1000
    return resp


def _client(response=None, side_effect=None) -> MagicMock:
    client = MagicMock()
    client.get = AsyncMock(return_value=response, side_effect=side_effect)
    return client


class TestApiDependencies:
    async def test_should_map_ok_checks_to_healthy(self):
        client = _client(
            _response(200, {"checks": {"mongodb": "ok", "redis": "ok", "rabbitmq": "ok"}})
        )
        rows = {r["service"]: r["status"] for r in await hc._check_api_dependencies(client)}
        assert rows == {"redis": "healthy", "rabbitmq": "healthy"}

    async def test_should_map_failed_check_to_down(self):
        client = _client(_response(503, {"checks": {"redis": "failed", "rabbitmq": "ok"}}))
        rows = {r["service"]: r["status"] for r in await hc._check_api_dependencies(client)}
        assert rows["redis"] == "down"
        assert rows["rabbitmq"] == "healthy"

    async def test_should_report_unknown_when_check_absent(self):
        client = _client(_response(200, {"checks": {"redis": "ok"}}))
        rows = {r["service"]: r["status"] for r in await hc._check_api_dependencies(client)}
        assert rows["rabbitmq"] == "unknown"

    async def test_should_report_timeout_for_both(self):
        client = _client(side_effect=httpx.ReadTimeout("slow"))
        rows = {r["service"]: r["status"] for r in await hc._check_api_dependencies(client)}
        assert rows == {"redis": "timeout", "rabbitmq": "timeout"}

    async def test_should_report_unknown_not_down_when_api_unreachable(self):
        # vie-api being down says nothing about Redis/RabbitMQ; ``down`` here
        # would charge every API restart against their uptime history.
        client = _client(side_effect=httpx.ConnectError("refused"))
        rows = await hc._check_api_dependencies(client)
        assert {r["status"] for r in rows} == {"unknown"}
        assert all("unreachable" in r["error"] for r in rows)

    async def test_should_report_unknown_when_ready_body_is_not_json(self):
        resp = _response(502)
        resp.json = MagicMock(side_effect=ValueError("no json"))
        rows = await hc._check_api_dependencies(_client(resp))
        assert {r["status"] for r in rows} == {"unknown"}


class TestQdrant:
    async def test_should_be_healthy_on_200(self):
        row = await hc._check_qdrant(_client(_response(200)))
        assert row["status"] == "healthy"
        assert row["response_ms"] == 5

    async def test_should_be_degraded_on_non_200(self):
        row = await hc._check_qdrant(_client(_response(503)))
        assert row["status"] == "degraded"

    async def test_should_be_down_on_connect_error(self):
        row = await hc._check_qdrant(_client(side_effect=httpx.ConnectError("refused")))
        assert row["status"] == "down"


class TestWorker:
    async def test_should_be_healthy_with_consumers(self):
        client = _client(_response(200, {"main": {"consumers": 2}, "dlq": {"messages": 1}}))
        row = await hc._check_worker(client)
        assert row["status"] == "healthy"
        assert row["details"] == {"consumers": 2, "dlq": 1}

    async def test_should_be_down_with_zero_consumers(self):
        client = _client(_response(200, {"main": {"consumers": 0}, "dlq": {}}))
        assert (await hc._check_worker(client))["status"] == "down"

    async def test_should_be_unknown_when_queue_stats_unavailable(self):
        client = _client(_response(502, {"error": "MANAGEMENT_UNREACHABLE"}))
        assert (await hc._check_worker(client))["status"] == "unknown"

    async def test_should_send_admin_key(self):
        client = _client(_response(200, {"main": {"consumers": 1}, "dlq": {}}))
        await hc._check_worker(client)
        assert client.get.await_args.kwargs["headers"]["X-Admin-Key"] == hc.settings.ADMIN_API_KEY


class TestPollOnce:
    async def test_should_flatten_list_results_into_current_health(self, monkeypatch):
        def ok(service: str, status: str = "healthy") -> AsyncMock:
            return AsyncMock(return_value={"service": service, "status": status})

        monkeypatch.setattr(hc, "_check_service", ok("vie-api"))
        monkeypatch.setattr(hc, "_check_mongodb", ok("mongodb"))
        monkeypatch.setattr(hc, "_check_qdrant", ok("qdrant"))
        monkeypatch.setattr(hc, "_check_worker", ok("vie-summarizer-worker", "down"))
        monkeypatch.setattr(
            hc,
            "_check_api_dependencies",
            AsyncMock(
                return_value=[
                    {"service": "redis", "status": "healthy"},
                    {"service": "rabbitmq", "status": "healthy"},
                ]
            ),
        )
        db = MagicMock()
        db.health_history.insert_many = AsyncMock()
        monkeypatch.setattr(hc, "get_database", lambda: db)
        hc._current_health.clear()

        await hc._poll_once()

        health = hc.get_current_health()
        expected = {"vie-api", "mongodb", "qdrant", "vie-summarizer-worker", "redis", "rabbitmq"}
        assert set(health) >= expected
        assert health["vie-summarizer-worker"]["status"] == "down"
        assert db.health_history.insert_many.await_count == 1
        snapshots = db.health_history.insert_many.await_args.args[0]
        assert {row["service"] for row in snapshots} == set(health)


class TestNormalizeStatus:
    @pytest.mark.parametrize("word", ["ok", "healthy", "OK", "up"])
    def test_should_treat_liveness_words_as_healthy(self, word):
        assert hc._normalize_status(word, 200) == "healthy"

    def test_should_pass_through_degraded_from_body(self):
        assert hc._normalize_status("degraded", 200) == "degraded"

    def test_should_be_degraded_on_non_200(self):
        assert hc._normalize_status("ok", 503) == "degraded"

    def test_should_default_to_healthy_when_body_has_no_status(self):
        assert hc._normalize_status(None, 200) == "healthy"


class TestReconcileRabbitmq:
    def test_should_mark_healthy_when_worker_probe_reached_management_api(self):
        rows = [
            {"service": "rabbitmq", "status": "unknown"},
            {"service": "vie-summarizer-worker", "status": "down", "details": {"consumers": 0}},
        ]
        hc._reconcile_rabbitmq(rows)
        assert rows[0]["status"] == "healthy"

    def test_should_leave_unknown_when_queue_stats_failed(self):
        rows = [
            {"service": "rabbitmq", "status": "unknown"},
            {"service": "vie-summarizer-worker", "status": "unknown", "error": "queue stats 502"},
        ]
        hc._reconcile_rabbitmq(rows)
        assert rows[0]["status"] == "unknown"

    def test_should_not_override_a_real_ready_result(self):
        rows = [
            {"service": "rabbitmq", "status": "down"},
            {"service": "vie-summarizer-worker", "status": "healthy", "details": {"consumers": 1}},
        ]
        hc._reconcile_rabbitmq(rows)
        assert rows[0]["status"] == "down"
