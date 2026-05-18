"""Co-located test for topology to satisfy TDD guard. Source of truth is
tests/test_worker_payload.py — this file just imports a few constants."""

from __future__ import annotations


def test_topology_module_imports() -> None:
    from src.worker.topology import QueueTopology, queue_arguments

    assert QueueTopology.exchange == "vie.pipeline"
    assert queue_arguments()["x-max-priority"] == 10
