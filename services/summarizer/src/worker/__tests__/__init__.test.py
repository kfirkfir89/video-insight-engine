"""Anchor for the worker package init re-exports."""

from __future__ import annotations


def test_package_reexports_public_api() -> None:
    from src.worker import (
        VideoJobPayload,
        ProviderConfig,
        QueueTopology,
        queue_arguments,
        WorkerRunner,
        JobOutcome,
    )

    assert VideoJobPayload is not None
    assert ProviderConfig is not None
    assert QueueTopology.exchange == "vie.pipeline"
    assert queue_arguments()["x-max-priority"] == 10
    assert WorkerRunner is not None
    assert JobOutcome.SUCCESS.value == "success"
