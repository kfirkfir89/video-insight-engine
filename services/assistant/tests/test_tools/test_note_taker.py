"""Tests for the note taker tool."""

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from src.exceptions import ValidationError
from src.tools.note_taker import NoteTakerTool


class TestNoteTaker:
    """Note taker tool tests."""

    async def test_should_save_note_and_return_id(self) -> None:
        """Should save a note via the repo and return saved=True with note_id."""
        # Arrange
        notes_repo = AsyncMock()
        notes_repo.create.return_value = "note-abc-123"

        tool = NoteTakerTool(notes_repo=notes_repo)
        params = {"text": "This part about attention was really insightful."}
        context = {"video_id": "yt1", "user_id": "user42"}

        # Act
        result = await tool.execute(params, context)

        # Assert
        assert result["saved"] is True
        assert result["note_id"] == "note-abc-123"
        notes_repo.create.assert_awaited_once_with(
            video_id="yt1",
            text="This part about attention was really insightful.",
            user_id="user42",
            timestamp=None,
        )

    async def test_should_include_timestamp_when_provided(self) -> None:
        """Should pass the timestamp to the repository when provided in params."""
        # Arrange
        notes_repo = AsyncMock()
        notes_repo.create.return_value = "note-def-456"

        tool = NoteTakerTool(notes_repo=notes_repo)
        params = {"text": "Key formula shown here.", "timestamp": "5:30"}
        context = {"video_id": "yt1"}

        # Act
        result = await tool.execute(params, context)

        # Assert
        assert result["saved"] is True
        notes_repo.create.assert_awaited_once_with(
            video_id="yt1",
            text="Key formula shown here.",
            user_id=None,
            timestamp="5:30",
        )

    async def test_should_validate_empty_text(self) -> None:
        """Should raise ValidationError when note text is empty or whitespace."""
        # Arrange
        notes_repo = AsyncMock()
        tool = NoteTakerTool(notes_repo=notes_repo)
        params = {"text": "   "}
        context = {"video_id": "yt1"}

        # Act & Assert
        with pytest.raises(ValidationError, match="empty"):
            await tool.execute(params, context)

        # Repo should never be called
        notes_repo.create.assert_not_awaited()

    async def test_should_pass_video_id_to_repo(self) -> None:
        """Should forward the video_id from context to the repository create call."""
        # Arrange
        notes_repo = AsyncMock()
        notes_repo.create.return_value = "note-ghi-789"

        tool = NoteTakerTool(notes_repo=notes_repo)
        params = {"text": "Bookmark this section."}
        context = {"video_id": "special-video-id"}

        # Act
        await tool.execute(params, context)

        # Assert
        call_kwargs = notes_repo.create.call_args.kwargs
        assert call_kwargs["video_id"] == "special-video-id"
