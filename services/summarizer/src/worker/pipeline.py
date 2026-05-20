"""Pipeline driver for the worker.

Extracted from ``__main__.py`` so it can be unit-tested without dragging in
``aio_pika`` (which only the consumer loop needs). The function reuses the
exact codepath the SSE handler uses, so frontend SSE consumers attach as
followers regardless of which path started the work.
"""

from __future__ import annotations

import asyncio
import os
import uuid

import redis.exceptions as redis_exceptions

from src.dependencies import (
    create_llm_provider,
    get_llm_provider,
    get_mongo_client,
)
from src.logging_config import get_logger
from src.models.schemas import ProviderConfig as ServiceProviderConfig
from src.repositories.mongodb_repository import MongoDBVideoRepository
from src.services.cache.pipeline_event_stream import pipeline_event_stream
from src.services.llm import LLMService
from src.services.override_state import clear_override
from src.worker.payload import VideoJobPayload

logger = get_logger(__name__)


async def drive_pipeline(payload: VideoJobPayload) -> None:
    """Acquire the per-video lock and run the SSE pipeline producer.

    If the lock is already held (e.g. an SSE producer started first), this job
    is a no-op — the existing producer will finish it.
    """
    # Import here to keep cold-start fast and avoid circular imports.
    from src.routes.pipeline_broker import produce_to_broker

    # FastAPI's Depends() doesn't run outside HTTP requests, so build the
    # repository + LLM service directly. Using the cached mongo client /
    # provider keeps us aligned with the HTTP path's behaviour.
    database = get_mongo_client().get_default_database()
    repository = MongoDBVideoRepository(database)
    if payload.providers is not None:
        # The worker payload's ProviderConfig has the same shape as the
        # service-side schema but they're distinct classes; convert through
        # model_dump so create_llm_provider's type contract holds.
        schema_providers = ServiceProviderConfig.model_validate(
            payload.providers.model_dump(),
        )
        provider = create_llm_provider(schema_providers)
    else:
        provider = get_llm_provider()
    llm_service = LLMService(provider)

    entry = await asyncio.to_thread(
        repository.get_video_summary, payload.video_summary_id,
    )
    if entry is None:
        # Mongo row vanished after publish — surface to DLQ rather than spin
        # forever. Could happen if a user deleted their submission mid-flight.
        raise RuntimeError(f"video_summary not found: {payload.video_summary_id}")

    owner = f"worker-{os.getpid()}-{uuid.uuid4().hex[:8]}"
    try:
        acquired = await pipeline_event_stream.acquire_lock(payload.video_summary_id, owner)
    except (OSError, redis_exceptions.RedisError) as e:
        # Redis outage → treat as transient; the runner will republish.
        raise RuntimeError(f"redis_unreachable: {e}") from e

    if not acquired:
        logger.info("worker_skip_locked videoSummaryId=%s", payload.video_summary_id)
        return  # Treated as success — another producer is already running it.

    try:
        await produce_to_broker(
            payload.video_summary_id,
            entry,
            repository,
            llm_service,
            owner,
        )
    finally:
        await asyncio.to_thread(clear_override, payload.video_summary_id)
