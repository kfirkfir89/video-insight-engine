"""/health/overview rollup semantics (src/routes/health.py::rollup_status)."""

from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from src.config import settings
from src.main import app
from src.routes import health as health_module
from src.routes.health import rollup_status


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


def _auth_headers() -> dict[str, str]:
    return {"Authorization": f"Bearer {settings.ADMIN_API_KEY}"}


def _svc(status: str) -> dict:
    return {"status": status}


class TestRollupStatus:
    def test_should_be_unknown_before_first_poll(self):
        # all([]) is True — the old code reported a green system at boot.
        assert rollup_status({}) == "unknown"

    def test_should_be_healthy_when_every_service_is_healthy(self):
        assert rollup_status({"a": _svc("healthy"), "b": _svc("healthy")}) == "healthy"

    def test_should_be_down_when_any_service_is_down(self):
        assert rollup_status({"a": _svc("healthy"), "b": _svc("down")}) == "down"

    @pytest.mark.parametrize("bad", ["degraded", "timeout"])
    def test_should_be_degraded_for_non_healthy_non_down(self, bad):
        assert rollup_status({"a": _svc("healthy"), "b": _svc(bad)}) == "degraded"

    def test_down_should_beat_degraded(self):
        assert rollup_status({"a": _svc("timeout"), "b": _svc("down")}) == "down"


@pytest.mark.anyio
async def test_overview_route_uses_rollup(monkeypatch):
    monkeypatch.setattr(health_module, "get_current_health", lambda: {"vie-api": _svc("timeout")})
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/health/overview", headers=_auth_headers())
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "degraded"
    assert body["services"]["vie-api"]["status"] == "timeout"
    assert "checked_at" in body
