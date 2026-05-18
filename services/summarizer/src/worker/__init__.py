"""RabbitMQ-driven worker for the video summarization pipeline.

Public surface:
- ``VideoJobPayload``: Pydantic model mirroring the API's Zod schema.
- ``QueueTopology``: declared topology constants, in sync with the API side.
- ``WorkerRunner`` + ``JobOutcome``: pure async runner with retry/DLQ semantics.
"""

from src.worker.payload import VideoJobPayload, ProviderConfig
from src.worker.topology import QueueTopology, queue_arguments
from src.worker.runner import WorkerRunner, JobOutcome

__all__ = [
    "VideoJobPayload",
    "ProviderConfig",
    "QueueTopology",
    "queue_arguments",
    "WorkerRunner",
    "JobOutcome",
]
