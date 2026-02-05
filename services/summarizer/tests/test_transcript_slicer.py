"""Unit tests for transcript slicer utility."""

import pytest
from src.utils.transcript_slicer import (
    slice_transcript_for_chapter,
    slice_transcript_for_chapters,
)


class TestSliceTranscriptForChapter:
    """Tests for slice_transcript_for_chapter function."""

    def test_basic_slicing_within_bounds(self):
        """Should return text from segments within the time range."""
        segments = [
            {"text": "Hello", "startMs": 0, "endMs": 5000},
            {"text": "world", "startMs": 5000, "endMs": 10000},
            {"text": "how", "startMs": 10000, "endMs": 15000},
            {"text": "are", "startMs": 15000, "endMs": 20000},
            {"text": "you", "startMs": 20000, "endMs": 25000},
        ]

        result = slice_transcript_for_chapter(segments, start_seconds=5, end_seconds=20)

        # Should include "world", "how", "are" (startMs >= 5000 and startMs < 20000)
        assert result == "world how are"

    def test_empty_segments_returns_empty_string(self):
        """Should return empty string when no segments provided."""
        result = slice_transcript_for_chapter([], start_seconds=0, end_seconds=10)
        assert result == ""

    def test_no_segments_in_range(self):
        """Should return empty string when no segments fall within range."""
        segments = [
            {"text": "Hello", "startMs": 0, "endMs": 5000},
            {"text": "world", "startMs": 5000, "endMs": 10000},
        ]

        result = slice_transcript_for_chapter(segments, start_seconds=20, end_seconds=30)
        assert result == ""

    def test_partial_overlap_at_start(self):
        """Segment starting before range but overlapping is excluded (we use startMs)."""
        segments = [
            {"text": "before", "startMs": 0, "endMs": 15000},
            {"text": "inside", "startMs": 10000, "endMs": 20000},
        ]

        # startMs=0 < start_seconds=10, so "before" excluded
        # startMs=10000 >= start_seconds=10000 and < 30000, so "inside" included
        result = slice_transcript_for_chapter(segments, start_seconds=10, end_seconds=30)
        assert result == "inside"

    def test_segment_at_exact_boundary(self):
        """Segment starting exactly at end_seconds is excluded."""
        segments = [
            {"text": "inside", "startMs": 5000, "endMs": 10000},
            {"text": "boundary", "startMs": 10000, "endMs": 15000},
        ]

        result = slice_transcript_for_chapter(segments, start_seconds=5, end_seconds=10)
        assert result == "inside"

    def test_millisecond_precision(self):
        """Should handle millisecond precision correctly."""
        segments = [
            {"text": "first", "startMs": 999, "endMs": 1500},
            {"text": "second", "startMs": 1000, "endMs": 2000},
            {"text": "third", "startMs": 1999, "endMs": 2500},
        ]

        # 1 second = 1000ms
        result = slice_transcript_for_chapter(segments, start_seconds=1, end_seconds=2)
        # startMs >= 1000 and startMs < 2000
        assert result == "second third"

    def test_whitespace_handling(self):
        """Should strip leading/trailing whitespace from segments."""
        segments = [
            {"text": "  hello  ", "startMs": 0, "endMs": 5000},
            {"text": "\nworld\n", "startMs": 5000, "endMs": 10000},
        ]

        result = slice_transcript_for_chapter(segments, start_seconds=0, end_seconds=15)
        assert result == "hello world"

    def test_handles_missing_text_gracefully(self):
        """Should skip segments with missing or empty text."""
        segments = [
            {"text": "hello", "startMs": 0, "endMs": 5000},
            {"text": "", "startMs": 5000, "endMs": 10000},
            {"text": None, "startMs": 10000, "endMs": 15000},
            {"text": "world", "startMs": 15000, "endMs": 20000},
        ]

        result = slice_transcript_for_chapter(segments, start_seconds=0, end_seconds=25)
        assert result == "hello world"


class TestSliceTranscriptForChapters:
    """Tests for slice_transcript_for_chapters function."""

    def test_slices_multiple_chapters(self):
        """Should return list of transcripts for each chapter."""
        segments = [
            {"text": "intro", "startMs": 0, "endMs": 5000},
            {"text": "chapter one", "startMs": 10000, "endMs": 20000},
            {"text": "chapter two", "startMs": 30000, "endMs": 40000},
        ]

        chapters = [
            {"startSeconds": 0, "endSeconds": 10},
            {"startSeconds": 10, "endSeconds": 30},
            {"startSeconds": 30, "endSeconds": 60},
        ]

        results = slice_transcript_for_chapters(segments, chapters)

        assert len(results) == 3
        assert results[0] == "intro"
        assert results[1] == "chapter one"
        assert results[2] == "chapter two"

    def test_empty_chapters_returns_empty_list(self):
        """Should return empty list when no chapters provided."""
        segments = [{"text": "hello", "startMs": 0, "endMs": 5000}]
        results = slice_transcript_for_chapters(segments, [])
        assert results == []

    def test_chapter_with_no_transcript(self):
        """Should return empty string for chapters with no matching segments."""
        segments = [{"text": "hello", "startMs": 0, "endMs": 5000}]
        chapters = [
            {"startSeconds": 0, "endSeconds": 10},
            {"startSeconds": 100, "endSeconds": 200},
        ]

        results = slice_transcript_for_chapters(segments, chapters)

        assert len(results) == 2
        assert results[0] == "hello"
        assert results[1] == ""

    def test_handles_dict_with_extra_fields(self):
        """Should work with chapter dicts containing extra fields."""
        segments = [{"text": "content", "startMs": 0, "endMs": 10000}]
        chapters = [
            {
                "id": "ch1",
                "title": "Introduction",
                "startSeconds": 0,
                "endSeconds": 10,
                "isCreatorChapter": True,
            }
        ]

        results = slice_transcript_for_chapters(segments, chapters)
        assert results[0] == "content"


class TestEdgeCases:
    """Edge case tests."""

    def test_very_long_transcript(self):
        """Should handle long transcripts efficiently."""
        segments = [
            {"text": f"word{i}", "startMs": i * 1000, "endMs": (i + 1) * 1000}
            for i in range(1000)
        ]

        result = slice_transcript_for_chapter(segments, start_seconds=100, end_seconds=200)

        # Should have words from 100-199
        words = result.split()
        assert len(words) == 100
        assert words[0] == "word100"
        assert words[-1] == "word199"

    def test_unicode_text(self):
        """Should handle unicode characters correctly."""
        segments = [
            {"text": "Hello 👋", "startMs": 0, "endMs": 5000},
            {"text": "世界", "startMs": 5000, "endMs": 10000},
            {"text": "🎉 Célébration", "startMs": 10000, "endMs": 15000},
        ]

        result = slice_transcript_for_chapter(segments, start_seconds=0, end_seconds=20)
        assert "👋" in result
        assert "世界" in result
        assert "🎉" in result

    def test_zero_duration_chapter(self):
        """Should return empty for zero-duration chapter."""
        segments = [{"text": "hello", "startMs": 0, "endMs": 5000}]
        result = slice_transcript_for_chapter(segments, start_seconds=5, end_seconds=5)
        assert result == ""
