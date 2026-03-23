"""Tests for vision LLM frame analysis."""

import asyncio
import json
import os
import tempfile
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.services.media.frame_analyzer import (
    _select_top_frames,
    analyze_frames_with_vision,
    format_visual_annotation,
    parse_vision_response,
)


# ─────────────────────────────────────────────────────
# parse_vision_response
# ─────────────────────────────────────────────────────


class TestParseVisionResponse:
    """Test JSON parsing of vision LLM output."""

    def _metadata(self, count: int = 3) -> list[dict]:
        return [
            {"index": i, "timestamp_sec": i * 60.0, "s3_url": f"https://s3/frame_{i}.jpg", "original_index": i}
            for i in range(count)
        ]

    def test_valid_json_array(self):
        raw = json.dumps([
            {"frame_index": 0, "scene_type": "code", "content": "Python function", "text_visible": "def foo():", "educational_value": "Shows impl"},
            {"frame_index": 1, "scene_type": "slide", "content": "Architecture diagram", "text_visible": "", "educational_value": "System overview"},
        ])
        results = parse_vision_response(raw, self._metadata(2))

        assert len(results) == 2
        assert results[0]["scene_type"] == "code"
        assert results[0]["content"] == "Python function"
        assert results[0]["text_visible"] == "def foo():"
        assert results[0]["timestamp_sec"] == 0.0
        assert results[0]["s3_url"] == "https://s3/frame_0.jpg"
        assert results[1]["scene_type"] == "slide"
        assert results[1]["timestamp_sec"] == 60.0

    def test_fenced_json(self):
        raw = "```json\n" + json.dumps([
            {"frame_index": 0, "scene_type": "diagram", "content": "ER diagram", "text_visible": "", "educational_value": "DB schema"},
        ]) + "\n```"
        results = parse_vision_response(raw, self._metadata(1))

        assert len(results) == 1
        assert results[0]["scene_type"] == "diagram"

    def test_fenced_without_lang(self):
        raw = "```\n" + json.dumps([
            {"frame_index": 0, "scene_type": "table", "content": "Comparison table", "text_visible": "", "educational_value": "Feature comparison"},
        ]) + "\n```"
        results = parse_vision_response(raw, self._metadata(1))

        assert len(results) == 1

    def test_malformed_json(self):
        results = parse_vision_response("not valid json {{{", self._metadata())
        assert results == []

    def test_empty_string(self):
        assert parse_vision_response("", self._metadata()) == []

    def test_none_text(self):
        assert parse_vision_response(None, self._metadata()) == []

    def test_json_object_not_array(self):
        raw = json.dumps({"frame_index": 0, "scene_type": "code"})
        results = parse_vision_response(raw, self._metadata())
        assert results == []

    def test_missing_fields_get_defaults(self):
        raw = json.dumps([{"frame_index": 0}])
        results = parse_vision_response(raw, self._metadata(1))

        assert len(results) == 1
        assert results[0]["scene_type"] == "other"
        assert results[0]["content"] == ""
        assert results[0]["text_visible"] == ""
        assert results[0]["educational_value"] is None

    def test_frame_index_out_of_range(self):
        raw = json.dumps([{"frame_index": 99, "scene_type": "code", "content": "test"}])
        results = parse_vision_response(raw, self._metadata(1))

        assert len(results) == 1
        # Out-of-range index → empty metadata
        assert results[0]["timestamp_sec"] == 0
        assert results[0]["s3_url"] == ""

    def test_non_dict_items_skipped(self):
        raw = json.dumps([
            "not a dict",
            {"frame_index": 0, "scene_type": "code", "content": "test"},
            42,
        ])
        results = parse_vision_response(raw, self._metadata(1))
        assert len(results) == 1


# ─────────────────────────────────────────────────────
# format_visual_annotation
# ─────────────────────────────────────────────────────


class TestFormatVisualAnnotation:
    """Test annotation string formatting."""

    def test_basic_annotation(self):
        desc = {"timestamp_sec": 222, "content": "Python class definition", "text_visible": ""}
        result = format_visual_annotation(desc)
        assert result == "[VISUAL at 3:42: Python class definition]"

    def test_with_visible_text(self):
        desc = {"timestamp_sec": 65, "content": "Code editor", "text_visible": "def main():"}
        result = format_visual_annotation(desc)
        assert result == '[VISUAL at 1:05: Code editor; Text: "def main():"]'

    def test_zero_timestamp(self):
        desc = {"timestamp_sec": 0, "content": "Opening slide", "text_visible": ""}
        result = format_visual_annotation(desc)
        assert result == "[VISUAL at 0:00: Opening slide]"

    def test_large_timestamp(self):
        desc = {"timestamp_sec": 3661, "content": "Final summary", "text_visible": ""}
        result = format_visual_annotation(desc)
        assert result == "[VISUAL at 61:01: Final summary]"


# ─────────────────────────────────────────────────────
# _select_top_frames
# ─────────────────────────────────────────────────────


class TestSelectTopFrames:
    """Test frame selection by score."""

    def test_selects_top_by_score(self):
        with tempfile.TemporaryDirectory() as d:
            paths = []
            for i in range(5):
                p = os.path.join(d, f"frame_{i}.jpg")
                with open(p, "wb") as f:
                    f.write(b"\xff\xd8\xff")
                paths.append(p)

            frames = [
                {"path": paths[i], "total_score": (i + 1) * 0.1, "index": i}
                for i in range(5)
            ]
            result = _select_top_frames(frames, 3)

            assert len(result) == 3
            # Highest scores first
            assert result[0]["total_score"] == 0.5
            assert result[1]["total_score"] == 0.4

    def test_skips_missing_files(self):
        frames = [
            {"path": "/nonexistent/frame.jpg", "total_score": 0.9, "index": 0},
        ]
        result = _select_top_frames(frames, 5)
        assert result == []

    def test_skips_no_path(self):
        frames = [{"total_score": 0.9, "index": 0}]
        result = _select_top_frames(frames, 5)
        assert result == []

    def test_empty_frames(self):
        assert _select_top_frames([], 5) == []


# ─────────────────────────────────────────────────────
# analyze_frames_with_vision
# ─────────────────────────────────────────────────────


class TestAnalyzeFramesWithVision:
    """Test the main vision analysis function."""

    @pytest.mark.asyncio
    async def test_returns_empty_on_no_valid_frames(self):
        provider = MagicMock()
        result = await analyze_frames_with_vision([], provider, max_frames=8)
        assert result == []

    @pytest.mark.asyncio
    async def test_returns_empty_on_timeout(self):
        provider = MagicMock()
        provider.complete_with_messages = AsyncMock(side_effect=asyncio.TimeoutError)

        with tempfile.TemporaryDirectory() as d:
            path = os.path.join(d, "frame.jpg")
            with open(path, "wb") as f:
                f.write(b"\xff\xd8\xff\xe0" + b"\x00" * 100)

            frames = [{"path": path, "total_score": 0.8, "index": 0, "timestamp": 30}]
            result = await analyze_frames_with_vision(frames, provider, timeout=0.1)
            assert result == []

    @pytest.mark.asyncio
    async def test_returns_empty_on_exception(self):
        provider = MagicMock()
        provider.complete_with_messages = AsyncMock(side_effect=RuntimeError("API down"))

        with tempfile.TemporaryDirectory() as d:
            path = os.path.join(d, "frame.jpg")
            with open(path, "wb") as f:
                f.write(b"\xff\xd8\xff\xe0" + b"\x00" * 100)

            frames = [{"path": path, "total_score": 0.8, "index": 0, "timestamp": 30}]
            result = await analyze_frames_with_vision(frames, provider)
            assert result == []

    @pytest.mark.asyncio
    async def test_successful_analysis(self):
        response_json = json.dumps([
            {"frame_index": 0, "scene_type": "code", "content": "Binary search impl", "text_visible": "def search():", "educational_value": "Core algorithm"},
        ])
        provider = MagicMock()
        provider.complete_with_messages = AsyncMock(return_value=response_json)

        with tempfile.TemporaryDirectory() as d:
            path = os.path.join(d, "frame.jpg")
            with open(path, "wb") as f:
                f.write(b"\xff\xd8\xff\xe0" + b"\x00" * 100)

            frames = [{"path": path, "total_score": 0.8, "index": 5, "timestamp": 90}]
            result = await analyze_frames_with_vision(frames, provider, max_frames=8)

            assert len(result) == 1
            assert result[0]["scene_type"] == "code"
            assert result[0]["content"] == "Binary search impl"
            assert result[0]["timestamp_sec"] == 90

    @pytest.mark.asyncio
    async def test_max_frames_cap(self):
        provider = MagicMock()
        provider.complete_with_messages = AsyncMock(return_value="[]")

        with tempfile.TemporaryDirectory() as d:
            frames = []
            for i in range(20):
                path = os.path.join(d, f"frame_{i}.jpg")
                with open(path, "wb") as f:
                    f.write(b"\xff\xd8\xff\xe0" + b"\x00" * 100)
                frames.append({"path": path, "total_score": i * 0.05, "index": i, "timestamp": i * 10})

            await analyze_frames_with_vision(frames, provider, max_frames=5)

            # Verify only 5 images were sent (check the multipart content)
            call_args = provider.complete_with_messages.call_args
            messages = call_args[0][0]
            content = messages[0]["content"]
            image_count = sum(1 for c in content if c.get("type") == "image_url")
            assert image_count == 5
