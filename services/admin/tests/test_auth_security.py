"""Tests for auth middleware security hardening."""

import pytest
from httpx import ASGITransport, AsyncClient

from src.main import app


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.mark.anyio
async def test_timing_safe_comparison():
    """Auth should use timing-safe comparison (hmac.compare_digest)."""
    import src.auth as auth_module
    import hmac
    # Verify hmac is imported in auth module
    assert hasattr(auth_module, 'hmac') or 'hmac' in dir(auth_module) or \
        'compare_digest' in open(auth_module.__file__).read()


@pytest.mark.anyio
async def test_docs_endpoint_requires_auth():
    """OpenAPI docs should not be publicly accessible."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/docs")
    # Should be 404 (disabled) or 401 (requires auth), not 200
    assert resp.status_code != 200


@pytest.mark.anyio
async def test_openapi_json_requires_auth():
    """OpenAPI JSON schema should not be publicly accessible."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/openapi.json")
    assert resp.status_code != 200


@pytest.mark.anyio
async def test_health_still_exempt():
    """Health endpoint should still be accessible without auth."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/health")
    assert resp.status_code == 200


@pytest.mark.anyio
async def test_static_assets_not_blocked():
    """Static asset paths should not require auth."""
    # This verifies the middleware allows /assets/ prefix through
    # (will 404 since no actual assets, but should not 401)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/assets/test.js")
    assert resp.status_code != 401
