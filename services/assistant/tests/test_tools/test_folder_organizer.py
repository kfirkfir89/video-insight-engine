"""Tests for the folder organizer tool."""

from __future__ import annotations

import pytest

from src.exceptions import ValidationError
from src.tools.folder_organizer import FolderOrganizerTool


class TestFolderOrganizer:
    """FolderOrganizerTool branches on context['action'] to the api_client."""

    async def test_should_create_folder_via_api(self, mock_api_client) -> None:
        # Arrange
        tool = FolderOrganizerTool(api_client=mock_api_client)
        params = {"name": "Recipes", "color": "blue"}
        context = {"user_id": "user42", "action": "create_folder"}

        # Act
        result = await tool.execute(params, context)

        # Assert
        assert result["created"] is True
        mock_api_client.create_folder.assert_awaited_once_with(
            "user42", "Recipes", color="blue", icon=None, parentId=None
        )

    async def test_should_rename_folder_via_update(self, mock_api_client) -> None:
        # Arrange
        tool = FolderOrganizerTool(api_client=mock_api_client)
        context = {"user_id": "user42", "action": "rename_folder"}

        # Act
        result = await tool.execute({"folder_id": "f1", "name": "New"}, context)

        # Assert
        assert result["renamed"] is True
        mock_api_client.update_folder.assert_awaited_once_with("user42", "f1", name="New")

    async def test_should_move_folder_under_parent(self, mock_api_client) -> None:
        # Arrange
        tool = FolderOrganizerTool(api_client=mock_api_client)
        context = {"user_id": "user42", "action": "move_folder"}

        # Act
        await tool.execute({"folder_id": "f1", "parent_id": "p1"}, context)

        # Assert
        mock_api_client.move_folder.assert_awaited_once_with("user42", "f1", "p1")

    async def test_should_move_folder_to_root_when_parent_absent(self, mock_api_client) -> None:
        # Arrange — no parent_id means "move to the top level"
        tool = FolderOrganizerTool(api_client=mock_api_client)
        context = {"user_id": "user42", "action": "move_folder"}

        # Act
        result = await tool.execute({"folder_id": "f1"}, context)

        # Assert — parent_id forwarded as None (explicit null), not dropped
        assert result["moved"] is True
        mock_api_client.move_folder.assert_awaited_once_with("user42", "f1", None)

    async def test_should_delete_folder_via_api(self, mock_api_client) -> None:
        # Arrange
        tool = FolderOrganizerTool(api_client=mock_api_client)
        context = {"user_id": "user42", "action": "delete_folder"}

        # Act
        result = await tool.execute({"folder_id": "f1", "delete_content": True}, context)

        # Assert
        assert result["deleted"] is True
        mock_api_client.delete_folder.assert_awaited_once_with(
            "user42", "f1", delete_content=True
        )

    async def test_should_move_video_via_api(self, mock_api_client) -> None:
        # Arrange
        tool = FolderOrganizerTool(api_client=mock_api_client)
        context = {"user_id": "user42", "action": "move_video"}

        # Act
        result = await tool.execute({"video_id": "v1", "folder_id": "f1"}, context)

        # Assert
        assert result["moved"] is True
        mock_api_client.move_video.assert_awaited_once_with("user42", "v1", "f1")

    async def test_should_raise_when_user_id_missing(self, mock_api_client) -> None:
        # Arrange
        tool = FolderOrganizerTool(api_client=mock_api_client)
        context = {"action": "create_folder"}

        # Act & Assert
        with pytest.raises(ValidationError, match="authenticated user"):
            await tool.execute({"name": "x"}, context)
        mock_api_client.create_folder.assert_not_awaited()

    async def test_should_raise_when_required_param_missing(self, mock_api_client) -> None:
        # Arrange
        tool = FolderOrganizerTool(api_client=mock_api_client)
        context = {"user_id": "user42", "action": "rename_folder"}

        # Act & Assert — folder_id present but name missing
        with pytest.raises(ValidationError, match="requires param 'name'"):
            await tool.execute({"folder_id": "f1"}, context)

    async def test_should_raise_for_unhandled_action(self, mock_api_client) -> None:
        # Arrange
        tool = FolderOrganizerTool(api_client=mock_api_client)
        context = {"user_id": "user42", "action": "save_note"}

        # Act & Assert
        with pytest.raises(ValidationError, match="cannot handle action"):
            await tool.execute({}, context)
