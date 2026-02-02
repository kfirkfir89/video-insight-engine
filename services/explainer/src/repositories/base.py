"""Repository protocol definitions for vie-explainer service.

These protocols define the interface for data access, allowing different
implementations (MongoDB, in-memory for testing, etc.) to be swapped.
"""

from typing import Any, Protocol, runtime_checkable

from src.schemas import Chat, Expansion, MemorizedItem, VideoSummary


@runtime_checkable
class VideoSummaryRepositoryProtocol(Protocol):
    """Interface for video summary data access (read-only)."""

    async def find_by_id(self, video_summary_id: str) -> VideoSummary | None:
        """Find video summary by ID.

        Args:
            video_summary_id: MongoDB ObjectId string

        Returns:
            VideoSummary domain object or None if not found
        """
        ...


@runtime_checkable
class ExpansionRepositoryProtocol(Protocol):
    """Interface for expansion cache data access."""

    async def find_by_target(
        self,
        video_summary_id: str,
        target_type: str,
        target_id: str,
    ) -> Expansion | None:
        """Find cached expansion for a specific target.

        Args:
            video_summary_id: MongoDB ObjectId string
            target_type: "section" or "concept"
            target_id: UUID of the section or concept

        Returns:
            Expansion domain object or None if not found
        """
        ...

    async def save(
        self,
        video_summary_id: str,
        target_type: str,
        target_id: str,
        context: dict[str, Any],
        content: str,
        model: str,
    ) -> str:
        """Save expansion to cache.

        Args:
            video_summary_id: MongoDB ObjectId string
            target_type: "section" or "concept"
            target_id: UUID of the section or concept
            context: Context data used for generation
            content: Generated markdown content
            model: Model used for generation

        Returns:
            ObjectId string of the inserted document
        """
        ...


@runtime_checkable
class MemorizedItemRepositoryProtocol(Protocol):
    """Interface for memorized item data access (read-only, user-scoped)."""

    async def find_by_id_and_user(
        self,
        item_id: str,
        user_id: str,
    ) -> MemorizedItem | None:
        """Find memorized item by ID, scoped to user.

        Args:
            item_id: MongoDB ObjectId string
            user_id: MongoDB ObjectId string

        Returns:
            MemorizedItem domain object or None if not found/unauthorized
        """
        ...


@runtime_checkable
class ChatRepositoryProtocol(Protocol):
    """Interface for user chat data access."""

    async def find_by_id_and_user(
        self,
        chat_id: str,
        user_id: str,
    ) -> Chat | None:
        """Find chat by ID, scoped to user.

        Args:
            chat_id: MongoDB ObjectId string
            user_id: MongoDB ObjectId string

        Returns:
            Chat domain object or None if not found/unauthorized
        """
        ...

    async def create(
        self,
        user_id: str,
        memorized_item_id: str,
    ) -> str:
        """Create new chat session.

        Args:
            user_id: MongoDB ObjectId string
            memorized_item_id: MongoDB ObjectId string

        Returns:
            ObjectId string of the created chat
        """
        ...

    async def add_messages(
        self,
        chat_id: str,
        messages: list[dict[str, Any]],
    ) -> None:
        """Add messages to chat.

        Args:
            chat_id: MongoDB ObjectId string
            messages: List of message dicts with role, content, createdAt
        """
        ...
