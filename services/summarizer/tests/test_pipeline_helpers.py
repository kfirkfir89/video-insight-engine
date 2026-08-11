"""Tests for pipeline helper dataclasses and utilities."""

from src.services.pipeline.pipeline_helpers import (
    PipelineTimer,
    TranscriptData,
    run_parallel_phases,
    sse_event,
    sse_token,
    normalize_segments,
    validate_duration,
)

import asyncio
import json
import pytest
from src.exceptions import TranscriptError
from src.models.schemas import ErrorCode


class TestPipelineTimer:
    def test_elapsed(self):
        timer = PipelineTimer()
        assert timer.elapsed() >= 0

    def test_elapsed_str(self):
        timer = PipelineTimer()
        s = timer.elapsed_str()
        assert s.endswith("s")


class TestTranscriptData:
    def test_creation(self):
        td = TranscriptData(
            segments=[],
            raw_text="hello world",
            transcript_type="subtitle",
            source="ytdlp",
        )
        assert td.raw_text == "hello world"
        assert td.source == "ytdlp"


class TestSseEvent:
    def test_basic_event(self):
        result = sse_event("metadata", {"title": "Test"})
        assert result.startswith("data: ")
        assert result.endswith("\n\n")
        data = json.loads(result[6:].strip())
        assert data["event"] == "metadata"
        assert data["title"] == "Test"


class TestSseToken:
    def test_basic_token(self):
        result = sse_token("chapter_detect", "hello")
        data = json.loads(result[6:].strip())
        assert data["event"] == "token"
        assert data["phase"] == "chapter_detect"
        assert data["token"] == "hello"


class TestNormalizeSegments:
    def test_seconds_format(self):
        segments = [{"text": "hello", "start": 1.5, "duration": 2.0}]
        result = normalize_segments(segments)
        assert result[0]["startMs"] == 1500
        assert result[0]["endMs"] == 3500
        assert result[0]["text"] == "hello"

    def test_ms_format(self):
        segments = [{"text": "world", "startMs": 1000, "endMs": 2000}]
        result = normalize_segments(segments)
        assert result[0]["startMs"] == 1000
        assert result[0]["endMs"] == 2000


class TestValidateDuration:
    def test_valid_duration(self):
        validate_duration(600)  # 10 minutes, should not raise

    def test_too_long(self):
        with pytest.raises(TranscriptError):
            validate_duration(999999)

    def test_too_short(self):
        with pytest.raises(TranscriptError):
            validate_duration(1)


class TestRunParallelPhases:
    """Tests for run_parallel_phases — heartbeat keepalive + event forwarding.

    The heartbeat exists because a long silent phase (multi-minute Whisper)
    otherwise sends zero bytes, and the API gateway's undici proxy aborts the
    idle-but-live SSE connection at its 300s bodyTimeout.
    """

    async def test_heartbeat_emitted_when_phase_is_idle(self, monkeypatch):
        """A phase that produces no event within the window triggers a heartbeat."""
        monkeypatch.setattr(
            "src.services.pipeline.pipeline_helpers.settings.SSE_HEARTBEAT_SECONDS", 0.02
        )

        async def slow_phase(ctx):
            await asyncio.sleep(0.12)  # several heartbeat windows of silence
            yield sse_event("phase", {"phase": "done"})

        events = [e async for e in run_parallel_phases([slow_phase], ctx=None)]  # type: ignore[arg-type]

        assert any('"event": "heartbeat"' in e for e in events)
        assert any('"phase": "done"' in e for e in events)

    async def test_real_events_forwarded_without_spurious_heartbeats(self, monkeypatch):
        """Events arriving faster than the window are forwarded in order, no heartbeat."""
        monkeypatch.setattr(
            "src.services.pipeline.pipeline_helpers.settings.SSE_HEARTBEAT_SECONDS", 5.0
        )

        async def fast_phase(ctx):
            yield sse_event("token", {"phase": "p", "token": "a"})
            yield sse_event("token", {"phase": "p", "token": "b"})

        events = [e async for e in run_parallel_phases([fast_phase], ctx=None)]  # type: ignore[arg-type]

        assert not any('"event": "heartbeat"' in e for e in events)
        tokens = [e for e in events if '"event": "token"' in e]
        assert len(tokens) == 2

    async def test_phase_exception_propagates(self, monkeypatch):
        """An exception raised in a phase propagates out of the runner (regression)."""
        monkeypatch.setattr(
            "src.services.pipeline.pipeline_helpers.settings.SSE_HEARTBEAT_SECONDS", 5.0
        )

        async def boom_phase(ctx):
            raise TranscriptError("boom", ErrorCode.UNKNOWN_ERROR)
            yield  # pragma: no cover — makes this an async generator

        with pytest.raises(TranscriptError):
            async for _ in run_parallel_phases([boom_phase], ctx=None):  # type: ignore[arg-type]
                pass
