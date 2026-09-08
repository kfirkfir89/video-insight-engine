"""Sentry capture for unclassified pipeline failures (pipeline_runner._report_unexpected_failure).

The SSE-direct pipeline path used to swallow unexpected exceptions into an
SSE ``error`` frame with nothing reaching Sentry.
"""

from __future__ import annotations

from unittest.mock import patch

import structlog

from src.routes import pipeline_runner as pr


class TestReportUnexpectedFailure:
    def setup_method(self) -> None:
        structlog.contextvars.clear_contextvars()

    def teardown_method(self) -> None:
        structlog.contextvars.clear_contextvars()

    def test_should_capture_exception_tagged_sse_direct_when_no_worker_context(self):
        exc = ValueError("boom")
        with patch.object(pr, "capture_exception_with_context") as capture:
            ref = pr._report_unexpected_failure(exc, "vid-1", 12.5)

        capture.assert_called_once()
        assert capture.call_args.args[0] is exc
        tags = capture.call_args.kwargs
        assert tags["videoSummaryId"] == "vid-1"
        assert tags["errorRef"] == ref
        assert tags["outcome"] == "pipeline_failed"
        assert tags["path"] == "sse-direct"
        assert tags["attempt"] is None

    def test_should_tag_worker_path_with_attempt_when_bound(self):
        structlog.contextvars.bind_contextvars(request_id="r1", attempt=2)
        with patch.object(pr, "capture_exception_with_context") as capture:
            pr._report_unexpected_failure(RuntimeError("x"), "vid-2", 1.0)

        tags = capture.call_args.kwargs
        assert tags["path"] == "worker"
        assert tags["attempt"] == "2"

    def test_should_return_short_error_ref(self):
        with patch.object(pr, "capture_exception_with_context"):
            ref = pr._report_unexpected_failure(RuntimeError("x"), "vid-3", 0.0)
        assert isinstance(ref, str) and len(ref) == 8
