"""Langfuse observability client for the assistant service.

Same design as the summarizer's :mod:`src.services.observability.langfuse_client`:
no-op when keys are missing, never raises, never blocks. The assistant adds
two assistant-specific concepts:

- :func:`session_trace` — opens a trace per chat session keyed by ``userId``
  and ``videoId``. Tool calls and LLM streams attach as child spans.
- :func:`span` — generic child span used by tool-router to wrap individual
  tool executions (e.g., ``concept_explain``, ``quiz_generator``).
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
import re
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from contextvars import ContextVar
from typing import Any, Protocol

from src.config import settings

logger = logging.getLogger(__name__)

try:  # pragma: no cover — exercised by integration runtime
    from langfuse import Langfuse  # type: ignore
except ImportError:
    Langfuse = None  # type: ignore[assignment,misc]


class _LangfuseClient(Protocol):
    """Structural type for the subset of Langfuse we call. Mirrors the
    summarizer's client; see that module for the rationale on using a
    Protocol instead of ``Any`` with a lazy import.
    """

    def trace(self, **kwargs: Any) -> Any: ...
    def get_prompt(self, name: str) -> Any: ...
    def flush(self) -> None: ...


# ─── Module state ───────────────────────────────────────────────────────
_client: _LangfuseClient | None = None
_current_trace: ContextVar[Any | None] = ContextVar(
    "assistant_langfuse_current_trace",
    default=None,
)


# Mirror of the summarizer-side redaction model. See
# ``services/summarizer/src/services/observability/langfuse_client.py`` for
# the rationale on which patterns we redact and what we deliberately don't.
_EMAIL_RE = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")
_PHONE_RE = re.compile(r"\+?\d[\d\s\-().]{8,}\d")
_JWT_RE = re.compile(r"eyJ[A-Za-z0-9_\-]{8,}\.[A-Za-z0-9_\-]{8,}\.[A-Za-z0-9_\-]{8,}")
_AWS_KEY_RE = re.compile(r"\b(?:AKIA|ASIA|AGPA|AROA|AIDA)[A-Z0-9]{16}\b")
_ANTHROPIC_KEY_RE = re.compile(r"sk-ant-[A-Za-z0-9_\-]{20,}")
_OPENAI_KEY_RE = re.compile(r"sk-(?!ant-)[A-Za-z0-9_\-]{20,}")
_GITHUB_TOKEN_RE = re.compile(r"\bgh[pousr]_[A-Za-z0-9]{20,}\b")
_GOOGLE_API_KEY_RE = re.compile(r"\bAIza[0-9A-Za-z_\-]{35}\b")
_SLACK_TOKEN_RE = re.compile(r"\bxox[abprs]-[A-Za-z0-9\-]{10,}\b")
_STRIPE_LIVE_RE = re.compile(r"\b(?:sk|rk|pk)_live_[A-Za-z0-9]{16,}\b")
_PEM_BLOCK_RE = re.compile(
    r"-----BEGIN [A-Z ]+PRIVATE KEY-----[\s\S]+?-----END [A-Z ]+PRIVATE KEY-----",
)
_BEARER_RE = re.compile(r"(?i)\bBearer\s+[A-Za-z0-9._\-]{8,}")
_REDACTED = "[REDACTED]"

_SECRET_PATTERNS: tuple[re.Pattern[str], ...] = (
    _PEM_BLOCK_RE,
    _ANTHROPIC_KEY_RE,
    _OPENAI_KEY_RE,
    _STRIPE_LIVE_RE,
    _AWS_KEY_RE,
    _GITHUB_TOKEN_RE,
    _GOOGLE_API_KEY_RE,
    _SLACK_TOKEN_RE,
    _JWT_RE,
    _BEARER_RE,
)

_MAX_PAYLOAD_BYTES = 50_000
_TRUNCATED_SUFFIX = "\n\n[TRUNCATED]"


def redact_pii(text: str | None) -> str:
    if not text:
        return ""
    for pattern in _SECRET_PATTERNS:
        text = pattern.sub(_REDACTED, text)
    text = _EMAIL_RE.sub(_REDACTED, text)
    text = _PHONE_RE.sub(_REDACTED, text)
    return text


def truncate_payload(text: str | None, max_bytes: int = _MAX_PAYLOAD_BYTES) -> str:
    if not text:
        return ""
    if len(text) <= max_bytes:
        return text
    return text[:max_bytes] + _TRUNCATED_SUFFIX


# See summarizer-side comment on the depth cap.
_REDACT_MAX_DEPTH = 16


def _redact_block(block: Any, _depth: int = 0) -> Any:
    """Recursively redact text inside Anthropic-style structured content.

    Bounded by ``_REDACT_MAX_DEPTH`` so a pathologically nested payload
    can't burn CPU during sanitization.
    """
    if _depth >= _REDACT_MAX_DEPTH:
        return "[REDACTED:depth]"
    if isinstance(block, str):
        return truncate_payload(redact_pii(block))
    if isinstance(block, dict):
        out: dict[str, Any] = {}
        for key, value in block.items():
            if key == "text" and isinstance(value, str):
                out[key] = truncate_payload(redact_pii(value))
            elif isinstance(value, (dict, list)):
                out[key] = _redact_block(value, _depth + 1)
            else:
                out[key] = value
        return out
    if isinstance(block, list):
        return [_redact_block(item, _depth + 1) for item in block]
    return block


def _sanitize_messages(messages: list[Any]) -> list[Any]:
    out: list[Any] = []
    for msg in messages:
        if not isinstance(msg, dict):
            out.append(msg)
            continue
        content = msg.get("content", "")
        if isinstance(content, str):
            out.append({**msg, "content": truncate_payload(redact_pii(content))})
        elif isinstance(content, list):
            out.append({**msg, "content": _redact_block(content)})
        else:
            out.append(msg)
    return out


def _normalize_input(payload: Any) -> Any:
    if isinstance(payload, str):
        return truncate_payload(redact_pii(payload))
    if isinstance(payload, list):
        return _sanitize_messages(payload)
    return payload


def init_langfuse() -> Any | None:
    """Initialize the Langfuse client. Returns ``None`` when disabled."""
    global _client
    if _client is not None:
        return _client
    if Langfuse is None:
        logger.info("Langfuse SDK not installed — observability disabled")
        return None
    public = getattr(settings, "LANGFUSE_PUBLIC_KEY", None)
    secret = getattr(settings, "LANGFUSE_SECRET_KEY", None)
    if not public or not secret:
        logger.info("Langfuse keys not set — observability disabled")
        return None
    host = getattr(settings, "LANGFUSE_BASE_URL", "https://cloud.langfuse.com")
    try:
        _client = Langfuse(public_key=public, secret_key=secret, host=host)
        logger.info("Langfuse initialized (host=%s)", host)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Langfuse init failed (%s) — observability disabled", exc)
        _client = None
    mode = (getattr(settings, "LANGFUSE_USER_ID_MODE", "identity") or "identity").lower()
    salt = getattr(settings, "LANGFUSE_USER_ID_HASH_SALT", "") or ""
    if mode == "hash" and not salt:
        logger.warning(
            "LANGFUSE_USER_ID_MODE=hash but LANGFUSE_USER_ID_HASH_SALT is empty — "
            "hashed user ids are trivially precomputable from a small id space",
        )
    return _client


def _resolve_user_id_for_trace(user_id: str | None) -> str | None:
    """Apply ``LANGFUSE_USER_ID_MODE`` policy before forwarding to the SDK.

    Mirrors the summarizer implementation so an "omit" or "hash" policy
    set in the env stays consistent across both services.
    """
    if not user_id:
        return None
    mode = (getattr(settings, "LANGFUSE_USER_ID_MODE", "identity") or "identity").lower()
    if mode == "omit":
        return None
    if mode != "hash":
        return user_id
    salt = getattr(settings, "LANGFUSE_USER_ID_HASH_SALT", "") or ""
    digest = hashlib.sha256(f"{salt}::{user_id}".encode()).hexdigest()
    return digest[:16]


def is_enabled() -> bool:
    return _client is not None


async def flush_langfuse() -> None:
    client = _client
    if client is None:
        return
    try:
        await asyncio.to_thread(client.flush)
    except Exception as exc:  # noqa: BLE001
        logger.debug("Langfuse flush failed: %s", exc)


def _reset_for_tests() -> None:
    global _client
    _client = None


def get_current_trace() -> Any | None:
    return _current_trace.get()


@asynccontextmanager
async def session_trace(
    *,
    video_id: str,
    user_id: str | None = None,
    session_id: str | None = None,
    tags: list[str] | None = None,
    metadata: dict[str, Any] | None = None,
) -> AsyncIterator[Any]:
    """Open a trace for a single chat session.

    Yields the trace handle (or ``None`` when disabled). On exit, flushes the
    SDK buffer best-effort.
    """
    client = _client
    if client is None:
        yield None
        return

    base_tags = [f"videoId:{video_id}"]
    if user_id:
        base_tags.append(f"userId:{user_id}")
    if tags:
        base_tags.extend(tags)

    try:
        trace = client.trace(
            name=f"chat:{video_id}",
            user_id=_resolve_user_id_for_trace(user_id),
            session_id=session_id,
            tags=base_tags,
            metadata=metadata or {},
            input={"videoId": video_id},
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("Langfuse trace create failed: %s", exc)
        yield None
        return

    token = _current_trace.set(trace)
    try:
        yield trace
    finally:
        _current_trace.reset(token)
        await flush_langfuse()


@asynccontextmanager
async def span(
    name: str,
    *,
    metadata: dict[str, Any] | None = None,
) -> AsyncIterator[Any]:
    """Child span attached to the current session trace.

    Used by the tool router to wrap individual tool executions. Yields the
    span handle (or ``None`` when no trace is active). Updates the span's
    end_time on exit so latency is recorded.
    """
    trace = _current_trace.get()
    if trace is None:
        yield None
        return
    try:
        s = trace.span(name=name, metadata=metadata or {})
    except Exception as exc:  # noqa: BLE001
        logger.debug("Langfuse span create failed (name=%s): %s", name, exc)
        yield None
        return
    try:
        yield s
    finally:
        try:
            s.end()
        except Exception as exc:  # noqa: BLE001
            logger.debug("Langfuse span end failed (name=%s): %s", name, exc)


def log_generation(
    *,
    name: str,
    model: str,
    input_payload: Any,
    output_payload: str = "",
    input_tokens: int = 0,
    output_tokens: int = 0,
    cost_usd: float = 0.0,
    latency_ms: int = 0,
    metadata: dict[str, Any] | None = None,
) -> None:
    trace = _current_trace.get()
    if trace is None:
        return
    enriched_metadata: dict[str, Any] = {**(metadata or {}), "latencyMs": latency_ms}
    try:
        trace.generation(
            name=name,
            model=model,
            input=_normalize_input(input_payload),
            output=truncate_payload(output_payload),
            usage={
                "input": input_tokens,
                "output": output_tokens,
                "total": input_tokens + output_tokens,
                "unit": "TOKENS",
                "totalCost": cost_usd,
            },
            metadata=enriched_metadata,
        )
    except Exception as exc:  # noqa: BLE001
        logger.debug("Langfuse generation log failed (name=%s): %s", name, exc)
