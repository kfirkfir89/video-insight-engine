from datetime import datetime
from typing import Any, Optional
from bson import ObjectId
from pymongo import MongoClient

from src.config import settings
from src.models.schemas import ProcessingStatus, ErrorCode

client = MongoClient(settings.MONGODB_URI)
db = client.get_default_database()


def get_video_summary(video_summary_id: str) -> Optional[dict]:
    """Get video summary cache entry."""
    return db.videoSummaryCache.find_one({"_id": ObjectId(video_summary_id)})


def update_status(
    video_summary_id: str,
    status: ProcessingStatus,
    error_message: Optional[str] = None,
    error_code: Optional[ErrorCode] = None,
) -> None:
    """Update processing status."""
    update: dict[str, Any] = {
        "status": status.value,
        "updatedAt": datetime.utcnow(),
    }

    if error_message:
        update["errorMessage"] = error_message
    if error_code:
        update["errorCode"] = error_code.value

    db.videoSummaryCache.update_one(
        {"_id": ObjectId(video_summary_id)},
        {"$set": update}
    )


def save_result(video_summary_id: str, result: dict) -> None:
    """Save processing result to cache."""
    db.videoSummaryCache.update_one(
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
                "processedAt": datetime.utcnow(),
                "processingTimeMs": result.get("processing_time_ms"),
                "tokenUsage": result.get("token_usage"),
                "updatedAt": datetime.utcnow(),
            }
        }
    )


def increment_retry(video_summary_id: str) -> int:
    """Increment retry count and return new value."""
    result = db.videoSummaryCache.find_one_and_update(
        {"_id": ObjectId(video_summary_id)},
        {"$inc": {"retryCount": 1}},
        return_document=True
    )
    return result.get("retryCount", 1)
