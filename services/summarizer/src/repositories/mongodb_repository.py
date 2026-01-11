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

    def save_result(self, video_summary_id: str, result: dict) -> None:
        """Save processing result to cache."""
        self._collection.update_one(
            {"_id": ObjectId(video_summary_id)},
            {
                "$set": {
                    "title": result["title"],
                    "channel": result.get("channel"),
                    "duration": result.get("duration"),
                    "thumbnailUrl": result.get("thumbnail_url"),
                    "transcript": result["transcript"],
                    "transcriptType": result["transcript_type"],
                    "summary": {
                        "tldr": result["summary"]["tldr"],
                        "keyTakeaways": result["summary"]["key_takeaways"],
                        "sections": [
                            {
                                "id": s["id"],
                                "timestamp": s["timestamp"],
                                "startSeconds": s["start_seconds"],
                                "endSeconds": s["end_seconds"],
                                "title": s["title"],
                                "summary": s["summary"],
                                "bullets": s["bullets"],
                            }
                            for s in result["summary"]["sections"]
                        ],
                        "concepts": [
                            {
                                "id": c["id"],
                                "name": c["name"],
                                "definition": c.get("definition"),
                                "timestamp": c.get("timestamp"),
                            }
                            for c in result["summary"]["concepts"]
                        ],
                    },
                    "status": ProcessingStatus.COMPLETED.value,
                    "processedAt": _utc_now(),
                    "processingTimeMs": result.get("processing_time_ms"),
                    "tokenUsage": result.get("token_usage"),
                    "updatedAt": _utc_now(),
                }
            }
        )

    def increment_retry(self, video_summary_id: str) -> int:
        """Increment retry count and return new value."""
        result = self._collection.find_one_and_update(
            {"_id": ObjectId(video_summary_id)},
            {"$inc": {"retryCount": 1}},
            return_document=True
        )
        return result.get("retryCount", 1) if result else 1
