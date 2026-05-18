"""Anchor for new worker-related settings in src/config.py."""

from __future__ import annotations


def test_worker_settings_exist_with_sensible_defaults() -> None:
    from src.config import settings

    assert hasattr(settings, "RABBITMQ_URL")
    assert hasattr(settings, "WORKER_CONCURRENCY")
    assert hasattr(settings, "WORKER_MAX_RETRIES")
    assert hasattr(settings, "WORKER_PREFETCH")
    assert settings.WORKER_CONCURRENCY >= 1
    assert settings.WORKER_MAX_RETRIES >= 1
