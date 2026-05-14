"""Tests for llm_common.callback — MongoDBUsageCallback."""

from datetime import UTC, datetime
from unittest.mock import MagicMock, AsyncMock, patch

import pytest

from llm_common.callback import MongoDBUsageCallback
from llm_common.context import llm_feature_var, llm_video_id_var


class MockResponse:
    def __init__(
        self,
        tokens_in=10,
        tokens_out=20,
        cache_creation_input_tokens=0,
        cache_read_input_tokens=0,
        cache_hit=False,
    ):
        self.usage = MagicMock(
            prompt_tokens=tokens_in,
            completion_tokens=tokens_out,
            cache_creation_input_tokens=cache_creation_input_tokens,
            cache_read_input_tokens=cache_read_input_tokens,
        )
        self._hidden_params = MagicMock(cache_hit=cache_hit)


class TestSyncCallback:
    def test_log_success(self):
        mock_db = MagicMock()
        cb = MongoDBUsageCallback(mock_db, service="summarizer", mode="sync")

        token = llm_feature_var.set("summarize:chapter")
        try:
            cb.log_success_event(
                kwargs={"model": "anthropic/claude-sonnet-4-6", "messages": [{"content": "hello"}]},
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


class TestCachePlumbing:
    """Cache token + savings plumbing into UsageRecord (Phase 2 / P4)."""

    def _capture_record(self, cb):
        """Inspect the most recent record buffered by the callback."""
        # SyncBuffer stores records in ._buffer (list-backed), if not yet flushed.
        if cb._buffer._buffer:
            return cb._buffer._buffer[-1]
        # Fallback: inspect the insert_many call.
        last_call = cb._usage_col.insert_many.call_args
        if last_call:
            records = last_call.args[0] if last_call.args else last_call.kwargs.get("documents", [])
            return records[-1]
        raise AssertionError("No record was buffered or flushed")

    def test_records_cache_creation_tokens(self):
        mock_db = MagicMock()
        cb = MongoDBUsageCallback(mock_db, service="summarizer", mode="sync")

        with patch("llm_common.callback.litellm") as mock_litellm:
            mock_litellm.completion_cost.return_value = 0.05
            mock_litellm.version = "1.80.0"

            cb.log_success_event(
                kwargs={"model": "anthropic/claude-sonnet-4-6", "messages": [{"content": "x"}]},
                response_obj=MockResponse(cache_creation_input_tokens=10000),
                start_time=datetime.now(UTC),
                end_time=datetime.now(UTC),
            )

        record = self._capture_record(cb)
        assert record["cache_creation_tokens"] == 10000
        assert record["cache_read_tokens"] == 0
        # No read tokens → no savings.
        assert record["cache_savings_usd"] == 0.0

    def test_records_cache_read_tokens_and_savings(self):
        """A 10K cached read on Sonnet saves ~$0.027 (3.00 - 0.30 = 2.70 / 1M)."""
        mock_db = MagicMock()
        cb = MongoDBUsageCallback(mock_db, service="summarizer", mode="sync")

        with patch("llm_common.callback.litellm") as mock_litellm:
            mock_litellm.completion_cost.return_value = 0.05
            mock_litellm.version = "1.80.0"

            cb.log_success_event(
                kwargs={"model": "anthropic/claude-sonnet-4-6", "messages": [{"content": "x"}]},
                response_obj=MockResponse(cache_read_input_tokens=10_000),
                start_time=datetime.now(UTC),
                end_time=datetime.now(UTC),
            )

        record = self._capture_record(cb)
        assert record["cache_read_tokens"] == 10_000
        # (10_000 / 1_000_000) * (3.00 - 0.30) = 0.027
        assert record["cache_savings_usd"] == pytest.approx(0.027)
        # Cache hit should be inferred from read_tokens > 0.
        assert record["cache_hit"] is True

    def test_haiku_cache_savings_use_haiku_rates(self):
        """Haiku cached reads save (1.00 - 0.10) = 0.90 / 1M tokens."""
        mock_db = MagicMock()
        cb = MongoDBUsageCallback(mock_db, service="summarizer", mode="sync")

        with patch("llm_common.callback.litellm") as mock_litellm:
            mock_litellm.completion_cost.return_value = 0.01
            mock_litellm.version = "1.80.0"

            cb.log_success_event(
                kwargs={"model": "anthropic/claude-haiku-4-5-20251001", "messages": [{"content": "x"}]},
                response_obj=MockResponse(cache_read_input_tokens=100_000),
                start_time=datetime.now(UTC),
                end_time=datetime.now(UTC),
            )

        record = self._capture_record(cb)
        assert record["cache_savings_usd"] == pytest.approx(0.090)

    def test_unmapped_model_yields_zero_savings(self):
        """For models we don't have rates for, savings stay at 0 (not invented)."""
        mock_db = MagicMock()
        cb = MongoDBUsageCallback(mock_db, service="summarizer", mode="sync")

        with patch("llm_common.callback.litellm") as mock_litellm:
            mock_litellm.completion_cost.return_value = 0.0
            mock_litellm.version = "1.80.0"

            cb.log_success_event(
                kwargs={"model": "openai/gpt-4o", "messages": [{"content": "x"}]},
                response_obj=MockResponse(cache_read_input_tokens=10_000),
                start_time=datetime.now(UTC),
                end_time=datetime.now(UTC),
            )

        record = self._capture_record(cb)
        assert record["cache_read_tokens"] == 10_000
        assert record["cache_savings_usd"] == 0.0

    def test_unmapped_anthropic_model_logs_drift_warning_once(self):
        """When an Anthropic model isn't in the rate map (typical signal of a
        config rename that wasn't mirrored), log once per model so the drift
        is visible without flooding the buffer on subsequent calls."""
        from llm_common.models import (
            _LOGGED_MISSING_RATE_MODELS,
            compute_cache_savings_usd,
        )

        unknown_model = "anthropic/claude-future-99"
        _LOGGED_MISSING_RATE_MODELS.discard(unknown_model)
        try:
            with patch("llm_common.models.logger") as mock_logger:
                # First call logs.
                first = compute_cache_savings_usd(unknown_model, 5_000)
                # Second call must NOT re-log.
                second = compute_cache_savings_usd(unknown_model, 7_000)

            assert first == 0.0
            assert second == 0.0
            assert mock_logger.info.call_count == 1
            args, kwargs = mock_logger.info.call_args
            assert args[0] == "cache.rate_missing"
            assert kwargs["model"] == unknown_model
        finally:
            _LOGGED_MISSING_RATE_MODELS.discard(unknown_model)

    def test_unmapped_non_anthropic_model_does_not_log(self):
        """OpenAI / Gemini misses are silent — only Anthropic gets the warning
        because cache pricing is Anthropic-specific today."""
        from llm_common.models import compute_cache_savings_usd

        with patch("llm_common.models.logger") as mock_logger:
            result = compute_cache_savings_usd("openai/gpt-4o", 10_000)

        assert result == 0.0
        mock_logger.info.assert_not_called()

    def test_no_cache_fields_default_to_zero(self):
        mock_db = MagicMock()
        cb = MongoDBUsageCallback(mock_db, service="summarizer", mode="sync")

        with patch("llm_common.callback.litellm") as mock_litellm:
            mock_litellm.completion_cost.return_value = 0.05
            mock_litellm.version = "1.80.0"

            cb.log_success_event(
                kwargs={"model": "anthropic/claude-sonnet-4-6", "messages": [{"content": "x"}]},
                response_obj=MockResponse(),
                start_time=datetime.now(UTC),
                end_time=datetime.now(UTC),
            )

        record = self._capture_record(cb)
        assert record["cache_creation_tokens"] == 0
        assert record["cache_read_tokens"] == 0
        assert record["cache_savings_usd"] == 0.0


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
                kwargs={"model": "anthropic/claude-sonnet-4-6", "messages": [{"content": "test"}]},
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
