"""Tests for pipeline helper dataclasses and utilities."""

from unittest.mock import MagicMock

import pytest

from src.services.override_state import _overrides
from src.services.pipeline_helpers import (
    ChapterProcessingContext,
    PipelineTimer,
    PostprocessContext,
    TranscriptData,
    apply_override,
)


class TestChapterProcessingContext:
    """ChapterProcessingContext is a frozen dataclass."""

    def test_frozen(self):
        ctx = ChapterProcessingContext(
            llm_service=MagicMock(),
            persona="general",
            normalized_segments=[],
        )
        assert ctx.persona == "general"
        assert ctx.youtube_id is None

    def test_with_youtube_id(self):
        ctx = ChapterProcessingContext(
            llm_service=MagicMock(),
            persona="expert",
            normalized_segments=[{"text": "hello"}],
            youtube_id="abc123",
        )
        assert ctx.youtube_id == "abc123"


class TestPostprocessContext:
    """PostprocessContext bundles args for _postprocess_and_yield_chapters."""

    def test_creation(self):
        ctx = PostprocessContext(
            state=MagicMock(),
            provider=MagicMock(),
            facts_by_idx={0: "fact1"},
            youtube_id="vid1",
            video_duration=600,
            normalized_segments=[],
            is_creator=True,
        )
        assert ctx.youtube_id == "vid1"
        assert ctx.video_duration == 600
        assert ctx.is_creator is True
        assert ctx.facts_by_idx == {0: "fact1"}

    def test_frozen(self):
        ctx = PostprocessContext(
            state=MagicMock(),
            provider=MagicMock(),
            facts_by_idx={},
            youtube_id=None,
            video_duration=120,
            normalized_segments=[],
            is_creator=False,
        )
        with pytest.raises(AttributeError):
            ctx.video_duration = 999  # type: ignore[misc]


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


class TestApplyOverride:
    """Test apply_override() composition function."""

    @pytest.fixture(autouse=True)
    def clean_overrides(self):
        _overrides.clear()
        yield
        _overrides.clear()

    def test_returns_ctx_defaults_when_no_override(self):
        ctx = ChapterProcessingContext(
            llm_service=MagicMock(),
            persona="code",
            normalized_segments=[],
            output_type="tutorial",
            video_summary_id="vid-1",
        )
        persona, output_type = apply_override(ctx)
        assert persona == "code"
        assert output_type == "tutorial"

    def test_returns_ctx_defaults_when_no_video_summary_id(self):
        ctx = ChapterProcessingContext(
            llm_service=MagicMock(),
            persona="recipe",
            normalized_segments=[],
            output_type="recipe",
        )
        persona, output_type = apply_override(ctx)
        assert persona == "recipe"
        assert output_type == "recipe"

    def test_returns_override_when_present(self):
        _overrides["vid-1"] = {
            "category": "fitness",
            "persona": "fitness",
            "output_type": "workout",
        }
        ctx = ChapterProcessingContext(
            llm_service=MagicMock(),
            persona="code",
            normalized_segments=[],
            output_type="tutorial",
            video_summary_id="vid-1",
        )
        persona, output_type = apply_override(ctx)
        assert persona == "fitness"
        assert output_type == "workout"

    def test_ignores_override_for_different_id(self):
        _overrides["vid-other"] = {
            "category": "fitness",
            "persona": "fitness",
            "output_type": "workout",
        }
        ctx = ChapterProcessingContext(
            llm_service=MagicMock(),
            persona="code",
            normalized_segments=[],
            output_type="tutorial",
            video_summary_id="vid-1",
        )
        persona, output_type = apply_override(ctx)
        assert persona == "code"
        assert output_type == "tutorial"
