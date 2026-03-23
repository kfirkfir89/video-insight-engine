"""Tests for Qdrant vector service."""

import pytest
from unittest.mock import MagicMock, patch

from src.services.vector.qdrant_service import VectorService, COLLECTION_NAME


class TestVectorService:
    """Test VectorService with mocked Qdrant client."""

    @pytest.fixture
    def mock_client(self):
        client = MagicMock()
        # Mock get_collections to return empty list (collection needs creation)
        collection_info = MagicMock()
        collection_info.name = COLLECTION_NAME
        collections_response = MagicMock()
        collections_response.collections = [collection_info]
        client.get_collections.return_value = collections_response
        return client

    @pytest.fixture
    def service(self, mock_client):
        svc = VectorService(host="localhost", port=6333)
        svc._client = mock_client
        return svc

    def test_store_chunks_success(self, service, mock_client):
        chunks = [
            {"text": "Hello world", "start_char": 0, "end_char": 11},
            {"text": "Second chunk", "start_char": 12, "end_char": 24},
        ]
        embeddings = [[0.1] * 384, [0.2] * 384]

        result = service.store_chunks("video123", chunks, embeddings)

        assert result is True
        mock_client.upsert.assert_called_once()
        call_args = mock_client.upsert.call_args
        assert call_args[1]["collection_name"] == COLLECTION_NAME
        assert len(call_args[1]["points"]) == 2

    def test_store_chunks_failure(self, service, mock_client):
        mock_client.upsert.side_effect = Exception("Connection failed")

        result = service.store_chunks("video123", [{"text": "hi"}], [[0.1] * 384])

        assert result is False

    def test_search_success(self, service, mock_client):
        mock_result = MagicMock()
        mock_result.payload = {
            "text": "Hello world",
            "video_id": "video123",
            "chunk_index": 0,
        }
        mock_result.score = 0.95
        mock_client.search.return_value = [mock_result]

        results = service.search([0.1] * 384, video_id="video123", limit=5)

        assert len(results) == 1
        assert results[0]["text"] == "Hello world"
        assert results[0]["score"] == 0.95

    def test_search_with_video_filter(self, service, mock_client):
        mock_client.search.return_value = []

        service.search([0.1] * 384, video_id="video123")

        call_args = mock_client.search.call_args
        assert call_args[1]["query_filter"] is not None

    def test_search_without_filter(self, service, mock_client):
        mock_client.search.return_value = []

        service.search([0.1] * 384)

        call_args = mock_client.search.call_args
        assert call_args[1]["query_filter"] is None

    def test_search_failure_returns_empty(self, service, mock_client):
        mock_client.search.side_effect = Exception("Timeout")

        results = service.search([0.1] * 384)

        assert results == []

    def test_search_multi_video(self, service, mock_client):
        mock_client.search.return_value = []

        service.search_multi_video([0.1] * 384, ["v1", "v2"], limit=10)

        call_args = mock_client.search.call_args
        assert call_args[1]["query_filter"] is not None
        assert call_args[1]["limit"] == 10

    def test_delete_video_success(self, service, mock_client):
        result = service.delete_video("video123")

        assert result is True
        mock_client.delete.assert_called_once()

    def test_delete_video_failure(self, service, mock_client):
        mock_client.delete.side_effect = Exception("Error")

        result = service.delete_video("video123")

        assert result is False
