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
    """POST /action endpoint tests — see test_action.py for richer coverage."""

    async def test_should_return_422_when_action_is_invalid(self, app_client):
        # Arrange
        payload = {"video_id": "abc123", "action": "unknown_action"}

        # Act
        response = await app_client.post("/action", json=payload)

        # Assert
        assert response.status_code == 422

    async def test_should_return_403_when_internal_secret_wrong(self, app_client):
        # Arrange
        payload = {"video_id": "abc123", "action": "save_note", "params": {"text": "hi"}}

        # Act
        response = await app_client.post(
            "/action",
            json=payload,
            headers={"X-Internal-Secret": "bad"},
        )

        # Assert
        assert response.status_code == 403


class TestLibrarySearchEndpoint:
    """POST /library/search endpoint tests."""

    async def test_should_return_200_with_ranked_results_when_valid(self, app_client, mock_rag):
        # Arrange
        from src.models.responses import RAGSource
        mock_rag.search_library = AsyncMock(return_value=[
            RAGSource(text="A neural network has layers.", video_id="v1", score=0.9, chunk_index=0),
            RAGSource(text="Backpropagation computes gradients.", video_id="v2", score=0.8, chunk_index=1),
        ])
        payload = {
            "video_ids": ["v1", "v2"],
            "query": "neural networks",
            "top_k": 5,
        }

        # Act
        response = await app_client.post("/library/search", json=payload)

        # Assert
        assert response.status_code == 200
        body = response.json()
        assert "results" in body
        assert len(body["results"]) == 2
        assert {r["video_id"] for r in body["results"]} == {"v1", "v2"}

    async def test_should_pass_sources_filter_to_rag(self, app_client, mock_rag):
        # Arrange
        mock_rag.search_library = AsyncMock(return_value=[])
        payload = {
            "video_ids": ["v1"],
            "query": "anything",
            "sources": ["default_output"],
        }

        # Act
        response = await app_client.post("/library/search", json=payload)

        # Assert
        assert response.status_code == 200
        mock_rag.search_library.assert_called_once()
        kwargs = mock_rag.search_library.call_args.kwargs
        assert kwargs["sources"] == ["default_output"]

    async def test_should_return_422_when_video_ids_empty(self, app_client):
        payload = {"video_ids": [], "query": "anything"}
        response = await app_client.post("/library/search", json=payload)
        assert response.status_code == 422

    async def test_should_return_422_when_query_missing(self, app_client):
        payload = {"video_ids": ["v1"]}
        response = await app_client.post("/library/search", json=payload)
        assert response.status_code == 422

    async def test_should_return_422_when_top_k_too_large(self, app_client):
        payload = {"video_ids": ["v1"], "query": "x", "top_k": 999}
        response = await app_client.post("/library/search", json=payload)
        assert response.status_code == 422

    async def test_should_return_422_when_video_id_invalid_chars(self, app_client):
        payload = {"video_ids": ["bad/id"], "query": "x"}
        response = await app_client.post("/library/search", json=payload)
        assert response.status_code == 422

    async def test_should_return_403_when_internal_secret_missing(self, app_client):
        payload = {"video_ids": ["v1"], "query": "x"}
        response = await app_client.post(
            "/library/search",
            json=payload,
            headers={"X-Internal-Secret": "wrong-secret"},
        )
        assert response.status_code == 403
