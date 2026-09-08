"""Buffered write batching for MongoDB usage records.

Supports two modes:
- Sync mode (summarizer): background thread flushes every 5s or 50 records
- Async mode (assistant/admin): asyncio task flushes periodically

``llm_usage`` is the financial ledger, so a failed flush keeps its rows for the
next attempt instead of dropping them. Retention is bounded by
``MAX_RETAINED_RECORDS`` — during a long Mongo outage the oldest rows are
shed (and counted in the log line) rather than growing memory without limit.

After a failed flush the retained rows exceed ``FLUSH_BATCH_SIZE``, so without
a gate every subsequent ``add()`` would re-run the failing insert inline in the
caller (each blocking for the driver's server-selection timeout). Size-triggered
flushes are therefore suppressed for ``FLUSH_INTERVAL_SECONDS`` after a
failure; the periodic flush keeps retrying on its own cadence.
"""

import asyncio
import atexit
import threading
import time

import structlog

logger = structlog.get_logger(__name__)

FLUSH_INTERVAL_SECONDS = 5
FLUSH_BATCH_SIZE = 50
# Rows kept across failed flushes before the oldest are shed (~10 batches).
MAX_RETAINED_RECORDS = 500


def _retain_after_failure(buffer: list[dict], failed_batch: list[dict], error: Exception) -> float:
    """Put a failed batch back at the head of ``buffer`` (bounded), logging what was shed.

    Returns the monotonic time before which size-triggered flushes should stay
    suppressed.
    """
    combined = failed_batch + buffer
    shed = max(0, len(combined) - MAX_RETAINED_RECORDS)
    buffer[:] = combined[shed:]
    logger.error(
        "buffer_flush_failed",
        error=str(error),
        retained_records=len(buffer),
        dropped_records=shed,
    )
    return time.monotonic() + FLUSH_INTERVAL_SECONDS


def _size_flush_due(buffer: list[dict], retry_after: float) -> bool:
    return len(buffer) >= FLUSH_BATCH_SIZE and time.monotonic() >= retry_after


class SyncBuffer:
    """Thread-safe buffer that flushes to MongoDB via pymongo (sync)."""

    def __init__(self, collection):
        self._collection = collection
        self._buffer: list[dict] = []
        self._lock = threading.Lock()
        self._retry_after = 0.0
        self._running = True
        self._timer: threading.Timer | None = None
        self._start_timer()
        atexit.register(self.shutdown)

    def _start_timer(self) -> None:
        if self._running:
            self._timer = threading.Timer(FLUSH_INTERVAL_SECONDS, self._timed_flush)
            self._timer.daemon = True
            self._timer.start()

    def _timed_flush(self) -> None:
        self.flush()
        self._start_timer()

    def add(self, record: dict) -> None:
        with self._lock:
            self._buffer.append(record)
            if _size_flush_due(self._buffer, self._retry_after):
                self._flush_locked()

    def flush(self) -> None:
        with self._lock:
            self._flush_locked()

    def _flush_locked(self) -> None:
        if not self._buffer:
            return
        batch = self._buffer[:]
        self._buffer.clear()
        try:
            self._collection.insert_many(batch, ordered=False)
            logger.debug("buffer_flushed", count=len(batch))
        except Exception as e:
            self._retry_after = _retain_after_failure(self._buffer, batch, e)

    def shutdown(self) -> None:
        self._running = False
        if self._timer:
            self._timer.cancel()
        self.flush()


class AsyncBuffer:
    """Async buffer that flushes to MongoDB via motor (async)."""

    def __init__(self, collection):
        self._collection = collection
        self._buffer: list[dict] = []
        self._lock = asyncio.Lock()
        self._retry_after = 0.0
        self._task: asyncio.Task | None = None

    async def start(self) -> None:
        self._task = asyncio.create_task(self._periodic_flush())

    async def _periodic_flush(self) -> None:
        while True:
            await asyncio.sleep(FLUSH_INTERVAL_SECONDS)
            await self.flush()

    async def add(self, record: dict) -> None:
        async with self._lock:
            self._buffer.append(record)
            if _size_flush_due(self._buffer, self._retry_after):
                await self._flush_locked()

    async def flush(self) -> None:
        async with self._lock:
            await self._flush_locked()

    async def _flush_locked(self) -> None:
        if not self._buffer:
            return
        batch = self._buffer[:]
        self._buffer.clear()
        try:
            await self._collection.insert_many(batch, ordered=False)
            logger.debug("buffer_flushed", count=len(batch))
        except Exception as e:
            self._retry_after = _retain_after_failure(self._buffer, batch, e)

    async def shutdown(self) -> None:
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        await self.flush()
