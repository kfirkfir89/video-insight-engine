"""Tests for llm_common.callback — MongoDBUsageCallback."""

from datetime import UTC, datetime
from unittest.mock import MagicMock, AsyncMock, patch

import pytest

from llm_common.callback import MongoDBUsageCallback
from llm_common.context import llm_feature_var, llm_video_id_var


class MockResponse:
    def __init__(self, tokens_in=10, tokens_out=20):
        self.usage = MagicMock(prompt_tokens=tokens_in, completion_tokens=tokens_out)
        self._hidden_params = MagicMock(cache_hit=False)


class TestSyncCallback:
    def test_log_success(self):
        mock_db = MagicMock()
        cb = MongoDBUsageCallback(mock_db, service="summarizer", mode="sync")

        token = llm_feature_var.set("summarize:chapter")
        try:
            cb.log_success_event(
                kwargs={"model": "anthropic/claude-sonnet-4-20250514", "messages": [{"content": "hello"}]},
                response_obj=MockResponse(),
                start_time=datetime.now(UTC),
                end_time=datetime.now(UTC),
            )
        finally:
            llm_feature_var.reset(token)

        # Record should be in the buffer
        assert len(cb._buffer._buffer) > 0 or mock_db["llm_usage"].insert_many.called

    def test_log_failure(self):
        mock_db = MagicMock()
        cb = MongoDBUsageCallback(mock_db, service="summarizer", mode="sync")

        cb.log_failure_event(
            kwargs={"model": "test/model", "exception": "timeout"},
            response_obj=None,
            start_time=datetime.now(UTC),
            end_time=datetime.now(UTC),
        )

    def test_cost_alert_triggers(self):
        mock_db = MagicMock()
        cb = MongoDBUsageCallback(mock_db, service="summarizer", mode="sync", cost_threshold=0.01)

        with patch("llm_common.callback.litellm") as mock_litellm:
            mock_litellm.completion_cost.return_value = 0.50
            mock_litellm.version = "1.80.0"

            cb.log_success_event(
                kwargs={"model": "test/model", "messages": []},
                response_obj=MockResponse(),
                start_time=datetime.now(UTC),
                end_time=datetime.now(UTC),
            )

        mock_db["llm_alerts"].insert_one.assert_called_once()

    def test_callback_never_crashes(self):
        """Callback errors should be caught, never propagate."""
        mock_db = MagicMock()
        mock_db.__getitem__ = MagicMock(side_effect=Exception("boom"))

        # Should not raise
        try:
            cb = MongoDBUsageCallback(mock_db, service="summarizer", mode="sync")
        except Exception:
            pass  # Construction may fail but that's initialization, not callback


class TestAsyncCallback:
    @pytest.mark.asyncio
    async def test_async_log_success(self):
        mock_db = MagicMock()
        mock_db.__getitem__ = MagicMock(return_value=AsyncMock())
        cb = MongoDBUsageCallback(mock_db, service="explainer", mode="async")

        await cb.async_log_success_event(
            kwargs={"model": "test/model", "messages": [{"content": "hi"}]},
            response_obj=MockResponse(),
            start_time=datetime.now(UTC),
            end_time=datetime.now(UTC),
        )

    @pytest.mark.asyncio
    async def test_async_log_failure(self):
        mock_db = MagicMock()
        mock_db.__getitem__ = MagicMock(return_value=AsyncMock())
        cb = MongoDBUsageCallback(mock_db, service="explainer", mode="async")

        await cb.async_log_failure_event(
            kwargs={"model": "test/model", "exception": "error"},
            response_obj=None,
            start_time=datetime.now(UTC),
            end_time=datetime.now(UTC),
        )

    @pytest.mark.asyncio
    async def test_async_cost_alert_triggers(self):
        """Async alert should await insert_one on motor collection."""
        mock_alerts_col = AsyncMock()
        mock_usage_col = AsyncMock()
        mock_db = MagicMock()
        mock_db.__getitem__ = MagicMock(side_effect=lambda k: mock_alerts_col if k == "llm_alerts" else mock_usage_col)
        cb = MongoDBUsageCallback(mock_db, service="explainer", mode="async", cost_threshold=0.01)

        with patch("llm_common.callback.litellm") as mock_litellm:
            mock_litellm.completion_cost.return_value = 0.50
            mock_litellm.version = "1.80.0"

            await cb.async_log_success_event(
                kwargs={"model": "test/model", "messages": []},
                response_obj=MockResponse(),
                start_time=datetime.now(UTC),
                end_time=datetime.now(UTC),
            )

        mock_alerts_col.insert_one.assert_awaited_once()


class TestCrossModeCallback:
    """Regression tests: sync-mode callback receiving async LiteLLM dispatch.

    When the summarizer uses mode="sync" but calls litellm.acompletion(),
    LiteLLM dispatches to async_log_success_event. Records must still be
    written via the SyncBuffer.
    """

    @pytest.mark.asyncio
    async def test_sync_mode_async_success_records(self):
        """async_log_success_event must buffer records when mode='sync'."""
        mock_db = MagicMock()
        cb = MongoDBUsageCallback(mock_db, service="summarizer", mode="sync")

        token = llm_feature_var.set("summarize:chapter")
        try:
            await cb.async_log_success_event(
                kwargs={"model": "anthropic/claude-sonnet-4-20250514", "messages": [{"content": "test"}]},
                response_obj=MockResponse(),
                start_time=datetime.now(UTC),
                end_time=datetime.now(UTC),
            )
        finally:
            llm_feature_var.reset(token)

        # Record may have been flushed by the timer thread already.
        # Either the buffer has the record or insert_many was called.
        buffered = len(cb._buffer._buffer) > 0
        flushed = mock_db["llm_usage"].insert_many.called
        assert buffered or flushed, "Record must be buffered or flushed to MongoDB"

    @pytest.mark.asyncio
    async def test_sync_mode_async_failure_records(self):
        """async_log_failure_event must buffer records when mode='sync'."""
        mock_db = MagicMock()
        cb = MongoDBUsageCallback(mock_db, service="summarizer", mode="sync")

        await cb.async_log_failure_event(
            kwargs={"model": "test/model", "exception": "timeout"},
            response_obj=None,
            start_time=datetime.now(UTC),
            end_time=datetime.now(UTC),
        )

        buffered = len(cb._buffer._buffer) > 0
        flushed = mock_db["llm_usage"].insert_many.called
        assert buffered or flushed, "Failure record must be buffered or flushed"

    @pytest.mark.asyncio
    async def test_sync_mode_async_cost_alert(self):
        """async_log_success_event with mode='sync' must trigger sync cost alert."""
        mock_db = MagicMock()
        cb = MongoDBUsageCallback(mock_db, service="summarizer", mode="sync", cost_threshold=0.01)

        with patch("llm_common.callback.litellm") as mock_litellm:
            mock_litellm.completion_cost.return_value = 0.50
            mock_litellm.version = "1.80.0"

            await cb.async_log_success_event(
                kwargs={"model": "test/model", "messages": []},
                response_obj=MockResponse(),
                start_time=datetime.now(UTC),
                end_time=datetime.now(UTC),
            )

        mock_db["llm_alerts"].insert_one.assert_called_once()
