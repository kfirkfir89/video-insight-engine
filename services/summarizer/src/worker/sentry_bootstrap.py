"""Shared Sentry bootstrap for the summarizer worker entrypoint.

Lives next to ``__main__.py`` so the worker loop and the lifespan share the
same init path: same settings keys, same service tag prefix. Pulled out into
its own module so unit tests can patch ``init_sentry`` without importing
``aio_pika`` (which only the loop needs).
"""

from __future__ import annotations

from llm_common.sentry_init import init_sentry_from_settings

from src.config import settings


def init_sentry_for_worker() -> bool:
    """Initialize Sentry for the worker process.

    Returns ``True`` when the SDK was actually started, ``False`` when the DSN
    is empty (dev/CI) or sentry-sdk isn't installed. FastAPI integration is
    disabled — the worker has no app to attach Starlette middleware to.
    """
    return init_sentry_from_settings(
        settings,
        service="vie-summarizer-worker",
        integrate_fastapi=False,
    )
