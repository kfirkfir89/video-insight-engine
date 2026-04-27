"""Tests for QdrantRepository — multi-video and source filter wiring."""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from src.repositories.qdrant_repository import QdrantRepository


@pytest.fixture
def repo() -> QdrantRepository:
    return QdrantRepository(url="http://test", collection="transcript_chunks")


def _query_response(points):
    resp = MagicMock()
    resp.points = points
    return resp


@pytest.fixture
def mock_client() -> MagicMock:
    client = MagicMock()
    client.query_points.return_value = _query_response([])
    return client


def _filter_keys(call_args) -> list[str]:
    return [c.key for c in call_args.kwargs["query_filter"].must]


def _condition_for(call_args, key: str):
    return next(c for c in call_args.kwargs["query_filter"].must if c.key == key)


class TestSingleVideoMatchValue:
    def test_should_use_match_value_when_one_video_id(self, repo, mock_client):
        repo._client = mock_client

        repo.search([0.0] * 384, video_ids=["only_one"])

        condition = _condition_for(mock_client.query_points.call_args, "video_id")
        # MatchValue exposes ``value``; MatchAny exposes ``any``.
        assert hasattr(condition.match, "value")
        assert condition.match.value == "only_one"


class TestMultiVideoMatchAny:
    def test_should_use_match_any_when_multiple_video_ids(self, repo, mock_client):
        repo._client = mock_client

        repo.search([0.0] * 384, video_ids=["a", "b", "c"])

        condition = _condition_for(mock_client.query_points.call_args, "video_id")
        assert hasattr(condition.match, "any")
        assert sorted(condition.match.any) == ["a", "b", "c"]


class TestSourcesFilter:
    def test_should_add_source_filter_when_sources_passed(self, repo, mock_client):
        repo._client = mock_client

        repo.search([0.0] * 384, video_ids=["v1"], sources=["transcript"])

        keys = _filter_keys(mock_client.query_points.call_args)
        assert "video_id" in keys
        assert "source" in keys

    def test_should_omit_source_filter_when_sources_none(self, repo, mock_client):
        repo._client = mock_client

        repo.search([0.0] * 384, video_ids=["v1"])

        keys = _filter_keys(mock_client.query_points.call_args)
        assert "source" not in keys


class TestEmptyVideoIds:
    def test_should_short_circuit_without_qdrant_call(self, repo, mock_client):
        repo._client = mock_client

        results = repo.search([0.0] * 384, video_ids=[])

        assert results == []
        mock_client.query_points.assert_not_called()


class TestPayloadMapping:
    def test_should_surface_new_payload_fields(self, repo, mock_client):
        result_obj = MagicMock()
        result_obj.payload = {
            "text": "A retrievable chunk",
            "video_id": "v1",
            "chunk_index": 3,
            "timestamp": "0:42",
            "source": "default_output",
            "tab_id": "overview_tab",
            "tab_component": "overview",
            "prop_path": "masterSummary",
        }
        result_obj.score = 0.91
        mock_client.query_points.return_value = _query_response([result_obj])
        repo._client = mock_client

        results = repo.search([0.0] * 384, video_ids=["v1"])

        assert len(results) == 1
        r = results[0]
        assert r["source"] == "default_output"
        assert r["tab_id"] == "overview_tab"
        assert r["tab_component"] == "overview"
        assert r["prop_path"] == "masterSummary"


class TestErrorHandling:
    def test_should_return_empty_on_qdrant_failure(self, repo, mock_client):
        mock_client.query_points.side_effect = Exception("Qdrant down")
        repo._client = mock_client

        results = repo.search([0.0] * 384, video_ids=["v1"])

        assert results == []
