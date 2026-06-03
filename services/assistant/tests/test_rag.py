"""Tests for RAGService — semantic search over Qdrant."""

from __future__ import annotations

import numpy as np
import pytest
from unittest.mock import MagicMock, patch


@pytest.fixture
def qdrant_mock():
    """Sync MagicMock (not AsyncMock) — QdrantRepository.search is sync."""
    repo = MagicMock()
    repo.search.return_value = [
        {"text": "A neural network consists of layers.", "video_id": "abc123", "timestamp": "0:45", "score": 0.92, "chunk_index": 0, "source": "transcript"},
        {"text": "Backpropagation computes the gradient.", "video_id": "abc123", "timestamp": "2:00", "score": 0.87, "chunk_index": 1, "source": "transcript"},
        {"text": "Each layer applies a non-linear activation.", "video_id": "abc123", "timestamp": "3:20", "score": 0.81, "chunk_index": 2, "source": "transcript"},
    ]
    return repo


class TestRAGSearch:

    async def test_should_return_results(self, qdrant_mock):
        from src.services.rag import RAGService
        rag = RAGService(qdrant_repo=qdrant_mock)
        with patch.object(rag, "_encode", return_value=[0.0] * 384), \
             patch.object(rag, "_get_model", return_value=MagicMock()):
            results = await rag.search(query="neural networks", video_id="abc123")
        assert len(results) > 0

    async def test_should_pass_video_id_as_list(self, qdrant_mock):
        from src.services.rag import RAGService
        rag = RAGService(qdrant_repo=qdrant_mock)
        with patch.object(rag, "_encode", return_value=[0.0] * 384), \
             patch.object(rag, "_get_model", return_value=MagicMock()):
            await rag.search(query="test", video_id="vid_42")
        assert qdrant_mock.search.call_args.kwargs["video_ids"] == ["vid_42"]

    async def test_should_return_empty_when_no_chunks(self):
        from src.services.rag import RAGService
        empty_repo = MagicMock()
        empty_repo.search.return_value = []
        rag = RAGService(qdrant_repo=empty_repo)
        with patch.object(rag, "_encode", return_value=[0.0] * 384), \
             patch.object(rag, "_get_model", return_value=MagicMock()):
            results = await rag.search(query="nonexistent", video_id="abc123")
        assert results == []

    async def test_should_respect_top_k(self, qdrant_mock):
        from src.services.rag import RAGService
        rag = RAGService(qdrant_repo=qdrant_mock)
        with patch.object(rag, "_encode", return_value=[0.0] * 384), \
             patch.object(rag, "_get_model", return_value=MagicMock()):
            await rag.search(query="test", video_id="abc123", top_k=5)
        assert qdrant_mock.search.call_args.kwargs["top_k"] == 5

    async def test_should_pass_sources_filter(self, qdrant_mock):
        from src.services.rag import RAGService
        rag = RAGService(qdrant_repo=qdrant_mock)
        with patch.object(rag, "_encode", return_value=[0.0] * 384), \
             patch.object(rag, "_get_model", return_value=MagicMock()):
            await rag.search(query="test", video_id="abc123", sources=["default_output"])
        assert qdrant_mock.search.call_args.kwargs["sources"] == ["default_output"]

    async def test_should_deduplicate_identical_chunks(self):
        from src.services.rag import RAGService
        dup_repo = MagicMock()
        dup_repo.search.return_value = [
            {"text": "Same text here.", "video_id": "abc", "timestamp": "0:10", "score": 0.95, "chunk_index": 0},
            {"text": "Same text here.", "video_id": "abc", "timestamp": "0:11", "score": 0.94, "chunk_index": 1},
        ]
        mock_model = MagicMock()
        mock_model.encode.return_value = np.array([[1.0, 0.0, 0.0], [1.0, 0.0, 0.0]])
        rag = RAGService(qdrant_repo=dup_repo)
        with patch.object(rag, "_encode", return_value=[0.0] * 384), \
             patch.object(rag, "_get_model", return_value=mock_model):
            results = await rag.search(query="text", video_id="abc")
        assert len(results) <= 1

    async def test_should_handle_qdrant_failure(self):
        from src.services.rag import RAGService
        failing_repo = MagicMock()
        failing_repo.search.side_effect = ConnectionError("Qdrant down")
        rag = RAGService(qdrant_repo=failing_repo)
        with patch.object(rag, "_encode", return_value=[0.0] * 384):
            results = await rag.search(query="test", video_id="abc123")
        assert results == []

    async def test_should_encode_query(self, qdrant_mock):
        from src.services.rag import RAGService
        rag = RAGService(qdrant_repo=qdrant_mock)
        with patch.object(rag, "_encode", return_value=[0.0] * 384) as mock_encode, \
             patch.object(rag, "_get_model", return_value=MagicMock()):
            await rag.search(query="backpropagation", video_id="abc123")
        mock_encode.assert_called_once_with("backpropagation")

    async def test_should_return_rag_source_objects(self, qdrant_mock):
        from src.services.rag import RAGService
        from src.models.responses import RAGSource
        rag = RAGService(qdrant_repo=qdrant_mock)
        with patch.object(rag, "_encode", return_value=[0.0] * 384), \
             patch.object(rag, "_get_model", return_value=MagicMock()):
            results = await rag.search(query="layers", video_id="abc123")
        assert len(results) > 0
        assert isinstance(results[0], RAGSource)

    async def test_should_populate_video_id_on_results(self, qdrant_mock):
        from src.services.rag import RAGService
        rag = RAGService(qdrant_repo=qdrant_mock)
        with patch.object(rag, "_encode", return_value=[0.0] * 384), \
             patch.object(rag, "_get_model", return_value=MagicMock()):
            results = await rag.search(query="layers", video_id="abc123")
        assert all(s.video_id == "abc123" for s in results)


class TestSearchLibrary:

    async def test_should_return_empty_for_empty_video_ids(self):
        from src.services.rag import RAGService
        repo = MagicMock()
        rag = RAGService(qdrant_repo=repo)
        results = await rag.search_library(query="anything", video_ids=[])
        assert results == []
        repo.search.assert_not_called()

    async def test_should_pass_full_video_id_list(self, qdrant_mock):
        from src.services.rag import RAGService
        rag = RAGService(qdrant_repo=qdrant_mock)
        with patch.object(rag, "_encode", return_value=[0.0] * 384), \
             patch.object(rag, "_get_model", return_value=MagicMock()):
            await rag.search_library(query="React", video_ids=["v1", "v2", "v3"])
        assert qdrant_mock.search.call_args.kwargs["video_ids"] == ["v1", "v2", "v3"]

    async def test_should_respect_top_k(self, qdrant_mock):
        from src.services.rag import RAGService
        rag = RAGService(qdrant_repo=qdrant_mock)
        with patch.object(rag, "_encode", return_value=[0.0] * 384), \
             patch.object(rag, "_get_model", return_value=MagicMock()):
            await rag.search_library(query="React", video_ids=["v1"], top_k=20)
        assert qdrant_mock.search.call_args.kwargs["top_k"] == 20

    async def test_should_populate_video_id_for_grouping(self):
        from src.services.rag import RAGService
        repo = MagicMock()
        repo.search.return_value = [
            {"text": "Hooks make state composable across components.", "video_id": "react_id", "score": 0.9, "chunk_index": 0, "source": "default_output"},
            {"text": "Vue's reactivity tracks reads of refs and computeds.", "video_id": "vue_id", "score": 0.8, "chunk_index": 0, "source": "transcript"},
        ]
        rag = RAGService(qdrant_repo=repo)
        with patch.object(rag, "_encode", return_value=[0.0] * 384), \
             patch.object(rag, "_get_model", return_value=MagicMock()):
            results = await rag.search_library(query="reactivity", video_ids=["react_id", "vue_id"])
        assert {s.video_id for s in results} == {"react_id", "vue_id"}

    async def test_should_handle_qdrant_failure(self):
        from src.services.rag import RAGService
        failing = MagicMock()
        failing.search.side_effect = ConnectionError("down")
        rag = RAGService(qdrant_repo=failing)
        with patch.object(rag, "_encode", return_value=[0.0] * 384):
            results = await rag.search_library(query="x", video_ids=["v1"])
        assert results == []

    async def test_should_forward_exact_video_ids_unmodified(self, qdrant_mock):
        # Library chat trusts the gateway-derived id list verbatim — the RAG
        # layer must forward it to Qdrant without filtering or reordering.
        from src.services.rag import RAGService
        rag = RAGService(qdrant_repo=qdrant_mock)
        ids = ["aaa", "bbb", "ccc", "ddd"]
        with patch.object(rag, "_encode", return_value=[0.0] * 384), \
             patch.object(rag, "_get_model", return_value=MagicMock()):
            await rag.search_library(query="forwarded?", video_ids=ids)
        assert qdrant_mock.search.call_args.kwargs["video_ids"] == ids
