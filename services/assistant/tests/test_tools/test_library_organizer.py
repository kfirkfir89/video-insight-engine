"""Tests for the library organizer tool."""

from __future__ import annotations

import json
from unittest.mock import AsyncMock

import pytest

from src.exceptions import ValidationError
from src.tools.library_organizer import LibraryOrganizerTool


def _make_llm(proposal: dict) -> AsyncMock:
    """Build a mock LLM whose completion returns *proposal* as JSON."""
    llm = AsyncMock()
    llm.complete_with_messages = AsyncMock(return_value=json.dumps(proposal))
    return llm


class TestLibraryOrganizer:
    """LibraryOrganizerTool: list -> LLM proposal -> create + move."""

    async def test_should_create_folders_and_move_videos(self, mock_api_client) -> None:
        # Arrange
        mock_api_client.list_videos.return_value = [
            {"id": "v1", "title": "Pasta"},
            {"id": "v2", "title": "Neural nets"},
        ]
        mock_api_client.list_folders.return_value = []
        mock_api_client.create_folder.return_value = {"id": "folder-9", "name": "Food"}
        llm = _make_llm({"folders": [{"name": "Food", "videoIds": ["v1"]}]})
        tool = LibraryOrganizerTool(api_client=mock_api_client, llm=llm)

        # Act
        result = await tool.execute({}, {"user_id": "user42"})

        # Assert
        assert result == {"folders_created": 1, "videos_moved": 1}
        mock_api_client.create_folder.assert_awaited_once_with("user42", "Food")
        mock_api_client.move_video.assert_awaited_once_with("user42", "v1", "folder-9")

    async def test_should_parse_markdown_fenced_llm_json(self, mock_api_client) -> None:
        # Regression (found in live E2E): Sonnet wraps its JSON in a ```json ...
        # ``` markdown fence, which a bare json.loads rejected -> 0 folders created.
        mock_api_client.list_videos.return_value = [{"id": "v1", "title": "Pasta"}]
        mock_api_client.list_folders.return_value = []
        mock_api_client.create_folder.return_value = {"id": "folder-9", "name": "Food"}
        llm = AsyncMock()
        llm.complete_with_messages = AsyncMock(
            return_value='```json\n{\n  "folders": [{"name": "Food", "videoIds": ["v1"]}]\n}\n```'
        )
        tool = LibraryOrganizerTool(api_client=mock_api_client, llm=llm)

        result = await tool.execute({}, {"user_id": "user42"})

        assert result == {"folders_created": 1, "videos_moved": 1}
        mock_api_client.create_folder.assert_awaited_once_with("user42", "Food")

    async def test_should_skip_unknown_video_ids_from_llm(self, mock_api_client) -> None:
        # Arrange — LLM hallucinates an id not in the library
        mock_api_client.list_videos.return_value = [{"id": "v1", "title": "Pasta"}]
        mock_api_client.create_folder.return_value = {"id": "folder-9", "name": "Food"}
        llm = _make_llm({"folders": [{"name": "Food", "videoIds": ["v1", "ghost"]}]})
        tool = LibraryOrganizerTool(api_client=mock_api_client, llm=llm)

        # Act
        result = await tool.execute({}, {"user_id": "user42"})

        # Assert — only the real id is moved
        assert result == {"folders_created": 1, "videos_moved": 1}
        mock_api_client.move_video.assert_awaited_once_with("user42", "v1", "folder-9")

    async def test_should_noop_when_no_videos(self, mock_api_client) -> None:
        # Arrange
        mock_api_client.list_videos.return_value = []
        llm = _make_llm({"folders": []})
        tool = LibraryOrganizerTool(api_client=mock_api_client, llm=llm)

        # Act
        result = await tool.execute({}, {"user_id": "user42"})

        # Assert
        assert result == {"folders_created": 0, "videos_moved": 0}
        llm.complete_with_messages.assert_not_awaited()
        mock_api_client.create_folder.assert_not_awaited()

    async def test_should_skip_buckets_with_no_valid_videos(self, mock_api_client) -> None:
        # Arrange
        mock_api_client.list_videos.return_value = [{"id": "v1", "title": "Pasta"}]
        llm = _make_llm({"folders": [{"name": "Empty", "videoIds": []}]})
        tool = LibraryOrganizerTool(api_client=mock_api_client, llm=llm)

        # Act
        result = await tool.execute({}, {"user_id": "user42"})

        # Assert
        assert result == {"folders_created": 0, "videos_moved": 0}
        mock_api_client.create_folder.assert_not_awaited()

    async def test_should_return_zero_on_unparseable_llm_output(self, mock_api_client) -> None:
        # Arrange
        mock_api_client.list_videos.return_value = [{"id": "v1", "title": "Pasta"}]
        llm = AsyncMock()
        llm.complete_with_messages = AsyncMock(return_value="not json at all")
        tool = LibraryOrganizerTool(api_client=mock_api_client, llm=llm)

        # Act
        result = await tool.execute({}, {"user_id": "user42"})

        # Assert
        assert result == {"folders_created": 0, "videos_moved": 0}

    async def test_should_raise_when_user_id_missing(self, mock_api_client) -> None:
        # Arrange
        tool = LibraryOrganizerTool(api_client=mock_api_client, llm=AsyncMock())

        # Act & Assert
        with pytest.raises(ValidationError, match="authenticated user"):
            await tool.execute({}, {})
        mock_api_client.list_videos.assert_not_awaited()
