"""Verify the assistant wires the shared Sentry initializer correctly.

The kwargs derivation lives in ``llm_common.sentry_init.init_sentry_from_settings``
(covered by ``packages/llm-common/tests/test_sentry_init.py``). Here we just
verify the assistant's lifespan delegates to it with the right service tag.
"""

from __future__ import annotations

from unittest.mock import patch


def test_assistant_init_helper_delegates_to_shared_init():
    from src import server as assistant_server

    with patch.object(
        assistant_server, "init_sentry_from_settings", return_value=True,
    ) as init_mock:
        assistant_server._init_sentry_from_settings()  # noqa: SLF001

        init_mock.assert_called_once_with(
            assistant_server.settings,
            service="vie-assistant",
        )
