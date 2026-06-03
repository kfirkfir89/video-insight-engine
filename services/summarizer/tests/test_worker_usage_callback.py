"""Regression tests for worker LLM-usage callback wiring (FINDING W7).

The standalone RabbitMQ worker bypasses the FastAPI lifespan that registers
``MongoDBUsageCallback``, so without explicit wiring the entire queue path drops
``llm_usage`` rows (including transcription spend). These tests assert the worker
bootstrap registers the callback with litellm and the process-wide active buffer,
mirroring the app, and stays defensive when setup fails.
"""

from __future__ import annotations

from unittest.mock import MagicMock

import litellm

import llm_common.callback as cb
from llm_common import MongoDBUsageCallback
from src.worker import __main__ as entry


def _patch_mongo(monkeypatch: object) -> None:
    """Make get_mongo_client return a fake client with a dict-like database."""
    fake_db: dict[str, MagicMock] = {
        "llm_usage": MagicMock(),
        "llm_alerts": MagicMock(),
    }
    fake_client = MagicMock()
    fake_client.get_default_database.return_value = fake_db
    monkeypatch.setattr(
        "src.dependencies.get_mongo_client", lambda: fake_client
    )


class TestSetupUsageCallback:
    def test_registers_callback_with_litellm_when_mongo_available(
        self, monkeypatch
    ) -> None:
        monkeypatch.setattr(litellm, "callbacks", [], raising=False)
        _patch_mongo(monkeypatch)

        callback = entry._setup_usage_callback()

        assert isinstance(callback, MongoDBUsageCallback)
        assert callback in litellm.callbacks

    def test_registers_active_buffer_for_manual_emits(self, monkeypatch) -> None:
        monkeypatch.setattr(litellm, "callbacks", [], raising=False)
        monkeypatch.setattr(cb, "_active_buffer", None, raising=False)
        _patch_mongo(monkeypatch)

        entry._setup_usage_callback()

        # Constructing MongoDBUsageCallback registers the process-wide buffer that
        # record_manual_usage (transcription) writes into.
        assert cb._active_buffer is not None

    def test_returns_none_and_does_not_raise_when_mongo_fails(
        self, monkeypatch
    ) -> None:
        def _boom() -> None:
            raise RuntimeError("mongo down")

        monkeypatch.setattr(litellm, "callbacks", [], raising=False)
        monkeypatch.setattr("src.dependencies.get_mongo_client", _boom)

        # Must not propagate — a tracking-setup failure cannot crash the worker.
        result = entry._setup_usage_callback()

        assert result is None


class TestShutdownUsageCallback:
    def test_flushes_sync_buffer_on_shutdown(self) -> None:
        callback = MagicMock()

        entry._shutdown_usage_callback(callback)

        callback.shutdown_sync.assert_called_once()

    def test_noop_when_callback_is_none(self) -> None:
        # No callback registered (e.g. llm_common missing) — must be a safe no-op.
        entry._shutdown_usage_callback(None)

    def test_does_not_raise_when_flush_fails(self) -> None:
        callback = MagicMock()
        callback.shutdown_sync.side_effect = RuntimeError("flush failed")

        # Best-effort cleanup must swallow the error.
        entry._shutdown_usage_callback(callback)
