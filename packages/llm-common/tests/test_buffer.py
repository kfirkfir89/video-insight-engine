"""Tests for llm_common.buffer — write batching."""

import asyncio
from unittest.mock import MagicMock, AsyncMock

import pytest

from llm_common.buffer import SyncBuffer, AsyncBuffer, FLUSH_BATCH_SIZE


class TestSyncBuffer:
    def test_add_and_flush(self):
        mock_col = MagicMock()
        buf = SyncBuffer(mock_col)
        buf.add({"model": "test"})
        buf.flush()
        mock_col.insert_many.assert_called_once()
        args = mock_col.insert_many.call_args[0][0]
        assert len(args) == 1
        assert args[0]["model"] == "test"
        buf.shutdown()

    def test_empty_flush(self):
        mock_col = MagicMock()
        buf = SyncBuffer(mock_col)
        buf.flush()
        mock_col.insert_many.assert_not_called()
        buf.shutdown()

    def test_auto_flush_on_batch_size(self):
        mock_col = MagicMock()
        buf = SyncBuffer(mock_col)
        for i in range(FLUSH_BATCH_SIZE):
            buf.add({"i": i})
        mock_col.insert_many.assert_called_once()
        args = mock_col.insert_many.call_args[0][0]
        assert len(args) == FLUSH_BATCH_SIZE
        buf.shutdown()

    def test_shutdown_flushes_remaining(self):
        mock_col = MagicMock()
        buf = SyncBuffer(mock_col)
        buf.add({"model": "leftover"})
        buf.shutdown()
        mock_col.insert_many.assert_called()

    def test_flush_handles_error(self):
        mock_col = MagicMock()
        mock_col.insert_many.side_effect = Exception("db error")
        buf = SyncBuffer(mock_col)
        buf.add({"model": "test"})
        buf.flush()  # Should not raise
        buf.shutdown()


class TestAsyncBuffer:
    @pytest.mark.asyncio
    async def test_add_and_flush(self):
        mock_col = AsyncMock()
        buf = AsyncBuffer(mock_col)
        await buf.add({"model": "test"})
        await buf.flush()
        mock_col.insert_many.assert_called_once()
        await buf.shutdown()

    @pytest.mark.asyncio
    async def test_empty_flush(self):
        mock_col = AsyncMock()
        buf = AsyncBuffer(mock_col)
        await buf.flush()
        mock_col.insert_many.assert_not_called()
        await buf.shutdown()

    @pytest.mark.asyncio
    async def test_auto_flush_on_batch_size(self):
        mock_col = AsyncMock()
        buf = AsyncBuffer(mock_col)
        for i in range(FLUSH_BATCH_SIZE):
            await buf.add({"i": i})
        mock_col.insert_many.assert_called_once()
        await buf.shutdown()

    @pytest.mark.asyncio
    async def test_shutdown_flushes_remaining(self):
        mock_col = AsyncMock()
        buf = AsyncBuffer(mock_col)
        await buf.add({"model": "leftover"})
        await buf.shutdown()
        mock_col.insert_many.assert_called()
