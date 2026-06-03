"""Tests for the video generator tool."""

from __future__ import annotations

import pytest

from src.exceptions import ValidationError
from src.tools.video_generator import VideoGeneratorTool


class TestVideoGenerator:
    """VideoGeneratorTool forwards url + optional folder to the api_client."""

    async def test_should_generate_video_via_api(self, mock_api_client) -> None:
        # Arrange
        tool = VideoGeneratorTool(api_client=mock_api_client)
        params = {"url": "https://youtu.be/abc"}
        context = {"user_id": "user42"}

        # Act
        result = await tool.execute(params, context)

        # Assert
        assert result["started"] is True
        assert result["video"] == {"videoSummaryId": "vs-1", "status": "processing"}
        mock_api_client.generate_video.assert_awaited_once_with(
            "user42", "https://youtu.be/abc", None
        )

    async def test_should_pass_folder_id_when_present(self, mock_api_client) -> None:
        # Arrange
        tool = VideoGeneratorTool(api_client=mock_api_client)
        params = {"url": "https://youtu.be/abc", "folder_id": "f1"}
        context = {"user_id": "user42"}

        # Act
        await tool.execute(params, context)

        # Assert
        mock_api_client.generate_video.assert_awaited_once_with(
            "user42", "https://youtu.be/abc", "f1"
        )

    async def test_should_raise_when_user_id_missing(self, mock_api_client) -> None:
        # Arrange
        tool = VideoGeneratorTool(api_client=mock_api_client)

        # Act & Assert
        with pytest.raises(ValidationError, match="authenticated user"):
            await tool.execute({"url": "https://youtu.be/abc"}, {})
        mock_api_client.generate_video.assert_not_awaited()

    async def test_should_raise_when_url_missing(self, mock_api_client) -> None:
        # Arrange
        tool = VideoGeneratorTool(api_client=mock_api_client)

        # Act & Assert
        with pytest.raises(ValidationError, match="requires param 'url'"):
            await tool.execute({}, {"user_id": "user42"})
        mock_api_client.generate_video.assert_not_awaited()
