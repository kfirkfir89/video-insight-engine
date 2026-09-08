"""Tests for the active stall sweeper (src/services/stall_sweeper.py).

Pins the two-signal stall decision (stale ``updatedAt`` AND no producer
lock), the failure side effects (row flip → API callback → alert row →
webhook), and the loop's resilience to a bad cycle.
"""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock

import pytest
from bson import ObjectId

from src.models.schemas import ErrorCode
from src.services import stall_sweeper as sw

NOW = datetime(2026, 8, 26, 12, 0, tzinfo=UTC)
THRESHOLD = timedelta(minutes=30)


def _row(minutes_old: int, youtube_id: str = "dQw4w9WgXcQ") -> dict:
    return {
        "_id": ObjectId(),
        "youtubeId": youtube_id,
        "status": "processing",
        # pymongo hands back naive UTC datetimes — mirror that shape.
        "updatedAt": (NOW - timedelta(minutes=minutes_old)).replace(tzinfo=None),
    }


@pytest.fixture
def repository() -> MagicMock:
    repo = MagicMock()
    repo.find_stalled_processing.return_value = []
    repo.mark_stalled_failed.return_value = True
    return repo


@pytest.fixture
def collaborators() -> dict:
    return {
        "alerts_collection": MagicMock(),
        "lock_held": AsyncMock(return_value=False),
        "notify_status": AsyncMock(),
        "deliver_alert": MagicMock(return_value=True),
    }


@pytest.fixture
def sweeper(repository, collaborators) -> sw.StallSweeper:
    return sw.StallSweeper(repository=repository, threshold=THRESHOLD, **collaborators)


class TestSweepDecision:
    async def test_should_query_rows_older_than_threshold(self, sweeper, repository):
        await sweeper.sweep_once(now=NOW)

        repository.find_stalled_processing.assert_called_once_with(
            NOW - THRESHOLD, sw.SWEEP_BATCH_LIMIT
        )

    async def test_should_do_nothing_when_no_candidates(self, sweeper, repository, collaborators):
        written = await sweeper.sweep_once(now=NOW)

        assert written == []
        repository.mark_stalled_failed.assert_not_called()
        collaborators["notify_status"].assert_not_awaited()

    async def test_should_skip_row_when_producer_lock_is_held(
        self, sweeper, repository, collaborators
    ):
        repository.find_stalled_processing.return_value = [_row(45)]
        collaborators["lock_held"].return_value = True

        written = await sweeper.sweep_once(now=NOW)

        assert written == []
        repository.mark_stalled_failed.assert_not_called()

    async def test_should_fail_row_when_stale_and_lock_expired(self, sweeper, repository):
        row = _row(45)
        repository.find_stalled_processing.return_value = [row]

        written = await sweeper.sweep_once(now=NOW)

        assert len(written) == 1
        repository.mark_stalled_failed.assert_called_once()
        args = repository.mark_stalled_failed.call_args.args
        assert args[0] == str(row["_id"])
        assert args[1] == NOW - THRESHOLD
        assert "45 min" in args[2]
        assert args[3] == ErrorCode.UNKNOWN_ERROR

    async def test_should_skip_side_effects_when_row_revived_before_write(
        self, sweeper, repository, collaborators
    ):
        """Compare-and-set lost: a producer resumed between find and write."""
        repository.find_stalled_processing.return_value = [_row(45)]
        repository.mark_stalled_failed.return_value = False

        written = await sweeper.sweep_once(now=NOW)

        assert written == []
        collaborators["notify_status"].assert_not_awaited()
        collaborators["alerts_collection"].insert_one.assert_not_called()
        collaborators["deliver_alert"].assert_not_called()


class TestFailureSideEffects:
    async def test_should_notify_api_with_failed_status(self, sweeper, repository, collaborators):
        row = _row(60)
        repository.find_stalled_processing.return_value = [row]

        await sweeper.sweep_once(now=NOW)

        notify = collaborators["notify_status"]
        notify.assert_awaited_once()
        assert notify.await_args.args[:3] == (str(row["_id"]), None, "failed")
        assert "stalled" in notify.await_args.kwargs["error"]

    async def test_should_write_critical_alert_row(self, sweeper, repository, collaborators):
        row = _row(60)
        repository.find_stalled_processing.return_value = [row]

        await sweeper.sweep_once(now=NOW)

        alert = collaborators["alerts_collection"].insert_one.call_args.args[0]
        assert alert["type"] == sw.ALERT_TYPE
        assert alert["severity"] == "critical"
        assert alert["video_summary_id"] == str(row["_id"])
        assert alert["youtube_id"] == "dQw4w9WgXcQ"
        assert alert["stalled_minutes"] == 60
        assert alert["timestamp"] == NOW

    async def test_should_deliver_alert_to_webhook(self, sweeper, repository, collaborators):
        repository.find_stalled_processing.return_value = [_row(60)]

        written = await sweeper.sweep_once(now=NOW)

        collaborators["deliver_alert"].assert_called_once_with(written[0])

    async def test_should_still_deliver_webhook_when_alert_write_fails(
        self, sweeper, repository, collaborators
    ):
        repository.find_stalled_processing.return_value = [_row(60)]
        collaborators["alerts_collection"].insert_one.side_effect = OSError("mongo down")

        written = await sweeper.sweep_once(now=NOW)

        assert len(written) == 1
        collaborators["deliver_alert"].assert_called_once()

    async def test_should_process_each_stalled_row_independently(
        self, sweeper, repository, collaborators
    ):
        live, dead = _row(40, "live0000001"), _row(90, "dead0000001")
        repository.find_stalled_processing.return_value = [live, dead]
        collaborators["lock_held"].side_effect = [True, False]

        written = await sweeper.sweep_once(now=NOW)

        assert [a["youtube_id"] for a in written] == ["dead0000001"]
        assert repository.mark_stalled_failed.call_count == 1


class TestStallSweeperLoop:
    async def test_should_survive_a_failing_cycle_and_keep_running(self, monkeypatch):
        sweeper = MagicMock()
        sweeper.sweep_once = AsyncMock(side_effect=[RuntimeError("boom"), None, None])
        sleeps: list[int] = []

        async def fake_sleep(seconds: float) -> None:
            sleeps.append(seconds)
            if len(sleeps) == 2:
                raise asyncio.CancelledError

        monkeypatch.setattr(sw.asyncio, "sleep", fake_sleep)

        with pytest.raises(asyncio.CancelledError):
            await sw.stall_sweeper_loop(sweeper, interval_seconds=7)

        assert sweeper.sweep_once.await_count == 2
        assert sleeps == [7, 7]


class TestBuildStallAlert:
    def test_should_floor_stalled_minutes(self):
        row = _row(0)
        alert = sw.build_stall_alert(row, timedelta(minutes=31, seconds=59), NOW)
        assert alert["stalled_minutes"] == 31
