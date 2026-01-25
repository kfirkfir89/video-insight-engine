"""LLM usage tracking for cost monitoring and analytics.

Tracks all LLM calls in MongoDB for visibility into costs and usage patterns.
"""

import logging
from datetime import UTC, datetime
from typing import Any

from pydantic import BaseModel
from pymongo.database import Database

logger = logging.getLogger(__name__)


class LLMUsageRecord(BaseModel):
    """Record of a single LLM API call."""

    user_id: str | None = None
    model: str
    provider: str
    tokens_in: int
    tokens_out: int
    cost_usd: float
    feature: str  # "summarize", "expand", "chat", etc.
    timestamp: datetime
    success: bool
    error_message: str | None = None
    duration_ms: int
    request_id: str | None = None


def extract_provider(model: str) -> str:
    """Extract provider from model string (e.g., 'anthropic/claude-...' -> 'anthropic')."""
    return model.split("/")[0] if "/" in model else "unknown"


class UsageTracker:
    """Tracks LLM usage in MongoDB."""

    def __init__(self, database: Database):
        """Initialize usage tracker.

        Args:
            database: MongoDB database instance
        """
        self._collection = database.llm_usage
        self._ensure_indexes()

    def _ensure_indexes(self):
        """Create indexes for efficient querying."""
        try:
            self._collection.create_index([("user_id", 1), ("timestamp", -1)])
            self._collection.create_index([("timestamp", -1)])
            self._collection.create_index([("feature", 1)])
            self._collection.create_index([("provider", 1)])
        except Exception as e:
            logger.warning(f"Could not create indexes: {e}")

    async def track_success(
        self,
        model: str,
        tokens_in: int,
        tokens_out: int,
        cost_usd: float,
        duration_ms: int,
        feature: str,
        user_id: str | None = None,
        request_id: str | None = None,
    ) -> None:
        """Track a successful LLM call.

        Args:
            model: Model used (e.g., "anthropic/claude-sonnet-4-20250514")
            tokens_in: Input tokens
            tokens_out: Output tokens
            cost_usd: Cost in USD
            duration_ms: Duration in milliseconds
            feature: Feature name (e.g., "summarize")
            user_id: Optional user ID
            request_id: Optional request ID
        """
        record = LLMUsageRecord(
            user_id=user_id,
            model=model,
            provider=extract_provider(model),
            tokens_in=tokens_in,
            tokens_out=tokens_out,
            cost_usd=cost_usd,
            feature=feature,
            timestamp=datetime.now(UTC),
            success=True,
            duration_ms=duration_ms,
            request_id=request_id,
        )

        try:
            self._collection.insert_one(record.model_dump())
        except Exception as e:
            logger.error(f"Failed to track usage: {e}")

    async def track_failure(
        self,
        model: str,
        error_message: str,
        duration_ms: int,
        feature: str,
        user_id: str | None = None,
        request_id: str | None = None,
    ) -> None:
        """Track a failed LLM call.

        Args:
            model: Model attempted
            error_message: Error description
            duration_ms: Duration before failure
            feature: Feature name
            user_id: Optional user ID
            request_id: Optional request ID
        """
        record = LLMUsageRecord(
            user_id=user_id,
            model=model,
            provider=extract_provider(model),
            tokens_in=0,
            tokens_out=0,
            cost_usd=0.0,
            feature=feature,
            timestamp=datetime.now(UTC),
            success=False,
            error_message=error_message,
            duration_ms=duration_ms,
            request_id=request_id,
        )

        try:
            self._collection.insert_one(record.model_dump())
        except Exception as e:
            logger.error(f"Failed to track failure: {e}")

    def get_usage_stats(
        self,
        user_id: str | None = None,
        feature: str | None = None,
        days: int = 30,
    ) -> dict[str, Any]:
        """Get aggregated usage statistics.

        Args:
            user_id: Filter by user ID
            feature: Filter by feature
            days: Number of days to look back

        Returns:
            Dict with total_calls, total_tokens, total_cost, by_provider, by_feature
        """
        cutoff = datetime.now(UTC).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        cutoff = cutoff.replace(day=cutoff.day - days) if cutoff.day > days else cutoff

        match_stage: dict[str, Any] = {"timestamp": {"$gte": cutoff}}
        if user_id:
            match_stage["user_id"] = user_id
        if feature:
            match_stage["feature"] = feature

        pipeline = [
            {"$match": match_stage},
            {
                "$group": {
                    "_id": None,
                    "total_calls": {"$sum": 1},
                    "total_tokens_in": {"$sum": "$tokens_in"},
                    "total_tokens_out": {"$sum": "$tokens_out"},
                    "total_cost": {"$sum": "$cost_usd"},
                    "success_count": {
                        "$sum": {"$cond": ["$success", 1, 0]}
                    },
                }
            },
        ]

        try:
            results = list(self._collection.aggregate(pipeline))
            if results:
                r = results[0]
                return {
                    "total_calls": r["total_calls"],
                    "total_tokens_in": r["total_tokens_in"],
                    "total_tokens_out": r["total_tokens_out"],
                    "total_cost_usd": r["total_cost"],
                    "success_rate": r["success_count"] / r["total_calls"]
                    if r["total_calls"] > 0
                    else 0,
                }
        except Exception as e:
            logger.error(f"Failed to get usage stats: {e}")

        return {
            "total_calls": 0,
            "total_tokens_in": 0,
            "total_tokens_out": 0,
            "total_cost_usd": 0,
            "success_rate": 0,
        }


# Default tracker instance (lazy initialized)
_default_tracker: UsageTracker | None = None


def get_usage_tracker(database: Database) -> UsageTracker:
    """Get or create usage tracker instance."""
    global _default_tracker
    if _default_tracker is None:
        _default_tracker = UsageTracker(database)
    return _default_tracker
