"""Tests for visual context injection into transcripts."""

import pytest

from src.services.pipeline.scene_frames import (
    inject_visual_context,
    _insert_with_estimation,
    _insert_with_segments,
)


class TestInjectVisualContext:
    """Test the main inject_visual_context function."""

    def test_empty_inputs_returns_unchanged(self):
        text = "Hello world transcript."
        result = inject_visual_context(text, None, [], [])
        assert result == text

    def test_empty_text_returns_empty(self):
        result = inject_visual_context("", None, [], [])
        assert result == ""

    def test_vision_annotations_inserted(self):
        text = "First segment of transcript.\nSecond segment continues here.\nThird segment ends."
        descriptions = [
            {
                "scene_type": "code",
                "content": "Python function",
                "text_visible": "def foo():",
                "educational_value": "Shows implementation",
                "timestamp_sec": 30,
                "original_index": 1,
            },
        ]
        result = inject_visual_context(text, None, descriptions, [])

        assert "[VISUAL at 0:30:" in result
        assert "Python function" in result

    def test_talking_head_filtered_out(self):
        text = "Some transcript text.\nMore text here."
        descriptions = [
            {
                "scene_type": "talking_head",
                "content": "Speaker talking",
                "text_visible": "",
                "educational_value": None,  # No educational value
                "timestamp_sec": 10,
                "original_index": 0,
            },
        ]
        result = inject_visual_context(text, None, descriptions, [])
        assert result == text  # Should be unchanged

    def test_talking_head_with_value_kept(self):
        text = "Some transcript text.\nMore text here."
        descriptions = [
            {
                "scene_type": "talking_head",
                "content": "Speaker demonstrating hand gesture",
                "text_visible": "",
                "educational_value": "Shows the technique being discussed",
                "timestamp_sec": 10,
                "original_index": 0,
            },
        ]
        result = inject_visual_context(text, None, descriptions, [])
        assert "[VISUAL at 0:10:" in result

    def test_ocr_only_frames(self):
        text = "Transcript line one.\nTranscript line two."
        all_frames = [
            {"index": 0, "timestamp": 15, "ocr_text": "import numpy as np\nimport pandas as pd"},
            {"index": 1, "timestamp": 45, "ocr_text": "short"},  # Too short, filtered
        ]
        result = inject_visual_context(text, None, [], all_frames)

        assert "[ON-SCREEN TEXT at 0:15:" in result
        assert "import numpy" in result
        assert "[ON-SCREEN TEXT at 0:45:" not in result  # Too short

    def test_no_duplicate_vision_and_ocr(self):
        text = "Transcript content here.\nMore content follows."
        descriptions = [
            {
                "scene_type": "code",
                "content": "Code editor",
                "text_visible": "def foo():",
                "educational_value": "Shows code",
                "timestamp_sec": 30,
                "original_index": 5,
            },
        ]
        all_frames = [
            {"index": 5, "timestamp": 30, "ocr_text": "def foo(): pass"},  # Same frame
            {"index": 10, "timestamp": 60, "ocr_text": "pip install requests"},  # Different frame
        ]
        result = inject_visual_context(text, None, descriptions, all_frames)

        # Vision annotation present
        assert "[VISUAL at 0:30:" in result
        # OCR for frame 5 should NOT be present (already covered by vision)
        assert result.count("[ON-SCREEN TEXT at 0:30:") == 0
        # OCR for frame 10 should be present
        assert "[ON-SCREEN TEXT at 1:00:" in result

    def test_with_segments(self):
        text = "Welcome to the tutorial.\nToday we learn Python.\nLet's start coding."
        segments = [
            {"text": "Welcome to the tutorial.", "startMs": 0, "endMs": 5000},
            {"text": "Today we learn Python.", "startMs": 5000, "endMs": 10000},
            {"text": "Let's start coding.", "startMs": 10000, "endMs": 15000},
        ]
        descriptions = [
            {
                "scene_type": "slide",
                "content": "Title slide",
                "text_visible": "Python 101",
                "educational_value": "Course title",
                "timestamp_sec": 7,
                "original_index": 0,
            },
        ]
        result = inject_visual_context(text, segments, descriptions, [])

        assert "[VISUAL at 0:07:" in result
        # Should appear after the second segment
        lines = result.split("\n")
        visual_line_idx = next(i for i, line in enumerate(lines) if "[VISUAL at" in line)
        assert visual_line_idx > 0  # Not at the very beginning

    def test_annotations_sorted_by_timestamp(self):
        text = "Line one.\nLine two.\nLine three.\nLine four."
        descriptions = [
            {"scene_type": "code", "content": "Later frame", "text_visible": "", "educational_value": "x", "timestamp_sec": 60, "original_index": 1},
            {"scene_type": "slide", "content": "Earlier frame", "text_visible": "", "educational_value": "x", "timestamp_sec": 10, "original_index": 0},
        ]
        result = inject_visual_context(text, None, descriptions, [])

        earlier_pos = result.find("Earlier frame")
        later_pos = result.find("Later frame")
        assert earlier_pos < later_pos


class TestInsertWithSegments:
    """Test segment-based insertion positioning."""

    def test_inserts_after_matching_segment(self):
        text = "First sentence here.\nSecond sentence here.\nThird sentence here."
        segments = [
            {"text": "First sentence here.", "startMs": 0, "endMs": 5000},
            {"text": "Second sentence here.", "startMs": 5000, "endMs": 10000},
            {"text": "Third sentence here.", "startMs": 10000, "endMs": 15000},
        ]
        annotations = [(7.0, "[VISUAL at 0:07: test]")]
        result = _insert_with_segments(text, segments, annotations)

        # Should appear after "Second sentence here."
        assert "Second sentence here.\n[VISUAL at 0:07: test]" in result

    def test_falls_back_to_estimation(self):
        text = "Unmatched text that won't be found.\nSome other text."
        segments = [
            {"text": "This segment text doesn't exist in transcript", "startMs": 0, "endMs": 5000},
        ]
        annotations = [(2.0, "[VISUAL at 0:02: test]")]
        result = _insert_with_segments(text, segments, annotations)

        # Should still insert via estimation fallback
        assert "[VISUAL at 0:02: test]" in result

    def test_multiple_insertions_preserve_positions(self):
        text = "Line A.\nLine B.\nLine C.\nLine D."
        segments = [
            {"text": "Line A.", "startMs": 0, "endMs": 3000},
            {"text": "Line B.", "startMs": 3000, "endMs": 6000},
            {"text": "Line C.", "startMs": 6000, "endMs": 9000},
            {"text": "Line D.", "startMs": 9000, "endMs": 12000},
        ]
        annotations = [
            (1.0, "[V1]"),
            (7.0, "[V2]"),
        ]
        result = _insert_with_segments(text, segments, annotations)

        v1_pos = result.find("[V1]")
        v2_pos = result.find("[V2]")
        assert v1_pos < v2_pos
        assert "[V1]" in result
        assert "[V2]" in result


class TestInsertWithEstimation:
    """Test character-count estimation fallback."""

    def test_inserts_proportionally(self):
        text = "A" * 100 + "\n" + "B" * 100 + "\n" + "C" * 100
        # Timestamp at 50% of a 0-100 range
        annotations = [(50.0, "[MID]"), (100.0, "[END]")]
        result = _insert_with_estimation(text, annotations)

        assert "[MID]" in result
        assert "[END]" in result
        mid_pos = result.find("[MID]")
        end_pos = result.find("[END]")
        # MID should be before END
        assert mid_pos < end_pos

    def test_empty_annotations(self):
        text = "Some text here."
        result = _insert_with_estimation(text, [])
        assert result == text

    def test_zero_max_timestamp(self):
        text = "Some text.\nMore text."
        annotations = [(0.0, "[START]")]
        result = _insert_with_estimation(text, annotations)
        assert "[START]" in result

    def test_multiple_annotations_ordered(self):
        text = "Start.\n" + "Middle content.\n" * 5 + "End."
        annotations = [
            (10.0, "[EARLY]"),
            (90.0, "[LATE]"),
        ]
        result = _insert_with_estimation(text, annotations)

        early_pos = result.find("[EARLY]")
        late_pos = result.find("[LATE]")
        assert early_pos < late_pos
