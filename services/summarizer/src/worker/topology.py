"""RabbitMQ topology constants and queue argument helpers.

Mirrors `api/src/services/queue-topology.ts`. RabbitMQ rejects assertions that
disagree on queue arguments, so any drift between publisher and consumer
surfaces on the first declaration — useful contract enforcement.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class _QueueTopology:
    exchange: str = "vie.pipeline"
    queue: str = "vie.pipeline.jobs"
    routing_key: str = "video.process"
    dlx: str = "vie.pipeline.dlx"
    dlq: str = "vie.pipeline.dlq"
    dlq_routing_key: str = "video.process.dead"


QueueTopology = _QueueTopology()


# Match the API publisher's MAX_PRIORITY + MESSAGE_TTL.
_MAX_PRIORITY = 10
_MESSAGE_TTL_MS = 60 * 60 * 1000


def queue_arguments() -> dict[str, int | str]:
    """Arguments for ``channel.assertQueue`` — must match the publisher exactly."""
    return {
        "x-max-priority": _MAX_PRIORITY,
        "x-message-ttl": _MESSAGE_TTL_MS,
        "x-dead-letter-exchange": QueueTopology.dlx,
        "x-dead-letter-routing-key": QueueTopology.dlq_routing_key,
    }
