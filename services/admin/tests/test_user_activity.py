"""Tests for GET /users/{id}/activity (User-360) endpoint."""

from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from src.config import settings
from src.main import app
from src.routes.users import (
    UserActivityResponse,
    _format_assistant_call,
    _format_user_video,
)

_VALID_USER_ID = "a" * 24  # 24-char hex-like ObjectId placeholder


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


def _auth_headers() -> dict[str, str]:
    return {"Authorization": f"Bearer {settings.ADMIN_API_KEY}"}


# ─── Auth + validation ───


@pytest.mark.anyio
async def test_user_activity_requires_auth() -> None:
    """activity endpoint must reject unauthenticated requests."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get(f"/users/{_VALID_USER_ID}/activity")
    assert resp.status_code == 401


@pytest.mark.anyio
async def test_user_activity_rejects_wrong_key() -> None:
    """activity endpoint must reject an incorrect API key."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get(
            f"/users/{_VALID_USER_ID}/activity",
            headers={"Authorization": "Bearer wrong-key"},
        )
    assert resp.status_code == 401


@pytest.mark.anyio
async def test_user_activity_rejects_short_user_id() -> None:
    """User IDs shorter than 24 chars must return 422."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/users/abc/activity", headers=_auth_headers())
    assert resp.status_code == 422


@pytest.mark.anyio
async def test_user_activity_rejects_long_user_id() -> None:
    """User IDs longer than 24 chars must return 422."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get(f"/users/{'a' * 25}/activity", headers=_auth_headers())
    assert resp.status_code == 422


@pytest.mark.anyio
async def test_user_activity_validates_days_min() -> None:
    """days=0 should return 422."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get(
            f"/users/{_VALID_USER_ID}/activity?days=0", headers=_auth_headers()
        )
    assert resp.status_code == 422


@pytest.mark.anyio
async def test_user_activity_validates_days_max() -> None:
    """days=91 should return 422 (above MAX_DAYS=90)."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get(
            f"/users/{_VALID_USER_ID}/activity?days=91", headers=_auth_headers()
        )
    assert resp.status_code == 422


# ─── Response model unit tests (no DB required) ───


class TestUserActivityResponseModel:
    """UserActivityResponse model validates its three lists correctly."""

    def test_empty_activity_is_valid(self) -> None:
        """An all-empty response is valid — user simply has no activity."""
        resp = UserActivityResponse(
            userId="aaaaaaaaaaaaaaaaaaaaaaaa",
            videos=[],
            assistantCalls=[],
            costTimeline=[],
        )
        assert resp.userId == "aaaaaaaaaaaaaaaaaaaaaaaa"
        assert resp.videos == []
        assert resp.assistantCalls == []
        assert resp.costTimeline == []


class TestFormatUserVideo:
    """_format_user_video maps userVideos documents correctly."""

    def test_maps_all_fields(self) -> None:
        """Complete document maps to UserVideoRow without error."""
        from datetime import UTC, datetime

        from bson import ObjectId

        doc = {
            "_id": ObjectId("eeeeeeeeeeeeeeeeeeeeeeee"),
            "videoSummaryId": ObjectId("ffffffffffffffffffffffff"),
            "youtubeId": "dQw4w9WgXcQ",
            "title": "Never Gonna Give You Up",
            "channel": "Rick Astley",
            "duration": 212,
            "thumbnailUrl": "https://i.ytimg.com/vi/dQw4w9WgXcQ/hq.jpg",
            "status": "completed",
            "addedAt": datetime(2026, 6, 1, tzinfo=UTC),
        }
        row = _format_user_video(doc)
        assert row.userVideoId == "eeeeeeeeeeeeeeeeeeeeeeee"
        assert row.videoSummaryId == "ffffffffffffffffffffffff"
        assert row.youtubeId == "dQw4w9WgXcQ"
        assert row.title == "Never Gonna Give You Up"
        assert row.duration == 212
        assert "2026-06-01" in (row.addedAt or "")

    def test_handles_missing_optional_fields(self) -> None:
        """Document with only required fields should not raise."""
        from bson import ObjectId

        doc = {
            "_id": ObjectId("aaaaaaaaaaaaaaaaaaaaaaaa"),
            "videoSummaryId": ObjectId("bbbbbbbbbbbbbbbbbbbbbbbb"),
            "youtubeId": "testId",
        }
        row = _format_user_video(doc)
        assert row.title is None
        assert row.channel is None
        assert row.duration is None
        assert row.addedAt is None


class TestFormatAssistantCall:
    """_format_assistant_call maps llm_usage documents correctly."""

    def test_maps_all_fields(self) -> None:
        """Complete llm_usage document maps to UserAssistantCallRow."""
        from datetime import UTC, datetime

        from bson import ObjectId

        doc = {
            "_id": ObjectId("cccccccccccccccccccccccc"),
            "feature": "assistant:rag_chat",
            "video_id": "dQw4w9WgXcQ",
            "model": "claude-sonnet-4-6",
            "cost_usd": 0.008,
            "tokens_in": 500,
            "tokens_out": 200,
            "request_id": "req-test-1",
            "timestamp": datetime(2026, 6, 2, tzinfo=UTC),
        }
        row = _format_assistant_call(doc)
        assert row.id == "cccccccccccccccccccccccc"
        assert row.feature == "assistant:rag_chat"
        assert row.videoId == "dQw4w9WgXcQ"
        assert row.costUsd == pytest.approx(0.008)
        assert row.requestId == "req-test-1"
        assert "2026-06-02" in row.timestamp

    def test_null_cost_defaults_to_zero(self) -> None:
        """cost_usd=None coerces to 0.0."""
        from datetime import UTC, datetime

        from bson import ObjectId

        doc = {
            "_id": ObjectId("dddddddddddddddddddddddd"),
            "cost_usd": None,
            "timestamp": datetime(2026, 1, 1, tzinfo=UTC),
        }
        row = _format_assistant_call(doc)
        assert row.costUsd == 0.0

    def test_missing_optional_fields_are_none(self) -> None:
        """Document missing optional fields maps to None values."""
        from datetime import UTC, datetime

        from bson import ObjectId

        doc = {
            "_id": ObjectId("eeeeeeeeeeeeeeeeeeeeeeee"),
            "timestamp": datetime(2026, 1, 1, tzinfo=UTC),
        }
        row = _format_assistant_call(doc)
        assert row.feature is None
        assert row.videoId is None
        assert row.requestId is None
