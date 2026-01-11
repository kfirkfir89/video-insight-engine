"""MongoDB service for vie-explainer."""

import logging
from datetime import datetime, timezone
from typing import Any

from bson import ObjectId
from pymongo import MongoClient
from pymongo.database import Database

from src.config import settings

logger = logging.getLogger(__name__)


def _utc_now() -> datetime:
    """Get current UTC time in timezone-aware format."""
    return datetime.now(timezone.utc)


# Database connection (singleton pattern with lifecycle management)
_client: MongoClient | None = None


def get_mongo_client() -> MongoClient:
    """Get or create MongoDB client."""
    global _client
    if _client is None:
        logger.info("Creating MongoDB client connection")
        _client = MongoClient(settings.MONGODB_URI)
    return _client


def get_database() -> Database:
    """Get database instance, creating connection if needed."""
    return get_mongo_client().get_default_database()


def close_connection() -> None:
    """Close MongoDB connection (call on shutdown)."""
    global _client
    if _client is not None:
        logger.info("Closing MongoDB client connection")
        _client.close()
        _client = None


# ============================================================
# Video Summary Cache (read-only)
# ============================================================


def get_video_summary(video_summary_id: str) -> dict | None:
    """Get video summary from cache.

    Args:
        video_summary_id: ObjectId string of the video summary

    Returns:
        Video summary document or None if not found
    """
    db = get_database()
    return db.videoSummaryCache.find_one({"_id": ObjectId(video_summary_id)})


# ============================================================
# System Expansion Cache (read/write)
# ============================================================


def get_expansion(
    video_summary_id: str,
    target_type: str,
    target_id: str,
) -> dict | None:
    """Get cached expansion.

    Args:
        video_summary_id: ObjectId string of the video summary
        target_type: "section" or "concept"
        target_id: UUID of the section or concept

    Returns:
        Expansion document or None if not found
    """
    db = get_database()
    return db.systemExpansionCache.find_one(
        {
            "videoSummaryId": ObjectId(video_summary_id),
            "targetType": target_type,
            "targetId": target_id,
            "status": "completed",
        }
    )


def save_expansion(
    video_summary_id: str,
    target_type: str,
    target_id: str,
    context: dict[str, Any],
    content: str,
    model: str,
) -> str:
    """Save expansion to cache.

    Args:
        video_summary_id: ObjectId string of the video summary
        target_type: "section" or "concept"
        target_id: UUID of the section or concept
        context: Context data used for generation
        content: Generated markdown content
        model: Model used for generation

    Returns:
        ObjectId string of the inserted document
    """
    db = get_database()
    now = _utc_now()
    result = db.systemExpansionCache.insert_one(
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


# ============================================================
# Memorized Items (read-only, user-scoped)
# ============================================================


def get_memorized_item(item_id: str, user_id: str) -> dict | None:
    """Get memorized item for user.

    Args:
        item_id: ObjectId string of the memorized item
        user_id: ObjectId string of the user

    Returns:
        Memorized item document or None if not found/unauthorized
    """
    db = get_database()
    return db.memorizedItems.find_one(
        {
            "_id": ObjectId(item_id),
            "userId": ObjectId(user_id),
        }
    )


# ============================================================
# User Chats (read/write, user-scoped)
# ============================================================


def get_chat(chat_id: str, user_id: str) -> dict | None:
    """Get chat by ID.

    Args:
        chat_id: ObjectId string of the chat
        user_id: ObjectId string of the user

    Returns:
        Chat document or None if not found/unauthorized
    """
    db = get_database()
    return db.userChats.find_one(
        {
            "_id": ObjectId(chat_id),
            "userId": ObjectId(user_id),
        }
    )


def create_chat(user_id: str, memorized_item_id: str) -> str:
    """Create new chat.

    Args:
        user_id: ObjectId string of the user
        memorized_item_id: ObjectId string of the memorized item

    Returns:
        ObjectId string of the created chat
    """
    db = get_database()
    now = _utc_now()
    result = db.userChats.insert_one(
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


def add_messages(chat_id: str, messages: list[dict]) -> None:
    """Add messages to chat.

    Args:
        chat_id: ObjectId string of the chat
        messages: List of message dicts with role, content, createdAt
    """
    db = get_database()
    db.userChats.update_one(
        {"_id": ObjectId(chat_id)},
        {
            "$push": {"messages": {"$each": messages}},
            "$set": {"updatedAt": _utc_now()},
        },
    )
