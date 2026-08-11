"""Tests for the worker liveness heartbeat (src/worker/__main__.py).

The standalone worker has no HTTP surface, so the container healthcheck
compares the mtime of a heartbeat file against a staleness window. The
heartbeat loop must touch the file on start, keep touching it until the
shutdown event fires, and never let a write failure crash the worker.
"""

from __future__ import annotations

import asyncio
from pathlib import Path

import pytest

from src.worker import __main__ as entry


class TestHeartbeatLoop:
    @pytest.mark.asyncio
    async def test_touches_file_immediately_and_exits_on_shutdown(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        hb_file = tmp_path / "heartbeat"
        monkeypatch.setattr(entry, "HEARTBEAT_PATH", hb_file)
        shutdown = asyncio.Event()

        task = asyncio.create_task(entry._heartbeat_loop(shutdown))
        await asyncio.sleep(0.05)
        assert hb_file.exists(), "heartbeat file must be touched on loop start"

        shutdown.set()
        await asyncio.wait_for(task, timeout=1.0)

    @pytest.mark.asyncio
    async def test_keeps_touching_until_shutdown(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        hb_file = tmp_path / "heartbeat"
        monkeypatch.setattr(entry, "HEARTBEAT_PATH", hb_file)
        monkeypatch.setattr(entry, "HEARTBEAT_INTERVAL_SECONDS", 0.02)
        shutdown = asyncio.Event()

        task = asyncio.create_task(entry._heartbeat_loop(shutdown))
        await asyncio.sleep(0.05)
        first_mtime = hb_file.stat().st_mtime_ns
        await asyncio.sleep(0.05)
        second_mtime = hb_file.stat().st_mtime_ns
        assert second_mtime > first_mtime, "heartbeat must refresh the mtime"

        shutdown.set()
        await asyncio.wait_for(task, timeout=1.0)

    @pytest.mark.asyncio
    async def test_write_failure_does_not_crash_loop(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        # Point at a path whose parent does not exist — touch() raises OSError.
        hb_file = tmp_path / "missing-dir" / "heartbeat"
        monkeypatch.setattr(entry, "HEARTBEAT_PATH", hb_file)
        monkeypatch.setattr(entry, "HEARTBEAT_INTERVAL_SECONDS", 0.02)
        shutdown = asyncio.Event()

        task = asyncio.create_task(entry._heartbeat_loop(shutdown))
        await asyncio.sleep(0.05)
        assert not task.done(), "write failures must be swallowed, not fatal"

        shutdown.set()
        await asyncio.wait_for(task, timeout=1.0)

    def test_default_heartbeat_path_is_tmp(self) -> None:
        assert str(entry.HEARTBEAT_PATH).startswith("/tmp"), (
            "default heartbeat path must live in /tmp (writable as non-root)"
        )
