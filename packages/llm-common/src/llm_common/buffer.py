"""Buffered write batching for MongoDB usage records.

Supports two modes:
- Sync mode (summarizer): background thread flushes every 5s or 50 records
- Async mode (explainer): asyncio task flushes periodically
"""

import asyncio
import atexit
import threading

import structlog

logger = structlog.get_logger(__name__)

FLUSH_INTERVAL_SECONDS = 5
FLUSH_BATCH_SIZE = 50


class SyncBuffer:
    """Thread-safe buffer that flushes to MongoDB via pymongo (sync)."""

    def __init__(self, collection):
        self._collection = collection
        self._buffer: list[dict] = []
        self._lock = threading.Lock()
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
            if len(self._buffer) >= FLUSH_BATCH_SIZE:
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
            logger.error("buffer_flush_failed", error=str(e), lost_records=len(batch))

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
            if len(self._buffer) >= FLUSH_BATCH_SIZE:
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
            logger.error("buffer_flush_failed", error=str(e), lost_records=len(batch))

    async def shutdown(self) -> None:
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        await self.flush()
