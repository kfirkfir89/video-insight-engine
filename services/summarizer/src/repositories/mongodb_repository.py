"""MongoDB implementation of video repository."""

from datetime import datetime, timezone
from typing import Any, Optional
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

    def get_video_summary(self, video_summary_id: str) -> Optional[dict]:
        """Get video summary cache entry."""
        return self._collection.find_one({"_id": ObjectId(video_summary_id)})

    def update_status(
        self,
        video_summary_id: str,
        status: ProcessingStatus,
        error_message: Optional[str] = None,
        error_code: Optional[ErrorCode] = None,
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

    def save_structured_result(self, video_summary_id: str, result: dict) -> None:
        """Save structured pipeline result (intent-driven pipeline).

        Stores the result dict directly — the new pipeline builds the exact
        MongoDB document shape in stream_summarization().
        """
        update_data = {**result, "updatedAt": _utc_now()}
        self._collection.update_one(
            {"_id": ObjectId(video_summary_id)},
            {"$set": update_data}
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
        providers: Optional[dict[str, Any]] = None,
    ) -> None:
        """Store provider config for dev tools override."""
        if providers:
            self._collection.update_one(
                {"_id": ObjectId(video_summary_id)},
                {"$set": {"providerConfig": providers, "updatedAt": _utc_now()}}
            )
