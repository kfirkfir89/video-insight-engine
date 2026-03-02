"""Tests for shared request context middleware."""

import asyncio
from unittest.mock import AsyncMock, MagicMock

import pytest
import structlog

from llm_common.middleware import (
    REQUEST_ID_HEADER,
    SILENT_PATHS,
    RequestContextMiddleware,
)


def _make_request(path: str = "/test", method: str = "GET", headers: dict | None = None):
    """Create a mock Starlette Request."""
    req = MagicMock()
    req.url.path = path
    req.method = method
    req.headers = headers or {}
    req.query_params = {}
    return req


def _make_response(status_code: int = 200):
    resp = MagicMock()
    resp.status_code = status_code
    resp.headers = {}
    return resp


class TestSilentPaths:
    def test_health_is_silent(self):
        assert "/health" in SILENT_PATHS

    def test_healthz_is_silent(self):
        assert "/healthz" in SILENT_PATHS

    def test_ready_is_silent(self):
        assert "/ready" in SILENT_PATHS

    def test_normal_path_not_silent(self):
        assert "/api/test" not in SILENT_PATHS


class TestRequestIdHeader:
    def test_header_name(self):
        assert REQUEST_ID_HEADER == "X-Request-ID"


class TestHealthCheckFilter:
    def test_filters_health_get(self):
        from llm_common.middleware import HealthCheckFilter

        f = HealthCheckFilter()
        record = MagicMock()
        record.getMessage.return_value = '"GET /health HTTP/1.1" 200'
        assert f.filter(record) is False

    def test_passes_normal_request(self):
        from llm_common.middleware import HealthCheckFilter

        f = HealthCheckFilter()
        record = MagicMock()
        record.getMessage.return_value = '"POST /api/summarize HTTP/1.1" 200'
        assert f.filter(record) is True
