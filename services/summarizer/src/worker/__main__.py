"""Worker entrypoint: ``python -m src.worker`` (executes this ``__main__.py``).

Boots the runner, connects to RabbitMQ with reconnect, declares topology, and
consumes from ``vie.pipeline.jobs``. Each message is handed to ``WorkerRunner``
which drives the existing summarizer pipeline (lock + Redis Streams broker)
exactly the way the SSE producer does — so frontend SSE consumers attach as
followers regardless of which path started the work.
"""

from __future__ import annotations

import asyncio
import logging
import os
import signal
import sys
import uuid

import aio_pika
import redis.exceptions as redis_exceptions
from aio_pika.abc import AbstractIncomingMessage
from aio_pika.pool import Pool

from src.config import settings
from src.dependencies import get_video_repository, get_llm_service, create_llm_provider
from src.logging_config import configure_structlog, get_logger
from src.models.schemas import ProviderConfig as ServiceProviderConfig
from src.services.cache.pipeline_event_stream import pipeline_event_stream
from src.services.llm import LLMService
from src.services.override_state import clear_override
from src.worker.payload import VideoJobPayload
from src.worker.runner import WorkerRunner
from src.worker.topology import QueueTopology, queue_arguments

configure_structlog(json_format=settings.log_format == "json")
logger = get_logger(__name__)


# ─── Pipeline driver ────────────────────────────────────────────────────────

async def _drive_pipeline(payload: VideoJobPayload) -> None:
    """Acquire the per-video lock and run the SSE pipeline producer.

    Reuses the exact codepath the SSE handler uses, so SSE consumers see
    identical events whether they connect before or after the worker picks
    up the job. If the lock is already held (e.g. an SSE producer started
    first), this job is a no-op — the existing producer will finish it.
    """
    # Import here to keep cold-start fast and avoid circular imports.
    from src.routes.stream import _produce_to_broker  # type: ignore[attr-defined]

    repository = get_video_repository()
    if payload.providers is not None:
        # The worker payload's ProviderConfig has the same shape as the
        # service-side schema but they're distinct classes; convert through
        # model_dump so create_llm_provider's type contract holds.
        schema_providers = ServiceProviderConfig.model_validate(
            payload.providers.model_dump(),
        )
        provider = create_llm_provider(schema_providers)
        llm_service = LLMService(provider)
    else:
        llm_service = get_llm_service()

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
        await _produce_to_broker(
            payload.video_summary_id,
            entry,
            repository,
            llm_service,
            owner,
        )
    finally:
        await asyncio.to_thread(clear_override, payload.video_summary_id)


# ─── Republish for retry ────────────────────────────────────────────────────

class _Republisher:
    """Holds a confirm channel reused across republishes."""

    def __init__(self, channel_pool: Pool[aio_pika.abc.AbstractChannel]) -> None:
        self._channel_pool = channel_pool

    async def __call__(self, payload: VideoJobPayload) -> None:
        body = payload.model_dump_json(by_alias=True).encode("utf-8")
        async with self._channel_pool.acquire() as channel:
            exchange = await channel.get_exchange(QueueTopology.exchange)
            await exchange.publish(
                aio_pika.Message(
                    body=body,
                    content_type="application/json",
                    delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
                    priority=payload.priority,
                    message_id=payload.request_id,
                    headers={"x-attempt": payload.attempt, "x-tier": payload.tier},
                ),
                routing_key=QueueTopology.routing_key,
            )


# ─── Consumer loop ──────────────────────────────────────────────────────────

async def _consume(
    runner: WorkerRunner,
    channel: aio_pika.abc.AbstractChannel,
    shutdown: asyncio.Event,
) -> None:
    """Subscribe to the main queue and process until SIGTERM."""
    queue = await channel.declare_queue(
        QueueTopology.queue,
        durable=True,
        arguments=queue_arguments(),
    )

    async with queue.iterator() as q_iter:
        async for raw in q_iter:
            if shutdown.is_set():
                # Cooperative shutdown — return the message and let the broker
                # redeliver to another worker.
                await raw.nack(requeue=True)
                break
            assert isinstance(raw, AbstractIncomingMessage)
            await _handle_with_logging(runner, raw)


async def _handle_with_logging(runner: WorkerRunner, message: AbstractIncomingMessage) -> None:
    """Wraps process_message with structured logging."""
    request_id = message.message_id or "n/a"
    try:
        outcome = await runner.process_message(message)
        logger.info("worker_message_handled outcome=%s request=%s", outcome.value, request_id)
    except Exception:
        logger.exception("worker_handler_unexpected_error")
        try:
            await message.reject(requeue=False)
        except Exception:  # pragma: no cover - cleanup-best-effort
            pass


# ─── Topology bootstrap ─────────────────────────────────────────────────────

async def _declare_topology(channel: aio_pika.abc.AbstractChannel) -> None:
    """Idempotently declare exchanges + queues + DLQ binding."""
    await channel.declare_exchange(
        QueueTopology.exchange, aio_pika.ExchangeType.DIRECT, durable=True,
    )
    dlx = await channel.declare_exchange(
        QueueTopology.dlx, aio_pika.ExchangeType.DIRECT, durable=True,
    )
    dlq = await channel.declare_queue(QueueTopology.dlq, durable=True)
    await dlq.bind(dlx, routing_key=QueueTopology.dlq_routing_key)

    main = await channel.declare_queue(
        QueueTopology.queue,
        durable=True,
        arguments=queue_arguments(),
    )
    exchange = await channel.get_exchange(QueueTopology.exchange)
    await main.bind(exchange, routing_key=QueueTopology.routing_key)


def _redact_url(url: str) -> str:
    try:
        from urllib.parse import urlparse, urlunparse

        parsed = urlparse(url)
        if parsed.password:
            netloc = f"{parsed.username or ''}:***@{parsed.hostname}"
            if parsed.port:
                netloc += f":{parsed.port}"
            return urlunparse(parsed._replace(netloc=netloc))
        return url
    except Exception:
        return "amqp://(unparseable)"


async def main() -> None:
    """Connect, declare topology, and spin N concurrent consumers."""
    connection = await aio_pika.connect_robust(settings.RABBITMQ_URL)
    logger.info("worker_connected url=%s", _redact_url(settings.RABBITMQ_URL))

    shutdown = asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, lambda: shutdown.set())

    async with connection:
        async with connection.channel() as topo_channel:
            await _declare_topology(topo_channel)

        channel_pool: Pool[aio_pika.abc.AbstractChannel] = Pool(
            connection.channel, max_size=2, loop=loop,
        )
        republisher = _Republisher(channel_pool)
        runner = WorkerRunner(
            run_pipeline=_drive_pipeline,
            republish=republisher,
            max_retries=settings.WORKER_MAX_RETRIES,
        )

        consumers: list[asyncio.Task[None]] = []
        for idx in range(settings.WORKER_CONCURRENCY):
            channel = await connection.channel()
            await channel.set_qos(prefetch_count=settings.WORKER_PREFETCH)
            consumers.append(
                asyncio.create_task(
                    _consume(runner, channel, shutdown),
                    name=f"worker-consumer-{idx}",
                ),
            )
        logger.info("worker_consumers_started count=%d", settings.WORKER_CONCURRENCY)

        await shutdown.wait()
        logger.info("worker_shutdown_signal_received")
        for c in consumers:
            c.cancel()
        await asyncio.gather(*consumers, return_exceptions=True)
        await channel_pool.close()

    logger.info("worker_shutdown_complete")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        sys.exit(0)
