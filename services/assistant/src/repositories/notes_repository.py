"""MongoDB repository for assistant notes CRUD."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from uuid import uuid4

from motor.motor_asyncio import AsyncIOMotorDatabase

from src.logging_config import get_logger

logger = get_logger(__name__)


@dataclass
class Note:
    """A saved note or bookmark about a video."""

    id: str
    video_id: str
    user_id: str | None
    text: str
    timestamp: str | None
    created_at: datetime


class NotesRepository:
    """CRUD operations for assistant notes in MongoDB."""

    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self._collection = db["agentNotes"]

    async def create(
        self,
        video_id: str,
        text: str,
        user_id: str | None = None,
        timestamp: str | None = None,
    ) -> str:
        """Create a new note.

        Args:
            video_id: Video the note belongs to.
            text: Note content.
            user_id: Optional user who created the note.
            timestamp: Optional video timestamp reference.

        Returns:
            The generated note ID.
        """
        note_id = str(uuid4())
        doc = {
            "_id": note_id,
            "videoId": video_id,
            "userId": user_id,
            "text": text,
            "timestamp": timestamp,
            "createdAt": datetime.now(timezone.utc),
        }

        try:
            await self._collection.insert_one(doc)
            logger.info("note_created", note_id=note_id, video_id=video_id)
        except Exception:
            logger.exception("note_create_failed", video_id=video_id)
            raise

        return note_id

    async def list_by_video(
        self,
        video_id: str,
        user_id: str | None = None,
    ) -> list[Note]:
        """List notes for a video, optionally filtered by user.

        Args:
            video_id: Video to list notes for.
            user_id: Optional user filter.

        Returns:
            List of Note objects sorted by creation time descending.
        """
        query: dict = {"videoId": video_id}
        if user_id is not None:
            query["userId"] = user_id

        try:
            cursor = self._collection.find(query).sort("createdAt", -1)
            docs = await cursor.to_list(length=100)
            return [self._to_entity(doc) for doc in docs]
        except Exception:
            logger.exception("note_list_failed", video_id=video_id)
            return []

    async def delete(self, note_id: str) -> bool:
        """Delete a note by ID.

        Args:
            note_id: The note ID to delete.

        Returns:
            True if deleted, False if not found.
        """
        try:
            result = await self._collection.delete_one({"_id": note_id})
            deleted = result.deleted_count > 0
            if deleted:
                logger.info("note_deleted", note_id=note_id)
            return deleted
        except Exception:
            logger.exception("note_delete_failed", note_id=note_id)
            return False

    def _to_entity(self, doc: dict) -> Note:
        """Convert a MongoDB document to a Note dataclass."""
        return Note(
            id=str(doc["_id"]),
            video_id=doc.get("videoId", ""),
            user_id=doc.get("userId"),
            text=doc.get("text", ""),
            timestamp=doc.get("timestamp"),
            created_at=doc.get("createdAt", datetime.now(timezone.utc)),
        )
