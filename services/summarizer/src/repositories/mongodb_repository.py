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
        """Save processing result to cache.

        New fields (progressive summarization):
        - chapters: Creator-defined or AI-detected sections
        - chapterSource: "creator" | "description" | "ai_detected"
        - descriptionAnalysis: Links, resources, related videos, timestamps, social links
        """
        update_data: dict[str, Any] = {
            "title": result["title"],
            "channel": result.get("channel"),
            "duration": result.get("duration"),
            "thumbnailUrl": result.get("thumbnail_url"),
            "transcript": result["transcript"],
            "transcriptType": result["transcript_type"],
            # Normalized transcript segments (Phase 2 - transcript system)
            "transcriptSegments": [
                {"text": seg["text"], "startMs": seg["startMs"], "endMs": seg["endMs"]}
                for seg in result.get("transcript_segments", [])
            ] if result.get("transcript_segments") else None,
            "transcriptSource": result.get("transcript_source"),
            "summary": {
                "tldr": result["summary"]["tldr"],
                "keyTakeaways": result["summary"]["key_takeaways"],
                "chapters": [
                    {
                        "id": s["id"],
                        "timestamp": s["timestamp"],
                        "startSeconds": s.get("startSeconds") or s.get("start_seconds", 0),
                        "endSeconds": s.get("endSeconds") or s.get("end_seconds", 0),
                        "title": s["title"],
                        "originalTitle": s.get("originalTitle") or s.get("original_title"),
                        "generatedTitle": s.get("generatedTitle") or s.get("generated_title"),
                        "isCreatorChapter": s.get("isCreatorChapter") or s.get("is_creator_chapter"),
                        "content": s.get("content"),  # Dynamic content blocks - source of truth
                        "view": s.get("view"),
                        # Sliced transcript for this chapter (RAG/display)
                        "transcript": s.get("transcript"),
                    }
                    for s in result["summary"]["chapters"]
                ],
                "concepts": [
                    {
                        "id": c["id"],
                        "name": c["name"],
                        "definition": c.get("definition"),
                        "timestamp": c.get("timestamp"),
                        "chapterIndex": c.get("chapter_index"),
                    }
                    for c in result["summary"]["concepts"]
                ],
                "masterSummary": result["summary"].get("master_summary"),
            },
            "status": ProcessingStatus.COMPLETED.value,
            "processedAt": _utc_now(),
            "processingTimeMs": result.get("processing_time_ms"),
            "tokenUsage": result.get("token_usage"),
            "updatedAt": _utc_now(),
        }

        # Add chapters if present (progressive summarization)
        if "chapters" in result:
            update_data["chapters"] = [
                {
                    "startSeconds": ch["startSeconds"],
                    "endSeconds": ch["endSeconds"],
                    "title": ch["title"],
                    "isCreatorChapter": ch.get("isCreatorChapter", False),
                }
                for ch in result["chapters"]
            ]

        # Add chapter source if present
        if "chapter_source" in result:
            update_data["chapterSource"] = result["chapter_source"]

        # Add description analysis if present (progressive summarization)
        if "description_analysis" in result:
            update_data["descriptionAnalysis"] = result["description_analysis"]

        # Add video context if present (persona-aware summarization)
        if "context" in result and result["context"]:
            update_data["context"] = result["context"]

        # Add S3 reference for raw transcript (Phase 3 - transcript storage)
        if "raw_transcript_ref" in result:
            update_data["rawTranscriptRef"] = result["raw_transcript_ref"]

        # Add generation metadata (Phase 3 - for regeneration tracking)
        if "generation" in result:
            update_data["generation"] = {
                "model": result["generation"]["model"],
                "promptVersion": result["generation"]["prompt_version"],
                "generatedAt": result["generation"]["generated_at"],
            }

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
