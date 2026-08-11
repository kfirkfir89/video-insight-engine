"""The structured log line shape is a cross-system contract.

Every JSON log line must include ``service``, the optional contextvars that
the worker binds (``request_id``, ``video_summary_id``, ``user_id``), an ISO
``timestamp``, and a ``level``. The Phase 6 ``find-request.sh`` script greps
these fields, so changes here break support tooling — keep the schema honest.
"""

from __future__ import annotations

import io
import json
import logging
import sys
from contextlib import redirect_stdout

import pytest
import structlog

from src.logging_config import configure_structlog, get_logger


@pytest.fixture(autouse=True)
def _isolate_structlog():
    structlog.contextvars.clear_contextvars()
    # Stash + restore stdlib handlers — configure_structlog rewires basicConfig.
    root = logging.getLogger()
    saved_handlers = list(root.handlers)
    saved_level = root.level
    yield
    structlog.contextvars.clear_contextvars()
    root.handlers = saved_handlers
    root.level = saved_level


def _emit_and_capture(service_name: str, msg: str, **bound) -> dict:
    configure_structlog(json_format=True, service_name=service_name)
    logger = get_logger("test")

    if bound:
        structlog.contextvars.bind_contextvars(**bound)

    buffer = io.StringIO()
    with redirect_stdout(buffer):
        logger.info(msg)
        sys.stdout.flush()
    line = buffer.getvalue().strip().splitlines()[-1]
    return json.loads(line)


def test_log_line_includes_service_field():
    payload = _emit_and_capture("vie-summarizer-test", "ping")
    assert payload["service"] == "vie-summarizer-test"


def test_log_line_includes_request_id_when_bound():
    payload = _emit_and_capture(
        "vie-summarizer-test",
        "ping",
        request_id="req-trace-aaaa1111",
    )
    assert payload["request_id"] == "req-trace-aaaa1111"


def test_log_line_carries_video_summary_id_when_bound():
    payload = _emit_and_capture(
        "vie-summarizer-test",
        "ping",
        request_id="req-1",
        video_summary_id="vid-42",
    )
    assert payload["video_summary_id"] == "vid-42"


def test_log_line_has_iso_timestamp_and_level():
    payload = _emit_and_capture("vie-summarizer-test", "ping")
    assert payload["level"] == "info"
    assert "timestamp" in payload
    # ISO 8601 / RFC 3339 — `2026-05-20T...` shape (no whitespace).
    assert "T" in payload["timestamp"]


def test_log_line_explicit_service_field_is_not_overwritten():
    # If a caller passes `service=...` in the log call, structlog should keep
    # the caller's value — the processor uses setdefault to avoid clobbering.
    configure_structlog(json_format=True, service_name="vie-summarizer-test")
    logger = get_logger("test")
    buffer = io.StringIO()
    with redirect_stdout(buffer):
        logger.info("ping", service="custom-service")
        sys.stdout.flush()
    payload = json.loads(buffer.getvalue().strip().splitlines()[-1])
    assert payload["service"] == "custom-service"
