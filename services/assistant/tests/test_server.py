"""Tests for the FastAPI server routes."""

from __future__ import annotations

import pytest
from unittest.mock import AsyncMock, patch


class TestHealthEndpoint:
    """GET /health endpoint tests."""

    async def test_should_return_200_when_service_is_healthy(self, app_client):
        # Act
        response = await app_client.get("/health")

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["service"] == "vie-assistant"

    async def test_should_include_model_info_when_healthy(self, app_client):
        # Act
        response = await app_client.get("/health")

        # Assert
        data = response.json()
        assert "model" in data


class TestChatEndpoint:
    """POST /chat endpoint tests."""

    async def test_should_return_sse_stream_when_valid_request(self, app_client):
        # Arrange
        payload = {
            "video_id": "abc123",
            "message": "What is this video about?",
        }

        # Act
        response = await app_client.post("/chat", json=payload)

        # Assert
        assert response.status_code == 200
        assert "text/event-stream" in response.headers["content-type"]

    async def test_should_return_422_when_video_id_missing(self, app_client):
        # Arrange
        payload = {"message": "hello"}

        # Act
        response = await app_client.post("/chat", json=payload)

        # Assert
        assert response.status_code == 422

    async def test_should_return_422_when_message_is_empty(self, app_client):
        # Arrange
        payload = {"video_id": "abc123", "message": ""}

        # Act
        response = await app_client.post("/chat", json=payload)

        # Assert
        assert response.status_code == 422


class TestActionEndpoint:
    """POST /action endpoint tests."""

    async def test_should_return_501_when_action_called(self, app_client):
        # Arrange
        payload = {"video_id": "abc123", "action": "quiz"}

        # Act
        response = await app_client.post("/action", json=payload)

        # Assert
        assert response.status_code == 501
