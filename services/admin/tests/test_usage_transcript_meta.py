"""Tests for the transcriptMeta surface in the usage routes.

The summarizer stamps ``transcriptMeta`` on every videoSummaryCache row that
reaches the transcript phase. The admin by-video and per-video endpoints expose
its ``source``/``type``/``outcome`` triple; these tests pin the helper mapping
and the Mongo projections that carry the sub-fields through.
"""

from __future__ import annotations

from collections.abc import Iterator
from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import ASGITransport, AsyncClient

from src.config import settings
from src.main import app
from src.routes import usage as usage_module
from src.routes.usage import _VIDEO_LOOKUP_STAGE, _format_video_metadata

TRANSCRIPT_META_PROJECTION_KEYS = (
    "transcriptMeta.source",
    "transcriptMeta.type",
    "transcriptMeta.outcome",
)


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


def _auth_headers() -> dict[str, str]:
    return {"Authorization": f"Bearer {settings.ADMIN_API_KEY}"}


# ─── _format_video_metadata ───


class TestFormatVideoMetadataTranscript:
    """_format_video_metadata surfaces transcriptMeta as snake_case keys."""

    def test_maps_transcript_meta_to_snake_case_keys(self) -> None:
        """A row with transcriptMeta exposes source/type/outcome verbatim."""
        doc = {
            "title": "Some video",
            "transcriptMeta": {"source": "whisper", "type": "asr", "outcome": "ok"},
        }
        result = _format_video_metadata(doc)
        assert result is not None
        assert result["transcript_source"] == "whisper"
        assert result["transcript_type"] == "asr"
        assert result["transcript_outcome"] == "ok"

    def test_missing_transcript_meta_yields_none_keys(self) -> None:
        """A row without transcriptMeta (Redis-served / pre-feature) still has the keys."""
        result = _format_video_metadata({"title": "Some video"})
        assert result is not None
        assert result["transcript_source"] is None
        assert result["transcript_type"] is None
        assert result["transcript_outcome"] is None

    def test_partial_transcript_meta_fills_missing_with_none(self) -> None:
        """A failed run (source null, outcome failed) maps each key independently."""
        doc = {"transcriptMeta": {"source": None, "outcome": "failed"}}
        result = _format_video_metadata(doc)
        assert result is not None
        assert result["transcript_source"] is None
        assert result["transcript_type"] is None
        assert result["transcript_outcome"] == "failed"

    def test_none_doc_stays_none(self) -> None:
        """No cache doc at all still returns None (video block absent)."""
        assert _format_video_metadata(None) is None


# ─── Projection tripwires ───


class TestVideoLookupStageProjection:
    """_VIDEO_LOOKUP_STAGE must project the transcriptMeta sub-fields."""

    def test_lookup_project_includes_transcript_meta_keys(self) -> None:
        """The $lookup sub-pipeline $project carries the three dotted keys."""
        sub_pipeline = _VIDEO_LOOKUP_STAGE[0]["$lookup"]["pipeline"]
        project_stages = [s["$project"] for s in sub_pipeline if "$project" in s]
        assert project_stages, "Sub-pipeline must have a $project stage"
        for key in TRANSCRIPT_META_PROJECTION_KEYS:
            assert project_stages[0].get(key) == 1, f"$project must include {key}"


# ─── GET /usage/video/{video_id} ───


@pytest.fixture
def mock_db(monkeypatch: pytest.MonkeyPatch) -> Iterator[MagicMock]:
    """Replace get_database in the usage route module with a per-video stub.

    Motor's aggregate()/find() are sync and return cursors; to_list() and
    find_one() are async. Also clears the route-level TTL cache so the test
    hits the mock.
    """
    db = MagicMock()
    agg_cursor = MagicMock()
    agg_cursor.to_list = AsyncMock(return_value=[])
    db.llm_usage.aggregate.return_value = agg_cursor
    db.llm_usage.find.return_value.sort.return_value.limit.return_value.to_list = AsyncMock(
        return_value=[]
    )
    db.videoSummaryCache.find_one = AsyncMock(
        return_value={
            "title": "Some video",
            "transcriptMeta": {"source": "s3", "type": "cached", "outcome": "ok"},
        }
    )
    monkeypatch.setattr(usage_module, "get_database", lambda: db)
    usage_module._cache.clear()
    yield db
    usage_module._cache.clear()  # do not leak this test's entry into later tests


@pytest.mark.anyio
async def test_video_detail_queries_latest_row_with_transcript_meta(mock_db: MagicMock) -> None:
    """Per-video find_one filters isLatest:True, projects transcriptMeta, and surfaces it."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/usage/video/dQw4w9WgXcQ", headers=_auth_headers())
    assert resp.status_code == 200

    filter_, projection = mock_db.videoSummaryCache.find_one.call_args.args
    assert filter_ == {"youtubeId": "dQw4w9WgXcQ", "isLatest": True}
    for key in TRANSCRIPT_META_PROJECTION_KEYS:
        assert projection.get(key) == 1, f"find_one projection must include {key}"

    video = resp.json()["video"]
    assert video["transcript_source"] == "s3"
    assert video["transcript_type"] == "cached"
    assert video["transcript_outcome"] == "ok"
