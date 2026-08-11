"""Shared FastAPI middleware for request tracking and logging.

Provides:
- Request ID generation and propagation
- Request/response logging with timing (skips health checks)
- Context binding for structured logs
- Health check log filter for uvicorn access logs

Used by both summarizer and assistant services.
"""

import logging
import re
import time
import uuid
from typing import Awaitable, Callable

import structlog
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = structlog.get_logger(__name__)

# Header name for request ID (can be provided by client or generated)
REQUEST_ID_HEADER = "X-Request-ID"

# Mirror the API gateway's validation: only ASCII safe chars, 8–128 long.
# Strict enough to reject log-injection attempts (newlines, control chars,
# unicode tricks) before the value is bound to structlog contextvars or
# promoted to a Sentry tag. Internal callers and tests that bypass the API
# gateway still go through this guard.
#
# `\A` / `\Z` (not `^` / `$`): Python's `$` matches end-of-string OR just
# before a final `\n`, so `^[A-Za-z0-9_-]{8,128}$` with `re.match` would
# accept "abcd1234\n" and let the newline through into structlog contextvars
# and the X-Request-ID response header. The API gateway's JS regex doesn't
# have this quirk, so without strict end-of-string anchors the two sides
# diverge for exactly the payload this pattern is supposed to defend against.
_REQUEST_ID_PATTERN = re.compile(r"\A[A-Za-z0-9_-]{8,128}\Z")

# Paths that should not be logged (health checks, readiness probes)
SILENT_PATHS = frozenset({"/health", "/healthz", "/ready"})


class HealthCheckFilter(logging.Filter):
    """Filter out health check access logs to reduce noise."""

    def filter(self, record: logging.LogRecord) -> bool:
        msg = record.getMessage()
        return '"GET /health' not in msg


class RequestContextMiddleware(BaseHTTPMiddleware):
    """Middleware that adds request ID and logging context to each request.

    Features:
    - Generates unique request ID if not provided
    - Binds request context for structured logging
    - Logs request start/end with timing (skips health checks)
    - Adds request ID to response headers
    """

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        # Skip logging for health checks to reduce noise
        is_silent = request.url.path in SILENT_PATHS

        # Get or generate request ID. Honor an incoming header only when it
        # matches the safe pattern — otherwise fall through to a fresh UUID.
        # This prevents log-injection / Sentry-tag pollution from forged
        # headers when something bypasses API-side validation.
        incoming = request.headers.get(REQUEST_ID_HEADER)
        if incoming and _REQUEST_ID_PATTERN.match(incoming):
            request_id = incoming
        else:
            request_id = str(uuid.uuid4())

        # Bind context for all logs in this request
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(
            request_id=request_id,
            method=request.method,
            path=request.url.path,
        )

        # Log request start
        start_time = time.perf_counter()
        if not is_silent:
            logger.info(
                "request_started",
                query=str(request.query_params) if request.query_params else None,
            )

        try:
            # Process request
            response = await call_next(request)

            # Calculate duration
            duration_ms = int((time.perf_counter() - start_time) * 1000)

            # Log request completion
            if not is_silent:
                logger.info(
                    "request_completed",
                    status_code=response.status_code,
                    duration_ms=duration_ms,
                )

            # Add request ID to response headers
            response.headers[REQUEST_ID_HEADER] = request_id

            return response

        except Exception as e:
            # Log request failure (always log errors, even for health checks)
            duration_ms = int((time.perf_counter() - start_time) * 1000)
            logger.error(
                "request_failed",
                error=str(e),
                error_type=type(e).__name__,
                duration_ms=duration_ms,
            )
            raise

        finally:
            # Clean up context
            structlog.contextvars.clear_contextvars()


def add_request_context_middleware(app) -> None:
    """Add request context middleware to a FastAPI app."""
    app.add_middleware(RequestContextMiddleware)


def suppress_health_check_logs() -> None:
    """Add filter to suppress health check access logs from uvicorn."""
    logging.getLogger("uvicorn.access").addFilter(HealthCheckFilter())
