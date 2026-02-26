"""LiteLLM CustomLogger callback that captures all LLM calls to MongoDB.

Usage:
    from llm_common import MongoDBUsageCallback
    import litellm

    # Sync mode (summarizer - pymongo)
    callback = MongoDBUsageCallback(db, service="summarizer", mode="sync")
    litellm.callbacks = [callback]

    # Async mode (explainer - motor)
    callback = MongoDBUsageCallback(db, service="explainer", mode="async")
    await callback.start_async()
    litellm.callbacks = [callback]
"""

import hashlib
from datetime import UTC, datetime

import litellm
import structlog
from litellm.integrations.custom_logger import CustomLogger

from llm_common.buffer import AsyncBuffer, SyncBuffer
from llm_common.context import llm_feature_var, llm_request_id_var, llm_video_id_var
from llm_common.models import UsageRecord, extract_provider

logger = structlog.get_logger(__name__)

DEFAULT_COST_THRESHOLD = 0.50


class MongoDBUsageCallback(CustomLogger):
    """LiteLLM callback that buffers usage records to MongoDB."""

    def __init__(
        self,
        database,
        service: str = "unknown",
        mode: str = "sync",
        cost_threshold: float = DEFAULT_COST_THRESHOLD,
    ):
        self._service = service
        self._mode = mode
        self._cost_threshold = cost_threshold
        self._usage_col = database["llm_usage"]
        self._alerts_col = database["llm_alerts"]

        if mode == "sync":
            self._buffer = SyncBuffer(self._usage_col)
        else:
            self._buffer = AsyncBuffer(self._usage_col)

    async def start_async(self) -> None:
        """Start the async buffer flush loop. Call in lifespan for async mode."""
        if isinstance(self._buffer, AsyncBuffer):
            await self._buffer.start()

    def shutdown_sync(self) -> None:
        """Flush remaining records. Call on shutdown for sync mode."""
        if isinstance(self._buffer, SyncBuffer):
            self._buffer.shutdown()

    async def shutdown_async(self) -> None:
        """Flush remaining records. Call on shutdown for async mode."""
        if isinstance(self._buffer, AsyncBuffer):
            await self._buffer.shutdown()

    def _build_record(self, kwargs: dict, response_obj, start_time, end_time) -> dict:
        """Build a UsageRecord dict from LiteLLM callback args."""
        try:
            model = kwargs.get("model", "unknown")
            messages = kwargs.get("messages", [])

            # Extract prompt preview
            prompt_text = ""
            if messages:
                last_msg = messages[-1] if isinstance(messages, list) else messages
                if isinstance(last_msg, dict):
                    prompt_text = str(last_msg.get("content", ""))[:200]

            prompt_hash = hashlib.sha256(prompt_text.encode()).hexdigest()[:16] if prompt_text else ""

            # Extract usage from response
            tokens_in = 0
            tokens_out = 0
            if response_obj and hasattr(response_obj, "usage") and response_obj.usage:
                tokens_in = getattr(response_obj.usage, "prompt_tokens", 0) or 0
                tokens_out = getattr(response_obj.usage, "completion_tokens", 0) or 0

            # Calculate cost
            cost = 0.0
            try:
                cost = litellm.completion_cost(completion_response=response_obj) or 0.0
            except Exception as e:
                logger.debug("cost_calculation_failed", model=model, error=str(e))

            # Duration
            duration_ms = 0
            if start_time and end_time:
                duration_ms = int((end_time - start_time).total_seconds() * 1000)

            # Check for streaming
            is_stream = kwargs.get("stream", False)

            # Cache hit detection
            cache_hit = False
            if response_obj and hasattr(response_obj, "_hidden_params"):
                cache_hit = bool(getattr(response_obj._hidden_params, "cache_hit", False))

            record = UsageRecord(
                model=model,
                provider=extract_provider(model),
                tokens_in=tokens_in,
                tokens_out=tokens_out,
                cost_usd=cost,
                feature=llm_feature_var.get(),
                timestamp=datetime.now(UTC),
                success=True,
                duration_ms=duration_ms,
                request_id=llm_request_id_var.get(),
                video_id=llm_video_id_var.get(),
                is_stream=is_stream,
                service=self._service,
                prompt_preview=prompt_text,
                prompt_hash=prompt_hash,
                cache_hit=cache_hit,
                litellm_version=getattr(litellm, "version", ""),
            )
            return record.model_dump()
        except Exception as e:
            logger.error("record_build_failed", error=str(e))
            return UsageRecord(
                model=kwargs.get("model", "unknown"),
                provider=extract_provider(kwargs.get("model", "unknown")),
                service=self._service,
                feature=llm_feature_var.get(),
            ).model_dump()

    def _build_alert(self, record: dict) -> dict:
        """Build alert document from a usage record."""
        return {
            "type": "high_cost_call",
            "cost_usd": record.get("cost_usd", 0),
            "model": record.get("model"),
            "feature": record.get("feature"),
            "service": record.get("service"),
            "threshold": self._cost_threshold,
            "timestamp": datetime.now(UTC),
        }

    def _check_cost_alert_sync(self, record: dict) -> None:
        """Write alert if cost exceeds threshold (sync/pymongo)."""
        cost = record.get("cost_usd", 0)
        if cost > self._cost_threshold:
            logger.warning(
                "high_cost_alert",
                cost_usd=cost,
                model=record.get("model"),
                threshold=self._cost_threshold,
            )
            try:
                self._alerts_col.insert_one(self._build_alert(record))
            except Exception as e:
                logger.error("alert_write_failed", error=str(e))

    async def _check_cost_alert_async(self, record: dict) -> None:
        """Write alert if cost exceeds threshold (async/motor)."""
        cost = record.get("cost_usd", 0)
        if cost > self._cost_threshold:
            logger.warning(
                "high_cost_alert",
                cost_usd=cost,
                model=record.get("model"),
                threshold=self._cost_threshold,
            )
            try:
                await self._alerts_col.insert_one(self._build_alert(record))
            except Exception as e:
                logger.error("alert_write_failed", error=str(e))

    # ── Sync callbacks (used by summarizer) ──

    def log_success_event(self, kwargs, response_obj, start_time, end_time):
        try:
            record = self._build_record(kwargs, response_obj, start_time, end_time)
            if self._mode == "sync":
                self._buffer.add(record)
                self._check_cost_alert_sync(record)
        except Exception as e:
            logger.error("callback_success_failed", error=str(e))

    def log_failure_event(self, kwargs, response_obj, start_time, end_time):
        try:
            record = self._build_record(kwargs, response_obj, start_time, end_time)
            record["success"] = False
            record["error_message"] = str(kwargs.get("exception", "unknown"))
            if self._mode == "sync":
                self._buffer.add(record)
        except Exception as e:
            logger.error("callback_failure_failed", error=str(e))

    # ── Async callbacks (used by explainer) ──

    async def async_log_success_event(self, kwargs, response_obj, start_time, end_time):
        try:
            record = self._build_record(kwargs, response_obj, start_time, end_time)
            if self._mode == "async":
                await self._buffer.add(record)
            await self._check_cost_alert_async(record)
        except Exception as e:
            logger.error("callback_success_failed", error=str(e))

    async def async_log_failure_event(self, kwargs, response_obj, start_time, end_time):
        try:
            record = self._build_record(kwargs, response_obj, start_time, end_time)
            record["success"] = False
            record["error_message"] = str(kwargs.get("exception", "unknown"))
            if self._mode == "async":
                await self._buffer.add(record)
        except Exception as e:
            logger.error("callback_failure_failed", error=str(e))
