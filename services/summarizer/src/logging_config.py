"""Structured logging configuration using structlog.

Provides:
- JSON logging in production (LOG_FORMAT=json)
- Human-readable console logging in development (default)
- Request ID binding for tracing
- Contextual logging with automatic timestamps
"""

import logging
import sys
from typing import Any

import structlog
from structlog.types import Processor

from src.config import settings


def get_log_level() -> int:
    """Get log level from settings."""
    level = getattr(settings, "log_level", "INFO").upper()
    return getattr(logging, level, logging.INFO)


def configure_structlog(json_format: bool = False) -> None:
    """
    Configure structlog for the application.

    Args:
        json_format: If True, use JSON output. Otherwise, use colored console output.
    """
    # Shared processors for all formats
    shared_processors: list[Processor] = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.UnicodeDecoder(),
    ]

    if json_format:
        # Production: JSON logging
        processors: list[Processor] = [
            *shared_processors,
            structlog.processors.format_exc_info,
            structlog.processors.JSONRenderer(),
        ]
        factory = structlog.PrintLoggerFactory()
    else:
        # Development: colored console output
        processors = [
            *shared_processors,
            structlog.dev.ConsoleRenderer(colors=True),
        ]
        factory = structlog.PrintLoggerFactory()

    structlog.configure(
        processors=processors,
        wrapper_class=structlog.make_filtering_bound_logger(get_log_level()),
        context_class=dict,
        logger_factory=factory,
        cache_logger_on_first_use=True,
    )

    # Also configure standard library logging to use structlog
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=get_log_level(),
    )

    # Suppress noisy loggers
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("litellm").setLevel(logging.WARNING)
    logging.getLogger("LiteLLM").setLevel(logging.WARNING)
    logging.getLogger("pymongo").setLevel(logging.WARNING)
    logging.getLogger("botocore").setLevel(logging.WARNING)
    logging.getLogger("boto3").setLevel(logging.WARNING)
    logging.getLogger("s3transfer").setLevel(logging.WARNING)
    logging.getLogger("aiobotocore").setLevel(logging.WARNING)
    logging.getLogger("yt_dlp").setLevel(logging.WARNING)
    logging.getLogger("urllib3").setLevel(logging.WARNING)
    logging.getLogger("openai").setLevel(logging.WARNING)
    logging.getLogger("openai._base_client").setLevel(logging.WARNING)
    logging.getLogger("google").setLevel(logging.WARNING)
    logging.getLogger("google.auth").setLevel(logging.WARNING)
    logging.getLogger("google.auth.transport").setLevel(logging.WARNING)


def get_logger(name: str | None = None) -> structlog.stdlib.BoundLogger:
    """
    Get a structured logger.

    Args:
        name: Logger name. If None, uses the caller's module name.

    Returns:
        A bound structlog logger.
    """
    return structlog.get_logger(name)


def bind_request_context(**kwargs: Any) -> None:
    """
    Bind context variables for the current request.

    Common usage:
        bind_request_context(request_id="abc123", user_id="user456")

    These values will be included in all subsequent log messages
    for the current async context.
    """
    structlog.contextvars.bind_contextvars(**kwargs)


def clear_request_context() -> None:
    """Clear all bound context variables."""
    structlog.contextvars.clear_contextvars()
