"""MongoDB implementation of video repository."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from bson import ObjectId
from pymongo.database import Database

from src.models.schemas import ProcessingStatus, ErrorCode


def _utc_now() -> datetime:
    """Get current UTC time in timezone-aware format."""
    return datetime.now(timezone.utc)


class MongoDBVideoRepository:
    """MongoDB implementation of VideoRepository protocol."""

    def __init__(self, database: Database):
        self._db = database
        self._collection = database.videoSummaryCache

    def get_video_summary(self, video_summary_id: str) -> dict | None:
        """Get video summary cache entry."""
        return self._collection.find_one({"_id": ObjectId(video_summary_id)})

    def update_status(
        self,
        video_summary_id: str,
        status: ProcessingStatus,
        error_message: str | None = None,
        error_code: ErrorCode | None = None,
    ) -> None:
        """Update processing status."""
        update: dict[str, Any] = {
            "status": status.value,
            "updatedAt": _utc_now(),
        }

        if error_message:
            update["errorMessage"] = error_message
        if error_code:
            update["errorCode"] = error_code.value

        self._collection.update_one(
            {"_id": ObjectId(video_summary_id)},
            {"$set": update}
        )

    # Allowlist of fields the pipeline may write via save_structured_result.
    # New pipeline uses meta+tabs as the canonical shape.
    _ALLOWED_RESULT_KEYS = frozenset({
        "meta", "tabs", "triage", "synthesis", "enrichment",
        "assembledMeta", "assembledTabs", "pipeline",
        "status", "title", "creator", "duration", "thumbnailUrl",
        "youtubeId", "rawTranscriptRef", "generation",
        "descriptionAnalysis", "channel", "processedAt", "processingTimeMs",
        # Backward compat: older pipeline shapes / Redis-cached docs may include these
        "output", "summary", "outputType", "context", "intent",
    })

    def save_structured_result(self, video_summary_id: str, result: dict) -> None:
        """Save structured pipeline result (triage-driven pipeline).

        Stores allowlisted fields from result — prevents injection of
        arbitrary fields like _id or userId.
        """
        filtered = {k: v for k, v in result.items() if k in self._ALLOWED_RESULT_KEYS}
        filtered["updatedAt"] = _utc_now()
        self._collection.update_one(
            {"_id": ObjectId(video_summary_id)},
            {"$set": filtered}
        )

    def increment_retry(self, video_summary_id: str) -> int:
        """Increment retry count and return new value."""
        result = self._collection.find_one_and_update(
            {"_id": ObjectId(video_summary_id)},
            {"$inc": {"retryCount": 1}},
            return_document=True
        )
        return result.get("retryCount", 1) if result else 1

    def set_provider_config(
        self,
        video_summary_id: str,
        providers: dict[str, Any] | None = None,
    ) -> None:
        """Store provider config for dev tools override."""
        if providers:
            self._collection.update_one(
                {"_id": ObjectId(video_summary_id)},
                {"$set": {"providerConfig": providers, "updatedAt": _utc_now()}}
            )
