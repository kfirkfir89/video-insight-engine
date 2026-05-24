"""Request-ID middleware integration tests for the assistant service.

The shared ``llm_common.middleware.RequestContextMiddleware`` is wired into the
FastAPI app so every response carries an ``X-Request-ID`` header — either the
caller's value or a freshly-generated one — and every structlog line emitted
during the request is bound to that id.
"""

from __future__ import annotations

import re


UUID_LIKE = re.compile(r"^[0-9a-fA-F-]{8,}$")


class TestRequestIdMiddleware:
    """Wired via ``add_request_context_middleware`` in ``server.create_app``."""

    async def test_should_echo_incoming_request_id_header(self, app_client):
        incoming = "edge-trace-abcdef12"
        response = await app_client.get(
            "/health",
            headers={"X-Request-ID": incoming},
        )
        assert response.headers.get("X-Request-ID") == incoming

    async def test_should_generate_request_id_when_header_missing(self, app_client):
        response = await app_client.get("/health")
        request_id = response.headers.get("X-Request-ID")
        assert request_id is not None
        assert UUID_LIKE.match(request_id)

    async def test_should_stamp_request_id_on_validation_errors(self, app_client):
        # Even when FastAPI rejects the payload, the middleware wraps the
        # response so support can still tie a 4xx back to a log line.
        incoming = "validation-trace-xyz789ab"
        response = await app_client.post(
            "/action",
            json={"missing_required_fields": True},
            headers={"X-Request-ID": incoming},
        )
        assert response.status_code == 422
        assert response.headers.get("X-Request-ID") == incoming
