"""Verify the summarizer wires the shared Sentry initializer correctly.

We don't need to exercise the live SDK — ``llm_common.sentry_init`` carries
its own coverage of kwargs derivation. Here we just verify the *integration*:
the summarizer's lifespan and the worker entrypoint both delegate to the
shared ``init_sentry_from_settings`` with the right service tag.
"""

from __future__ import annotations

from unittest.mock import patch


def test_lifespan_delegates_to_shared_init_with_summarizer_service():
    from src import main as summarizer_main

    with patch.object(
        summarizer_main, "init_sentry_from_settings", return_value=True,
    ) as init_mock:
        summarizer_main._init_sentry_from_settings()  # noqa: SLF001

        init_mock.assert_called_once_with(
            summarizer_main.settings,
            service="vie-summarizer",
        )


def test_worker_delegates_to_shared_init_with_fastapi_disabled():
    # The worker process has no FastAPI app — integration must be disabled
    # so the SDK doesn't try to install Starlette middleware.
    from src.worker import sentry_bootstrap

    with patch.object(
        sentry_bootstrap, "init_sentry_from_settings", return_value=True,
    ) as init_mock:
        sentry_bootstrap.init_sentry_for_worker()

        init_mock.assert_called_once_with(
            sentry_bootstrap.settings,
            service="vie-summarizer-worker",
            integrate_fastapi=False,
        )
