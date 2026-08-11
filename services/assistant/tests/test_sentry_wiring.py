"""Verify the assistant wires the shared Sentry initializer correctly.

The kwargs derivation lives in ``llm_common.sentry_init.init_sentry_from_settings``
(covered by ``packages/llm-common/tests/test_sentry_init.py``). Here we just
verify the assistant's lifespan (src.bootstrap) delegates to it with the right service tag.
"""

from __future__ import annotations

from unittest.mock import patch


def test_assistant_init_helper_delegates_to_shared_init():
    from src import bootstrap as assistant_bootstrap

    with patch.object(
        assistant_bootstrap,
        "init_sentry_from_settings",
        return_value=True,
    ) as init_mock:
        assistant_bootstrap._init_sentry_from_settings()  # noqa: SLF001

        init_mock.assert_called_once_with(
            assistant_bootstrap.settings,
            service="vie-assistant",
        )
