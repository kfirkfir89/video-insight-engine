"""Tests for the isLatest de-duplication fix in _VIDEO_LOOKUP_STAGE and by-output-type.

These tests verify the pipeline logic in isolation (no real MongoDB required) by
inspecting the aggregation pipeline structure that prevents the N-version fan-out.
"""

from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from src.config import settings
from src.main import app
from src.routes.usage import _VIDEO_LOOKUP_STAGE


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


def _auth_headers() -> dict[str, str]:
    return {"Authorization": f"Bearer {settings.ADMIN_API_KEY}"}


# ─── Pipeline structure tests (no DB needed) ───


class TestVideoLookupStageDedup:
    """_VIDEO_LOOKUP_STAGE must filter to isLatest:True to prevent fan-out."""

    def test_lookup_stage_filters_is_latest(self) -> None:
        """The lookup sub-pipeline must include an isLatest match stage."""
        lookup_stage = _VIDEO_LOOKUP_STAGE[0]
        assert "$lookup" in lookup_stage
        sub_pipeline = lookup_stage["$lookup"]["pipeline"]
        match_stages = [s for s in sub_pipeline if "$match" in s]
        assert match_stages, "Sub-pipeline must have at least one $match stage"
        is_latest_present = any(
            s["$match"].get("isLatest") is True for s in match_stages
        )
        assert is_latest_present, (
            "_VIDEO_LOOKUP_STAGE sub-pipeline must filter isLatest:True "
            "to prevent one-youtubeId-many-versions fan-out"
        )

    def test_lookup_stage_has_limit_one(self) -> None:
        """The lookup sub-pipeline must include a $limit:1 to cap the result set."""
        lookup_stage = _VIDEO_LOOKUP_STAGE[0]
        sub_pipeline = lookup_stage["$lookup"]["pipeline"]
        limit_stages = [s for s in sub_pipeline if "$limit" in s]
        assert limit_stages, "Sub-pipeline should have a $limit stage"
        assert limit_stages[-1]["$limit"] == 1

    def test_lookup_stage_unwinds_with_preserve_nulls(self) -> None:
        """$unwind must use preserveNullAndEmptyArrays so videos without
        a cache entry still appear in the result."""
        unwind_stage = _VIDEO_LOOKUP_STAGE[1]
        assert "$unwind" in unwind_stage
        assert unwind_stage["$unwind"].get("preserveNullAndEmptyArrays") is True

    def test_lookup_stage_joins_on_youtube_id(self) -> None:
        """The lookup must join on youtubeId, not _id, to match by YouTube ID."""
        lookup_stage = _VIDEO_LOOKUP_STAGE[0]
        assert lookup_stage["$lookup"]["localField"] == "_id"
        assert lookup_stage["$lookup"]["foreignField"] == "youtubeId"

    def test_lookup_stage_length_is_two(self) -> None:
        """Stage list must be exactly [$lookup, $unwind]."""
        assert len(_VIDEO_LOOKUP_STAGE) == 2


# ─── Auth + validation for /by-video ───


@pytest.mark.anyio
async def test_by_video_requires_auth() -> None:
    """by-video endpoint must reject unauthenticated requests."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/usage/by-video")
    assert resp.status_code == 401


@pytest.mark.anyio
async def test_by_video_validates_limit_max() -> None:
    """limit=101 should return 422."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/usage/by-video?limit=101", headers=_auth_headers())
    assert resp.status_code == 422


@pytest.mark.anyio
async def test_by_video_validates_days_max() -> None:
    """days=91 should return 422."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/usage/by-video?days=91", headers=_auth_headers())
    assert resp.status_code == 422


# ─── by-output-type sub-pipeline dedup check ───


class TestByOutputTypePipelineDedup:
    """Verify the by-output-type pipeline uses the same isLatest guard."""

    def test_by_output_type_pipeline_uses_is_latest(self) -> None:
        """Inspect the by-output-type aggregation source to confirm isLatest filter."""
        import inspect

        from src.routes import usage as usage_module

        source = inspect.getsource(usage_module.usage_by_output_type)
        assert "isLatest" in source, (
            "usage_by_output_type must filter videoSummaryCache by isLatest:True "
            "to avoid double-counting cost across multiple cache versions"
        )
