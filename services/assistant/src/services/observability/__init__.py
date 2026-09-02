"""LLM observability layer for the assistant service (Langfuse).

Mirrors the summarizer's observability module. Every helper no-ops when
``LANGFUSE_PUBLIC_KEY`` / ``LANGFUSE_SECRET_KEY`` are unset.
"""

from src.services.observability.langfuse_client import (
    flush_langfuse,
    get_current_trace,
    init_langfuse,
    is_enabled,
    log_generation,
    redact_pii,
    session_trace,
    span,
    truncate_payload,
)

__all__ = [
    "flush_langfuse",
    "get_current_trace",
    "init_langfuse",
    "is_enabled",
    "log_generation",
    "redact_pii",
    "session_trace",
    "span",
    "truncate_payload",
]
