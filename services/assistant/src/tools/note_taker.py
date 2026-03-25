"""Note taker tool — save notes and bookmarks about a video."""

from __future__ import annotations

from src.exceptions import ValidationError
from src.logging_config import get_logger
from src.repositories.notes_repository import NotesRepository

logger = get_logger(__name__)

_MAX_NOTE_LENGTH = 5000


class NoteTakerTool:
    """Save a note or bookmark about the video."""

    name = "note_taker"
    description = "Save a note or bookmark about the video"

    def __init__(self, notes_repo: NotesRepository) -> None:
        self._notes_repo = notes_repo

    async def execute(self, params: dict, context: dict) -> dict:
        """Save a note to MongoDB.

        Args:
            params: Must contain ``text`` (str). Optional ``timestamp`` (str).
            context: Must contain ``video_id`` (str). Optional ``user_id`` (str).

        Returns:
            Dict with ``saved`` (bool) and ``note_id`` (str).

        Raises:
            ValidationError: If note text is empty or too long.
        """
        text: str = params.get("text", "").strip()
        timestamp: str | None = params.get("timestamp")
        video_id: str = context["video_id"]
        user_id: str | None = context.get("user_id")

        if not text:
            raise ValidationError("Note text cannot be empty")
        if len(text) > _MAX_NOTE_LENGTH:
            raise ValidationError(
                f"Note text exceeds maximum length of {_MAX_NOTE_LENGTH} characters"
            )

        logger.info(
            "note_taker_save",
            video_id=video_id,
            text_len=len(text),
            has_timestamp=timestamp is not None,
        )

        note_id = await self._notes_repo.create(
            video_id=video_id,
            text=text,
            user_id=user_id,
            timestamp=timestamp,
        )

        logger.info("note_taker_saved", note_id=note_id, video_id=video_id)
        return {"saved": True, "note_id": note_id}
