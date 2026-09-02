"""Tests for llm_common.buffer — write batching."""

from unittest.mock import AsyncMock, MagicMock

import pytest

from llm_common.buffer import FLUSH_BATCH_SIZE, AsyncBuffer, SyncBuffer


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


class TestFlushFailureRetention:
    """A failed flush must not lose ledger rows — they retry on the next flush."""

    def test_sync_should_retain_batch_and_retry(self):
        mock_col = MagicMock()
        mock_col.insert_many.side_effect = [Exception("db down"), None]
        buf = SyncBuffer(mock_col)
        buf.add({"model": "a"})
        buf.flush()
        buf.flush()
        assert mock_col.insert_many.call_count == 2
        assert mock_col.insert_many.call_args_list[1].args[0] == [{"model": "a"}]
        buf.shutdown()

    def test_sync_should_keep_failed_rows_ahead_of_newer_ones(self):
        mock_col = MagicMock()
        mock_col.insert_many.side_effect = [Exception("db down"), None]
        buf = SyncBuffer(mock_col)
        buf.add({"model": "old"})
        buf.flush()
        buf.add({"model": "new"})
        buf.flush()
        retried = mock_col.insert_many.call_args_list[1].args[0]
        assert retried == [{"model": "old"}, {"model": "new"}]
        buf.shutdown()

    def test_sync_should_shed_oldest_beyond_cap(self):
        from llm_common.buffer import MAX_RETAINED_RECORDS

        mock_col = MagicMock()
        mock_col.insert_many.side_effect = Exception("db down")
        buf = SyncBuffer(mock_col)
        for i in range(MAX_RETAINED_RECORDS + 60):
            buf.add({"i": i})
        buf.flush()
        assert len(buf._buffer) == MAX_RETAINED_RECORDS
        assert buf._buffer[-1] == {"i": MAX_RETAINED_RECORDS + 59}
        buf._running = False
        if buf._timer:
            buf._timer.cancel()

    @pytest.mark.asyncio
    async def test_async_should_retain_batch_and_retry(self):
        mock_col = MagicMock()
        mock_col.insert_many = AsyncMock(side_effect=[Exception("db down"), None])
        buf = AsyncBuffer(mock_col)
        await buf.add({"model": "a"})
        await buf.flush()
        await buf.flush()
        assert mock_col.insert_many.await_count == 2
        assert mock_col.insert_many.await_args_list[1].args[0] == [{"model": "a"}]

    def test_sync_should_not_retry_on_every_add_right_after_failure(self):
        """Retained rows exceed the batch size; add() must not hammer a down Mongo."""
        from llm_common.buffer import FLUSH_BATCH_SIZE

        mock_col = MagicMock()
        mock_col.insert_many.side_effect = Exception("db down")
        buf = SyncBuffer(mock_col)
        for i in range(FLUSH_BATCH_SIZE):
            buf.add({"i": i})
        assert mock_col.insert_many.call_count == 1
        buf.add({"i": "after-failure"})
        buf.add({"i": "after-failure-2"})
        assert mock_col.insert_many.call_count == 1
        assert len(buf._buffer) == FLUSH_BATCH_SIZE + 2
        buf._running = False
        if buf._timer:
            buf._timer.cancel()

    def test_sync_should_resume_size_flushes_once_retry_window_passes(self):
        from llm_common.buffer import FLUSH_BATCH_SIZE

        mock_col = MagicMock()
        mock_col.insert_many.side_effect = [Exception("db down"), None]
        buf = SyncBuffer(mock_col)
        for i in range(FLUSH_BATCH_SIZE):
            buf.add({"i": i})
        buf._retry_after = 0.0  # simulate the retry window elapsing
        buf.add({"i": "late"})
        assert mock_col.insert_many.call_count == 2
        assert buf._buffer == []
        buf._running = False
        if buf._timer:
            buf._timer.cancel()

    @pytest.mark.asyncio
    async def test_async_should_not_retry_on_every_add_right_after_failure(self):
        from llm_common.buffer import FLUSH_BATCH_SIZE

        mock_col = MagicMock()
        mock_col.insert_many = AsyncMock(side_effect=Exception("db down"))
        buf = AsyncBuffer(mock_col)
        for i in range(FLUSH_BATCH_SIZE):
            await buf.add({"i": i})
        assert mock_col.insert_many.await_count == 1
        await buf.add({"i": "after-failure"})
        assert mock_col.insert_many.await_count == 1
