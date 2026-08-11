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
        {
            "text": "A neural network consists of layers.",
            "video_id": "abc123",
            "timestamp": "0:45",
            "score": 0.92,
            "chunk_index": 0,
            "source": "transcript",
        },
        {
            "text": "Backpropagation computes the gradient.",
            "video_id": "abc123",
            "timestamp": "2:00",
            "score": 0.87,
            "chunk_index": 1,
            "source": "transcript",
        },
        {
            "text": "Each layer applies a non-linear activation.",
            "video_id": "abc123",
            "timestamp": "3:20",
            "score": 0.81,
            "chunk_index": 2,
            "source": "transcript",
        },
    ]
    return repo


class TestRAGSearch:
    async def test_should_return_results(self, qdrant_mock):
        from src.services.rag import RAGService

        rag = RAGService(qdrant_repo=qdrant_mock)
        with (
            patch.object(rag, "_encode", return_value=[0.0] * 384),
            patch.object(rag, "_get_model", return_value=MagicMock()),
        ):
            results = await rag.search(query="neural networks", video_id="abc123")
        assert len(results) > 0

    async def test_should_pass_video_id_as_list(self, qdrant_mock):
        from src.services.rag import RAGService

        rag = RAGService(qdrant_repo=qdrant_mock)
        with (
            patch.object(rag, "_encode", return_value=[0.0] * 384),
            patch.object(rag, "_get_model", return_value=MagicMock()),
        ):
            await rag.search(query="test", video_id="vid_42")
        assert qdrant_mock.search.call_args.kwargs["video_ids"] == ["vid_42"]

    async def test_should_return_empty_when_no_chunks(self):
        from src.services.rag import RAGService

        empty_repo = MagicMock()
        empty_repo.search.return_value = []
        rag = RAGService(qdrant_repo=empty_repo)
        with (
            patch.object(rag, "_encode", return_value=[0.0] * 384),
            patch.object(rag, "_get_model", return_value=MagicMock()),
        ):
            results = await rag.search(query="nonexistent", video_id="abc123")
        assert results == []

    async def test_should_respect_top_k(self, qdrant_mock):
        from src.services.rag import RAGService

        rag = RAGService(qdrant_repo=qdrant_mock)
        with (
            patch.object(rag, "_encode", return_value=[0.0] * 384),
            patch.object(rag, "_get_model", return_value=MagicMock()),
        ):
            await rag.search(query="test", video_id="abc123", top_k=5)
        assert qdrant_mock.search.call_args.kwargs["top_k"] == 5

    async def test_should_pass_sources_filter(self, qdrant_mock):
        from src.services.rag import RAGService

        rag = RAGService(qdrant_repo=qdrant_mock)
        with (
            patch.object(rag, "_encode", return_value=[0.0] * 384),
            patch.object(rag, "_get_model", return_value=MagicMock()),
        ):
            await rag.search(query="test", video_id="abc123", sources=["default_output"])
        assert qdrant_mock.search.call_args.kwargs["sources"] == ["default_output"]

    async def test_should_deduplicate_identical_chunks(self):
        from src.services.rag import RAGService

        dup_repo = MagicMock()
        dup_repo.search.return_value = [
            {
                "text": "Same text here.",
                "video_id": "abc",
                "timestamp": "0:10",
                "score": 0.95,
                "chunk_index": 0,
            },
            {
                "text": "Same text here.",
                "video_id": "abc",
                "timestamp": "0:11",
                "score": 0.94,
                "chunk_index": 1,
            },
        ]
        mock_model = MagicMock()
        mock_model.encode.return_value = np.array([[1.0, 0.0, 0.0], [1.0, 0.0, 0.0]])
        rag = RAGService(qdrant_repo=dup_repo)
        with (
            patch.object(rag, "_encode", return_value=[0.0] * 384),
            patch.object(rag, "_get_model", return_value=mock_model),
        ):
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
        with (
            patch.object(rag, "_encode", return_value=[0.0] * 384) as mock_encode,
            patch.object(rag, "_get_model", return_value=MagicMock()),
        ):
            await rag.search(query="backpropagation", video_id="abc123")
        mock_encode.assert_called_once_with("backpropagation")

    async def test_should_return_rag_source_objects(self, qdrant_mock):
        from src.services.rag import RAGService
        from src.models.responses import RAGSource

        rag = RAGService(qdrant_repo=qdrant_mock)
        with (
            patch.object(rag, "_encode", return_value=[0.0] * 384),
            patch.object(rag, "_get_model", return_value=MagicMock()),
        ):
            results = await rag.search(query="layers", video_id="abc123")
        assert len(results) > 0
        assert isinstance(results[0], RAGSource)

    async def test_should_populate_video_id_on_results(self, qdrant_mock):
        from src.services.rag import RAGService

        rag = RAGService(qdrant_repo=qdrant_mock)
        with (
            patch.object(rag, "_encode", return_value=[0.0] * 384),
            patch.object(rag, "_get_model", return_value=MagicMock()),
        ):
            results = await rag.search(query="layers", video_id="abc123")
        assert all(s.video_id == "abc123" for s in results)


class TestRelevanceFloor:
    """Hits below RAG_MIN_SCORE never reach context assembly."""

    def _rag(self, repo, min_score=0.25):
        from src.services.rag import RAGService

        return RAGService(qdrant_repo=repo, min_score=min_score)

    async def test_should_keep_on_topic_hits_above_floor(self, qdrant_mock):
        # Fixture scores are 0.92/0.87/0.81 — all comfortably above 0.25.
        rag = self._rag(qdrant_mock)
        with (
            patch.object(rag, "_encode", return_value=[0.0] * 384),
            patch.object(rag, "_get_model", return_value=MagicMock()),
        ):
            results = await rag.search(query="neural networks", video_id="abc123")
        assert len(results) == 3

    async def test_should_filter_low_score_hits(self):
        repo = MagicMock()
        repo.search.return_value = [
            {
                "text": "On-topic chunk about gradients.",
                "video_id": "abc",
                "score": 0.62,
                "chunk_index": 0,
                "source": "transcript",
            },
            {
                "text": "Barely related filler.",
                "video_id": "abc",
                "score": 0.12,
                "chunk_index": 1,
                "source": "transcript",
            },
            {
                "text": "Completely unrelated noise.",
                "video_id": "abc",
                "score": 0.03,
                "chunk_index": 2,
                "source": "transcript",
            },
        ]
        rag = self._rag(repo)
        with (
            patch.object(rag, "_encode", return_value=[0.0] * 384),
            patch.object(rag, "_get_model", return_value=MagicMock()),
        ):
            results = await rag.search(query="gradients", video_id="abc")
        assert [s.text for s in results] == ["On-topic chunk about gradients."]

    async def test_should_return_empty_when_everything_below_floor(self):
        repo = MagicMock()
        repo.search.return_value = [
            {
                "text": "Noise A.",
                "video_id": "abc",
                "score": 0.10,
                "chunk_index": 0,
                "source": "transcript",
            },
            {
                "text": "Noise B.",
                "video_id": "abc",
                "score": 0.05,
                "chunk_index": 1,
                "source": "transcript",
            },
        ]
        rag = self._rag(repo)
        with (
            patch.object(rag, "_encode", return_value=[0.0] * 384),
            patch.object(rag, "_get_model", return_value=MagicMock()),
        ):
            results = await rag.search(query="off-topic question", video_id="abc")
        assert results == []

    async def test_should_apply_floor_in_library_search(self):
        repo = MagicMock()
        repo.search.return_value = [
            {
                "text": "Relevant library hit.",
                "video_id": "v1",
                "score": 0.5,
                "chunk_index": 0,
                "source": "transcript",
            },
            {
                "text": "Library noise.",
                "video_id": "v2",
                "score": 0.08,
                "chunk_index": 0,
                "source": "transcript",
            },
        ]
        rag = self._rag(repo)
        with (
            patch.object(rag, "_encode", return_value=[0.0] * 384),
            patch.object(rag, "_get_model", return_value=MagicMock()),
        ):
            results = await rag.search_library(query="q", video_ids=["v1", "v2"])
        assert [s.text for s in results] == ["Relevant library hit."]

    async def test_should_respect_configured_floor(self):
        # A stricter floor drops what the default would keep.
        repo = MagicMock()
        repo.search.return_value = [
            {
                "text": "Mid-relevance chunk.",
                "video_id": "abc",
                "score": 0.30,
                "chunk_index": 0,
                "source": "transcript",
            },
        ]
        rag = self._rag(repo, min_score=0.5)
        with (
            patch.object(rag, "_encode", return_value=[0.0] * 384),
            patch.object(rag, "_get_model", return_value=MagicMock()),
        ):
            results = await rag.search(query="q", video_id="abc")
        assert results == []

    async def test_zero_floor_disables_filtering(self):
        repo = MagicMock()
        repo.search.return_value = [
            {
                "text": "Noise kept when floor is off.",
                "video_id": "abc",
                "score": 0.01,
                "chunk_index": 0,
                "source": "transcript",
            },
        ]
        rag = self._rag(repo, min_score=0.0)
        with (
            patch.object(rag, "_encode", return_value=[0.0] * 384),
            patch.object(rag, "_get_model", return_value=MagicMock()),
        ):
            results = await rag.search(query="q", video_id="abc")
        assert len(results) == 1


class TestTimestampSeconds:
    """Numeric payload seconds surface on RAGSource for UI seek buttons."""

    async def test_should_populate_numeric_seconds_and_end(self):
        from src.services.rag import RAGService

        repo = MagicMock()
        repo.search.return_value = [
            {
                "text": "Chunk with timeline.",
                "video_id": "abc",
                "timestamp": 754.0,
                "end_timestamp": 810.5,
                "score": 0.9,
                "chunk_index": 0,
                "source": "transcript",
            },
        ]
        rag = RAGService(qdrant_repo=repo)
        with (
            patch.object(rag, "_encode", return_value=[0.0] * 384),
            patch.object(rag, "_get_model", return_value=MagicMock()),
        ):
            results = await rag.search(query="timeline", video_id="abc")
        assert results[0].timestamp_seconds == 754.0
        assert results[0].end_seconds == 810.5
        assert results[0].timestamp == "12:34"

    async def test_should_keep_seconds_none_for_v1_legacy_points(self):
        from src.services.rag import RAGService

        repo = MagicMock()
        repo.search.return_value = [
            {
                "text": "Old point.",
                "video_id": "abc",
                "timestamp": None,
                "score": 0.9,
                "chunk_index": 0,
                "source": "transcript",
            },
        ]
        rag = RAGService(qdrant_repo=repo)
        with (
            patch.object(rag, "_encode", return_value=[0.0] * 384),
            patch.object(rag, "_get_model", return_value=MagicMock()),
        ):
            results = await rag.search(query="old", video_id="abc")
        assert results[0].timestamp_seconds is None
        assert results[0].end_seconds is None

    async def test_should_not_derive_seconds_from_preformatted_strings(self):
        # Pre-formatted "2:00" strings pass through as display text only —
        # no numeric value means the UI hides its seek affordance.
        from src.services.rag import RAGService

        repo = MagicMock()
        repo.search.return_value = [
            {
                "text": "String-timestamp point.",
                "video_id": "abc",
                "timestamp": "2:00",
                "score": 0.9,
                "chunk_index": 0,
                "source": "transcript",
            },
        ]
        rag = RAGService(qdrant_repo=repo)
        with (
            patch.object(rag, "_encode", return_value=[0.0] * 384),
            patch.object(rag, "_get_model", return_value=MagicMock()),
        ):
            results = await rag.search(query="q", video_id="abc")
        assert results[0].timestamp == "2:00"
        assert results[0].timestamp_seconds is None


class TestTimestampFormatting:
    """Payload schema v2 stores numeric seconds; RAGSource carries M:SS strings."""

    def test_should_format_seconds_as_mm_ss(self):
        from src.services.rag import _format_timestamp

        assert _format_timestamp(754) == "12:34"

    def test_should_format_float_seconds(self):
        from src.services.rag import _format_timestamp

        assert _format_timestamp(45.7) == "0:45"

    def test_should_format_hours_as_h_mm_ss(self):
        from src.services.rag import _format_timestamp

        assert _format_timestamp(3725) == "1:02:05"

    def test_should_pass_none_through_for_legacy_points(self):
        from src.services.rag import _format_timestamp

        assert _format_timestamp(None) is None

    def test_should_pass_preformatted_strings_through(self):
        from src.services.rag import _format_timestamp

        assert _format_timestamp("2:00") == "2:00"

    def test_should_return_none_for_negative_seconds(self):
        from src.services.rag import _format_timestamp

        assert _format_timestamp(-5) is None

    async def test_search_should_render_numeric_payload_timestamp(self):
        """A payload timestamp of 754 seconds surfaces as "12:34" on RAGSource."""
        from src.services.rag import RAGService

        repo = MagicMock()
        repo.search.return_value = [
            {
                "text": "Chunk with timeline.",
                "video_id": "abc",
                "timestamp": 754,
                "score": 0.9,
                "chunk_index": 0,
                "source": "transcript",
            },
        ]
        rag = RAGService(qdrant_repo=repo)
        with (
            patch.object(rag, "_encode", return_value=[0.0] * 384),
            patch.object(rag, "_get_model", return_value=MagicMock()),
        ):
            results = await rag.search(query="timeline", video_id="abc")
        assert results[0].timestamp == "12:34"

    async def test_search_should_not_crash_on_null_timestamp(self):
        """Legacy v1 points have no timestamp — search still returns them."""
        from src.services.rag import RAGService

        repo = MagicMock()
        repo.search.return_value = [
            {
                "text": "Old point without timestamp.",
                "video_id": "abc",
                "timestamp": None,
                "score": 0.9,
                "chunk_index": 0,
                "source": "transcript",
            },
        ]
        rag = RAGService(qdrant_repo=repo)
        with (
            patch.object(rag, "_encode", return_value=[0.0] * 384),
            patch.object(rag, "_get_model", return_value=MagicMock()),
        ):
            results = await rag.search(query="old", video_id="abc")
        assert len(results) == 1
        assert results[0].timestamp is None


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
        with (
            patch.object(rag, "_encode", return_value=[0.0] * 384),
            patch.object(rag, "_get_model", return_value=MagicMock()),
        ):
            await rag.search_library(query="React", video_ids=["v1", "v2", "v3"])
        assert qdrant_mock.search.call_args.kwargs["video_ids"] == ["v1", "v2", "v3"]

    async def test_should_respect_top_k(self, qdrant_mock):
        from src.services.rag import RAGService

        rag = RAGService(qdrant_repo=qdrant_mock)
        with (
            patch.object(rag, "_encode", return_value=[0.0] * 384),
            patch.object(rag, "_get_model", return_value=MagicMock()),
        ):
            await rag.search_library(query="React", video_ids=["v1"], top_k=20)
        assert qdrant_mock.search.call_args.kwargs["top_k"] == 20

    async def test_should_populate_video_id_for_grouping(self):
        from src.services.rag import RAGService

        repo = MagicMock()
        repo.search.return_value = [
            {
                "text": "Hooks make state composable across components.",
                "video_id": "react_id",
                "score": 0.9,
                "chunk_index": 0,
                "source": "default_output",
            },
            {
                "text": "Vue's reactivity tracks reads of refs and computeds.",
                "video_id": "vue_id",
                "score": 0.8,
                "chunk_index": 0,
                "source": "transcript",
            },
        ]
        rag = RAGService(qdrant_repo=repo)
        with (
            patch.object(rag, "_encode", return_value=[0.0] * 384),
            patch.object(rag, "_get_model", return_value=MagicMock()),
        ):
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
        with (
            patch.object(rag, "_encode", return_value=[0.0] * 384),
            patch.object(rag, "_get_model", return_value=MagicMock()),
        ):
            await rag.search_library(query="forwarded?", video_ids=ids)
        assert qdrant_mock.search.call_args.kwargs["video_ids"] == ids
