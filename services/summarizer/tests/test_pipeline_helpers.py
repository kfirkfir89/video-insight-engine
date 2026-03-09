"""Tests for pipeline helper dataclasses and utilities."""

from src.services.pipeline.pipeline_helpers import (
    PipelineTimer,
    TranscriptData,
    sse_event,
    sse_token,
    normalize_segments,
    validate_duration,
)

import json
import pytest
from src.exceptions import TranscriptError


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
