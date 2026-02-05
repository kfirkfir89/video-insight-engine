"""Motor async MongoDB repository implementations for vie-explainer service."""

import logging
from datetime import datetime, timezone
from typing import Any

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from src.schemas import (
    Chat,
    ChatMessage,
    Expansion,
    MemorizedItem,
    MemorizedItemSource,
    VideoSummary,
    VideoSummaryConcept,
    VideoSummarySection,
)

logger = logging.getLogger(__name__)


def _utc_now() -> datetime:
    """Get current UTC time in timezone-aware format."""
    return datetime.now(timezone.utc)


class MongoVideoSummaryRepository:
    """Async MongoDB repository for video summaries (read-only)."""

    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self._collection = db.videoSummaryCache

    async def find_by_id(self, video_summary_id: str) -> VideoSummary | None:
        """Find video summary by ID."""
        if not ObjectId.is_valid(video_summary_id):
            return None

        doc = await self._collection.find_one({"_id": ObjectId(video_summary_id)})
        return self._to_entity(doc) if doc else None

    def _to_entity(self, doc: dict[str, Any]) -> VideoSummary:
        """Convert MongoDB document to VideoSummary domain object."""
        summary_data = doc.get("summary", {})

        sections = [
            VideoSummarySection(
                id=s.get("id", ""),
                title=s.get("title", ""),
                timestamp=s.get("timestamp", "00:00"),
                content=s.get("content", []),
            )
            for s in summary_data.get("sections", [])
        ]

        concepts = [
            VideoSummaryConcept(
                id=c.get("id", ""),
                name=c.get("name", ""),
                definition=c.get("definition", ""),
            )
            for c in summary_data.get("concepts", [])
        ]

        return VideoSummary(
            id=str(doc["_id"]),
            youtubeId=doc.get("youtubeId", ""),
            title=doc.get("title", "Unknown"),
            sections=sections,
            concepts=concepts,
        )


class MongoExpansionRepository:
    """Async MongoDB repository for expansion cache."""

    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self._collection = db.systemExpansionCache

    async def find_by_target(
        self,
        video_summary_id: str,
        target_type: str,
        target_id: str,
    ) -> Expansion | None:
        """Find cached expansion for a specific target."""
        if not ObjectId.is_valid(video_summary_id):
            return None

        doc = await self._collection.find_one(
            {
                "videoSummaryId": ObjectId(video_summary_id),
                "targetType": target_type,
                "targetId": target_id,
                "status": "completed",
            }
        )
        return self._to_entity(doc) if doc else None

    async def save(
        self,
        video_summary_id: str,
        target_type: str,
        target_id: str,
        context: dict[str, Any],
        content: str,
        model: str,
    ) -> str:
        """Save expansion to cache."""
        now = _utc_now()
        result = await self._collection.insert_one(
            {
                "videoSummaryId": ObjectId(video_summary_id),
                "targetType": target_type,
                "targetId": target_id,
                "context": context,
                "content": content,
                "status": "completed",
                "version": 1,
                "model": model,
                "generatedAt": now,
                "createdAt": now,
            }
        )
        return str(result.inserted_id)

    def _to_entity(self, doc: dict[str, Any]) -> Expansion:
        """Convert MongoDB document to Expansion domain object."""
        return Expansion(
            id=str(doc["_id"]),
            videoSummaryId=str(doc["videoSummaryId"]),
            targetType=doc["targetType"],
            targetId=doc["targetId"],
            context=doc.get("context", {}),
            content=doc["content"],
            status=doc.get("status", "completed"),
            version=doc.get("version", 1),
            model=doc.get("model", "unknown"),
            generatedAt=doc.get("generatedAt", _utc_now()),
            createdAt=doc.get("createdAt", _utc_now()),
        )


class MongoMemorizedItemRepository:
    """Async MongoDB repository for memorized items (read-only)."""

    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self._collection = db.memorizedItems

    async def find_by_id_and_user(
        self,
        item_id: str,
        user_id: str,
    ) -> MemorizedItem | None:
        """Find memorized item by ID, scoped to user."""
        if not ObjectId.is_valid(item_id) or not ObjectId.is_valid(user_id):
            return None

        doc = await self._collection.find_one(
            {
                "_id": ObjectId(item_id),
                "userId": ObjectId(user_id),
            }
        )
        return self._to_entity(doc) if doc else None

    def _to_entity(self, doc: dict[str, Any]) -> MemorizedItem:
        """Convert MongoDB document to MemorizedItem domain object."""
        source_data = doc.get("source", {})

        return MemorizedItem(
            id=str(doc["_id"]),
            userId=str(doc["userId"]),
            title=doc.get("title", "Untitled"),
            source=MemorizedItemSource(
                videoTitle=source_data.get("videoTitle", "Unknown Video"),
                youtubeUrl=source_data.get("youtubeUrl", ""),
                content=source_data.get("content", {}),
            ),
            notes=doc.get("notes"),
            createdAt=doc.get("createdAt", _utc_now()),
            updatedAt=doc.get("updatedAt", _utc_now()),
        )


class MongoChatRepository:
    """Async MongoDB repository for user chats."""

    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self._collection = db.userChats

    async def find_by_id_and_user(
        self,
        chat_id: str,
        user_id: str,
    ) -> Chat | None:
        """Find chat by ID, scoped to user."""
        if not ObjectId.is_valid(chat_id) or not ObjectId.is_valid(user_id):
            return None

        doc = await self._collection.find_one(
            {
                "_id": ObjectId(chat_id),
                "userId": ObjectId(user_id),
            }
        )
        return self._to_entity(doc) if doc else None

    async def create(
        self,
        user_id: str,
        memorized_item_id: str,
    ) -> str:
        """Create new chat session."""
        now = _utc_now()
        result = await self._collection.insert_one(
            {
                "userId": ObjectId(user_id),
                "memorizedItemId": ObjectId(memorized_item_id),
                "messages": [],
                "title": None,
                "createdAt": now,
                "updatedAt": now,
            }
        )
        return str(result.inserted_id)

    async def add_messages(
        self,
        chat_id: str,
        messages: list[dict[str, Any]],
    ) -> None:
        """Add messages to chat."""
        await self._collection.update_one(
            {"_id": ObjectId(chat_id)},
            {
                "$push": {"messages": {"$each": messages}},
                "$set": {"updatedAt": _utc_now()},
            },
        )

    def _to_entity(self, doc: dict[str, Any]) -> Chat:
        """Convert MongoDB document to Chat domain object."""
        messages = [
            ChatMessage(
                role=m["role"],
                content=m["content"],
                createdAt=m.get("createdAt", _utc_now()),
            )
            for m in doc.get("messages", [])
        ]

        return Chat(
            id=str(doc["_id"]),
            userId=str(doc["userId"]),
            memorizedItemId=str(doc["memorizedItemId"]),
            messages=messages,
            title=doc.get("title"),
            createdAt=doc.get("createdAt", _utc_now()),
            updatedAt=doc.get("updatedAt", _utc_now()),
        )
