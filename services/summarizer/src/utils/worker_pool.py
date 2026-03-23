"""Process pool for CPU-bound tasks (spaCy, TF-IDF, OCR, frame extraction).

Uses ProcessPoolExecutor to avoid blocking the async event loop.
Falls back to asyncio.to_thread if process pool fails (e.g., pickling issues).
"""

import asyncio
import logging
import os
import threading
from concurrent.futures import ProcessPoolExecutor
from typing import Any, Callable

logger = logging.getLogger(__name__)

# One worker per CPU core, capped at 4
MAX_WORKERS = min(os.cpu_count() or 2, 4)

_pool: ProcessPoolExecutor | None = None
_pool_lock = threading.Lock()


def _get_pool() -> ProcessPoolExecutor:
    """Lazy-initialize the process pool (thread-safe)."""
    global _pool
    with _pool_lock:
        if _pool is None:
            _pool = ProcessPoolExecutor(max_workers=MAX_WORKERS)
            logger.info("Initialized process pool with %d workers", MAX_WORKERS)
        return _pool


async def run_in_pool(fn: Callable[..., Any], *args: Any) -> Any:
    """Run a CPU-bound function in the process pool.

    Falls back to asyncio.to_thread if the process pool raises
    a serialization or other error.

    Args:
        fn: Callable to execute (must be picklable).
        *args: Arguments to pass to fn.

    Returns:
        Result of fn(*args).
    """
    loop = asyncio.get_running_loop()
    try:
        return await loop.run_in_executor(_get_pool(), fn, *args)
    except (TypeError, AttributeError, ImportError) as e:
        # Pickling or import error — fall back to thread pool
        logger.warning(
            "Process pool failed for %s: %s — falling back to thread pool",
            fn.__name__, e,
        )
        return await asyncio.to_thread(fn, *args)


def shutdown_pool() -> None:
    """Shutdown the process pool (call during app shutdown)."""
    global _pool
    if _pool is not None:
        _pool.shutdown(wait=True, cancel_futures=True)
        _pool = None
        logger.info("Process pool shut down")
