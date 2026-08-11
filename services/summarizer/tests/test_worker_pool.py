"""Tests for worker pool utility."""

import asyncio
import pytest

from src.utils.worker_pool import run_in_pool, shutdown_pool


def _cpu_bound_add(a: int, b: int) -> int:
    """Simple CPU-bound function for testing."""
    return a + b


def _cpu_bound_multiply(x: int) -> int:
    """Another simple function."""
    return x * 2


class TestRunInPool:
    """Test run_in_pool function."""

    @pytest.mark.asyncio
    async def test_executes_function(self):
        result = await run_in_pool(_cpu_bound_add, 3, 4)
        assert result == 7

    @pytest.mark.asyncio
    async def test_executes_single_arg(self):
        result = await run_in_pool(_cpu_bound_multiply, 5)
        assert result == 10

    @pytest.mark.asyncio
    async def test_concurrent_execution(self):
        tasks = [run_in_pool(_cpu_bound_add, i, i) for i in range(5)]
        results = await asyncio.gather(*tasks)
        assert results == [0, 2, 4, 6, 8]


class TestShutdownPool:
    """Test shutdown_pool function."""

    def test_shutdown_is_idempotent(self):
        shutdown_pool()
        shutdown_pool()
