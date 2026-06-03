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

    async def test_should_forward_user_and_session_headers_to_service(self):
        """``X-User-Id`` / ``X-Session-Id`` must reach ``AssistantService.chat`` so
        Langfuse session traces can group turns under one user/session."""
        from httpx import ASGITransport, AsyncClient
        from src.server import app

        captured: dict = {}

        async def _spy_chat(*, video_id, message, history, user_id, session_id, **_):
            captured["video_id"] = video_id
            captured["message"] = message
            captured["history"] = history
            captured["user_id"] = user_id
            captured["session_id"] = session_id
            yield 'data: {"type": "done", "content": ""}\n\n'

        from unittest.mock import AsyncMock

        spy_service = AsyncMock()
        spy_service.chat = _spy_chat
        app.state.assistant_service = spy_service

        transport = ASGITransport(app=app)
        try:
            async with AsyncClient(
                transport=transport,
                base_url="http://test",
                headers={
                    "X-Internal-Secret": "dev-internal-secret-change-me",
                    "X-User-Id": "user-42",
                    "X-Session-Id": "sess-abc",
                },
            ) as client:
                resp = await client.post(
                    "/chat",
                    json={"video_id": "abc123", "message": "hello"},
                )
                assert resp.status_code == 200
                # Drain stream so the generator body runs and captured[] is populated.
                _ = resp.content
        finally:
            app.state.assistant_service = None

        assert captured.get("user_id") == "user-42"
        assert captured.get("session_id") == "sess-abc"
        assert captured.get("video_id") == "abc123"


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


class TestLibraryChatEndpoint:
    """POST /library/chat endpoint tests."""

    async def test_should_return_sse_stream_when_valid_request(self, app_client):
        # Arrange — the conftest AsyncMock returns a coroutine, not a generator,
        # so install a real async-generator library_chat for streaming.
        from src.server import app

        async def _mock_library_chat(*_args, **_kwargs):
            yield 'data: {"type": "text", "content": "Across your library"}\n\n'
            yield 'data: {"type": "done", "content": ""}\n\n'

        app.state.assistant_service.library_chat = _mock_library_chat

        payload = {"video_ids": ["v1", "v2"], "message": "What did I learn?"}

        # Act
        response = await app_client.post("/library/chat", json=payload)

        # Assert
        assert response.status_code == 200
        assert "text/event-stream" in response.headers["content-type"]

    async def test_should_allow_empty_video_ids(self, app_client):
        # Arrange
        from src.server import app

        async def _mock_library_chat(*_args, **_kwargs):
            yield 'data: {"type": "done", "content": ""}\n\n'

        app.state.assistant_service.library_chat = _mock_library_chat

        payload = {"video_ids": [], "message": "Anything?"}

        # Act
        response = await app_client.post("/library/chat", json=payload)

        # Assert — empty list is allowed (degrades to no-context reply).
        assert response.status_code == 200

    async def test_should_forward_ids_message_and_headers_to_service(self):
        """``video_ids``/``X-User-Id``/``X-Session-Id`` must reach
        ``AssistantService.library_chat``."""
        from httpx import ASGITransport, AsyncClient
        from src.server import app

        captured: dict = {}

        async def _spy_library_chat(*, video_ids, message, history, user_id, session_id, **_):
            captured["video_ids"] = video_ids
            captured["message"] = message
            captured["user_id"] = user_id
            captured["session_id"] = session_id
            yield 'data: {"type": "done", "content": ""}\n\n'

        spy_service = AsyncMock()
        spy_service.library_chat = _spy_library_chat
        app.state.assistant_service = spy_service

        transport = ASGITransport(app=app)
        try:
            async with AsyncClient(
                transport=transport,
                base_url="http://test",
                headers={
                    "X-Internal-Secret": "dev-internal-secret-change-me",
                    "X-User-Id": "user-77",
                    "X-Session-Id": "sess-xyz",
                },
            ) as client:
                resp = await client.post(
                    "/library/chat",
                    json={"video_ids": ["v1", "v2"], "message": "compare them"},
                )
                assert resp.status_code == 200
                _ = resp.content
        finally:
            app.state.assistant_service = None

        assert captured.get("video_ids") == ["v1", "v2"]
        assert captured.get("message") == "compare them"
        assert captured.get("user_id") == "user-77"
        assert captured.get("session_id") == "sess-xyz"

    async def test_should_return_422_when_message_missing(self, app_client):
        payload = {"video_ids": ["v1"]}
        response = await app_client.post("/library/chat", json=payload)
        assert response.status_code == 422

    async def test_should_return_422_when_too_many_video_ids(self, app_client):
        payload = {"video_ids": [f"v{i}" for i in range(201)], "message": "hi"}
        response = await app_client.post("/library/chat", json=payload)
        assert response.status_code == 422

    async def test_should_return_422_when_video_id_invalid_chars(self, app_client):
        payload = {"video_ids": ["bad/id"], "message": "hi"}
        response = await app_client.post("/library/chat", json=payload)
        assert response.status_code == 422

    async def test_should_return_403_when_internal_secret_wrong(self, app_client):
        payload = {"video_ids": ["v1"], "message": "hi"}
        response = await app_client.post(
            "/library/chat",
            json=payload,
            headers={"X-Internal-Secret": "wrong-secret"},
        )
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
