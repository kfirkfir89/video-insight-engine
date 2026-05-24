"""Structured logging configuration using structlog.

Provides:
- JSON logging in production (LOG_FORMAT=json)
- Human-readable console logging in development (default)
- Request ID binding for tracing
- Contextual logging with automatic timestamps
"""

from __future__ import annotations

import logging
import sys
from typing import Any

import structlog
from structlog.types import Processor

from src.config import settings

try:
    from llm_common.middleware import HealthCheckFilter as _HealthCheckFilter
except ImportError:

    class _HealthCheckFilter(logging.Filter):  # type: ignore[no-redef]
        """Fallback filter when llm_common is not installed."""

        def filter(self, record: logging.LogRecord) -> bool:
            msg = record.getMessage()
            return "/health" not in msg


def get_log_level() -> int:
    """Get log level from settings."""
    level = settings.LOG_LEVEL.upper()
    return getattr(logging, level, logging.INFO)


def _add_service_processor(service_name: str) -> Processor:
    """Return a structlog processor that stamps every log line with `service`."""
    from structlog.types import EventDict

    def _processor(_logger: Any, _method_name: str, event_dict: EventDict) -> EventDict:
        event_dict.setdefault("service", service_name)
        return event_dict

    return _processor


def configure_structlog(json_format: bool = False, service_name: str = "vie-assistant") -> None:
    """Configure structlog for the application.

    Args:
        json_format: If True, use JSON output. Otherwise, use colored console output.
        service_name: Stamped on every log line as ``service`` so log
            aggregators can filter cross-service traffic by source.
    """
    shared_processors: list[Processor] = [
        _add_service_processor(service_name),
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.UnicodeDecoder(),
    ]

    if json_format:
        processors: list[Processor] = [
            *shared_processors,
            structlog.processors.format_exc_info,
            structlog.processors.JSONRenderer(),
        ]
    else:
        processors = [
            *shared_processors,
            structlog.dev.ConsoleRenderer(colors=True),
        ]

    structlog.configure(
        processors=processors,
        wrapper_class=structlog.make_filtering_bound_logger(get_log_level()),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )

    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=get_log_level(),
    )

    # Suppress uvicorn access logs for health checks
    logging.getLogger("uvicorn.access").addFilter(_HealthCheckFilter())

    # Suppress noisy loggers
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("litellm").setLevel(logging.WARNING)
    logging.getLogger("LiteLLM").setLevel(logging.WARNING)
    logging.getLogger("pymongo").setLevel(logging.WARNING)
    logging.getLogger("sentence_transformers").setLevel(logging.WARNING)
    logging.getLogger("qdrant_client").setLevel(logging.WARNING)
    logging.getLogger("openai").setLevel(logging.WARNING)
    logging.getLogger("urllib3").setLevel(logging.WARNING)


def get_logger(name: str | None = None) -> structlog.stdlib.BoundLogger:
    """Get a structured logger.

    Args:
        name: Logger name. If None, uses the caller's module name.

    Returns:
        A bound structlog logger.
    """
    return structlog.get_logger(name)


def bind_request_context(**kwargs: Any) -> None:
    """Bind context variables for the current request.

    These values will be included in all subsequent log messages
    for the current async context.
    """
    structlog.contextvars.bind_contextvars(**kwargs)


def clear_request_context() -> None:
    """Clear all bound context variables."""
    structlog.contextvars.clear_contextvars()
