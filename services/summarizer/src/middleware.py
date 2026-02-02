"""FastAPI middleware for request tracking and logging.

Provides:
- Request ID generation and propagation
- Request/response logging with timing
- Context binding for structured logs
"""

import time
import uuid
from typing import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from src.logging_config import bind_request_context, clear_request_context, get_logger

logger = get_logger(__name__)

# Header name for request ID (can be provided by client or generated)
REQUEST_ID_HEADER = "X-Request-ID"


class RequestContextMiddleware(BaseHTTPMiddleware):
    """
    Middleware that adds request ID and logging context to each request.

    Features:
    - Generates unique request ID if not provided
    - Binds request context for structured logging
    - Logs request start/end with timing
    - Adds request ID to response headers
    """

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Response],
    ) -> Response:
        # Get or generate request ID
        request_id = request.headers.get(REQUEST_ID_HEADER) or str(uuid.uuid4())[:8]

        # Bind context for all logs in this request
        clear_request_context()
        bind_request_context(
            request_id=request_id,
            method=request.method,
            path=request.url.path,
        )

        # Log request start
        start_time = time.perf_counter()
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
            logger.info(
                "request_completed",
                status_code=response.status_code,
                duration_ms=duration_ms,
            )

            # Add request ID to response headers
            response.headers[REQUEST_ID_HEADER] = request_id

            return response

        except Exception as e:
            # Log request failure
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
            clear_request_context()


def add_request_context_middleware(app) -> None:
    """Add request context middleware to a FastAPI app."""
    app.add_middleware(RequestContextMiddleware)
