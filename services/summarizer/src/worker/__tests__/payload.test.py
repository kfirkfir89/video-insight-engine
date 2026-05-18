"""Co-located test stub for payload — full tests live in tests/test_worker_payload.py."""

from __future__ import annotations


def test_payload_module_imports() -> None:
    from src.worker.payload import VideoJobPayload, ProviderConfig

    assert VideoJobPayload is not None
    assert ProviderConfig is not None
