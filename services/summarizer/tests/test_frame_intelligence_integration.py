"""Integration tests: frame intelligence pipeline chain.

Verifies the full data flow:
  vision descriptions → inject_visual_context → extraction prompt → assembly

Uses realistic data fixtures to simulate the pipeline without real LLM/network calls.
"""

import json

from src.services.pipeline.scene_frames import inject_visual_context
from src.services.pipeline.assembly import (
    assemble_response,
    find_description_for_frame,
)
from src.services.media.frame_analyzer import parse_vision_response


# ─────────────────────────────────────────────────────────────────────────────
# Realistic Fixtures
# ─────────────────────────────────────────────────────────────────────────────

_TRANSCRIPT = (
    "Welcome to this Python tutorial.\n"
    "Today we're going to learn about binary search.\n"
    "Let me show you the code on screen.\n"
    "As you can see here, the function takes an array and a target.\n"
    "We start by setting low and high pointers.\n"
    "Then we loop until we find the target.\n"
    "Let me walk you through the time complexity.\n"
    "Binary search runs in O(log n) time.\n"
    "That's much faster than linear search.\n"
    "Now let's look at some edge cases.\n"
    "What happens when the array is empty?\n"
    "We return -1 immediately.\n"
    "Let me show you a diagram of how the search space shrinks.\n"
    "Notice how each step halves the search space.\n"
    "That's the key insight of binary search.\n"
    "Thanks for watching, see you next time."
)

_SEGMENTS = [
    {"text": "Welcome to this Python tutorial.", "startMs": 0, "endMs": 3000},
    {"text": "Today we're going to learn about binary search.", "startMs": 3000, "endMs": 7000},
    {"text": "Let me show you the code on screen.", "startMs": 7000, "endMs": 10000},
    {"text": "As you can see here, the function takes an array and a target.", "startMs": 10000, "endMs": 15000},
    {"text": "We start by setting low and high pointers.", "startMs": 15000, "endMs": 19000},
    {"text": "Then we loop until we find the target.", "startMs": 19000, "endMs": 23000},
    {"text": "Let me walk you through the time complexity.", "startMs": 23000, "endMs": 27000},
    {"text": "Binary search runs in O(log n) time.", "startMs": 27000, "endMs": 31000},
    {"text": "That's much faster than linear search.", "startMs": 31000, "endMs": 35000},
    {"text": "Now let's look at some edge cases.", "startMs": 35000, "endMs": 39000},
    {"text": "What happens when the array is empty?", "startMs": 39000, "endMs": 43000},
    {"text": "We return -1 immediately.", "startMs": 43000, "endMs": 46000},
    {"text": "Let me show you a diagram of how the search space shrinks.", "startMs": 46000, "endMs": 51000},
    {"text": "Notice how each step halves the search space.", "startMs": 51000, "endMs": 55000},
    {"text": "That's the key insight of binary search.", "startMs": 55000, "endMs": 59000},
    {"text": "Thanks for watching, see you next time.", "startMs": 59000, "endMs": 63000},
]

_FRAME_DESCRIPTIONS = [
    {
        "frame_index": 0,
        "scene_type": "code",
        "content": "Python binary search function with low/high pointer variables",
        "text_visible": "def binary_search(arr, target):\n    low, high = 0, len(arr) - 1",
        "educational_value": "Shows the exact implementation being discussed",
        "timestamp_sec": 12.0,
        "s3_url": "https://s3.example.com/frame_012.jpg",
        "original_index": 12,
    },
    {
        "frame_index": 1,
        "scene_type": "talking_head",
        "content": "Presenter speaking to camera",
        "text_visible": "",
        "educational_value": None,
        "timestamp_sec": 25.0,
        "s3_url": "https://s3.example.com/frame_025.jpg",
        "original_index": 25,
    },
    {
        "frame_index": 2,
        "scene_type": "diagram",
        "content": "Flowchart showing binary search decision tree with array halving",
        "text_visible": "O(log n)",
        "educational_value": "Visualizes how the search space shrinks at each step",
        "timestamp_sec": 48.0,
        "s3_url": "https://s3.example.com/frame_048.jpg",
        "original_index": 48,
    },
    {
        "frame_index": 3,
        "scene_type": "slide",
        "content": "Summary slide with key takeaways",
        "text_visible": "Key Takeaways:\n1. O(log n)\n2. Sorted array required",
        "educational_value": "Summarizes the main points of the tutorial",
        "timestamp_sec": 57.0,
        "s3_url": "https://s3.example.com/frame_057.jpg",
        "original_index": 57,
    },
]

_ALL_FRAMES = [
    {"index": 3, "timestamp": 3.0, "ocr_text": "Python Binary Search Tutorial", "s3_url": "https://s3.example.com/frame_003.jpg"},
    {"index": 5, "timestamp": 8.0, "ocr_text": "binary_search.py — VS Code", "s3_url": "https://s3.example.com/frame_005.jpg"},
    {"index": 10, "timestamp": 10.0, "ocr_text": "def binary_search(arr, target):", "s3_url": "https://s3.example.com/frame_010.jpg"},
    {"index": 12, "timestamp": 12.0, "ocr_text": "def binary_search(arr, target):", "s3_url": "https://s3.example.com/frame_012.jpg"},
    {"index": 15, "timestamp": 15.0, "ocr_text": "low = 0, high = len(arr) - 1", "s3_url": "https://s3.example.com/frame_015.jpg"},
    {"index": 20, "timestamp": 20.0, "ocr_text": "while low <= high:", "s3_url": "https://s3.example.com/frame_020.jpg"},
    {"index": 25, "timestamp": 25.0, "ocr_text": None, "s3_url": "https://s3.example.com/frame_025.jpg"},
    {"index": 30, "timestamp": 30.0, "ocr_text": "Time Complexity Analysis", "s3_url": "https://s3.example.com/frame_030.jpg"},
    {"index": 35, "timestamp": 35.0, "ocr_text": "Edge cases to consider:", "s3_url": "https://s3.example.com/frame_035.jpg"},
    {"index": 40, "timestamp": 40.0, "ocr_text": "Empty array → return -1", "s3_url": "https://s3.example.com/frame_040.jpg"},
    {"index": 48, "timestamp": 48.0, "ocr_text": "O(log n)", "s3_url": "https://s3.example.com/frame_048.jpg"},
    {"index": 53, "timestamp": 53.0, "ocr_text": "Search space halving diagram", "s3_url": "https://s3.example.com/frame_053.jpg"},
    {"index": 57, "timestamp": 57.0, "ocr_text": "Key Takeaways", "s3_url": "https://s3.example.com/frame_057.jpg"},
]

_GALLERY_FRAMES = [
    {"index": 3, "timestamp": 3.0, "s3_url": "https://s3.example.com/frame_003.jpg", "ocr_text": "Python Binary Search Tutorial"},
    {"index": 10, "timestamp": 10.0, "s3_url": "https://s3.example.com/frame_010.jpg", "ocr_text": "def binary_search(arr, target):"},
    {"index": 12, "timestamp": 12.0, "s3_url": "https://s3.example.com/frame_012.jpg", "ocr_text": "def binary_search(arr, target):"},
    {"index": 15, "timestamp": 15.0, "s3_url": "https://s3.example.com/frame_015.jpg", "ocr_text": "low = 0, high = len(arr) - 1"},
    {"index": 20, "timestamp": 20.0, "s3_url": "https://s3.example.com/frame_020.jpg", "ocr_text": "while low <= high:"},
    {"index": 30, "timestamp": 30.0, "s3_url": "https://s3.example.com/frame_030.jpg", "ocr_text": "Time Complexity Analysis"},
    {"index": 35, "timestamp": 35.0, "s3_url": "https://s3.example.com/frame_035.jpg", "ocr_text": "Edge cases to consider:"},
    {"index": 40, "timestamp": 40.0, "s3_url": "https://s3.example.com/frame_040.jpg", "ocr_text": "Empty array → return -1"},
    {"index": 48, "timestamp": 48.0, "s3_url": "https://s3.example.com/frame_048.jpg", "ocr_text": "O(log n)"},
    {"index": 53, "timestamp": 53.0, "s3_url": "https://s3.example.com/frame_053.jpg", "ocr_text": "Search space halving diagram"},
    {"index": 57, "timestamp": 57.0, "s3_url": "https://s3.example.com/frame_057.jpg", "ocr_text": "Key Takeaways"},
]


# ─────────────────────────────────────────────────────────────────────────────
# Integration: inject_visual_context
# ─────────────────────────────────────────────────────────────────────────────


class TestVisualContextInjectionIntegration:
    """Test the full inject_visual_context chain with realistic data."""

    def test_visual_annotations_appear_at_correct_positions(self):
        """Core integration: vision descriptions inject into transcript at right times."""
        result = inject_visual_context(_TRANSCRIPT, _SEGMENTS, _FRAME_DESCRIPTIONS, _ALL_FRAMES)

        # Vision annotations should be present
        assert "[VISUAL at 0:12:" in result
        assert "binary search function" in result
        assert "[VISUAL at 0:48:" in result
        assert "Flowchart showing" in result
        assert "[VISUAL at 0:57:" in result
        assert "Summary slide" in result

    def test_talking_head_filtered_out(self):
        """Frame at 0:25 is talking_head with no value — should not appear."""
        result = inject_visual_context(_TRANSCRIPT, _SEGMENTS, _FRAME_DESCRIPTIONS, _ALL_FRAMES)
        assert "[VISUAL at 0:25:" not in result
        assert "Presenter speaking" not in result

    def test_ocr_annotations_for_non_vision_frames(self):
        """Frames not covered by vision should get OCR annotations."""
        result = inject_visual_context(_TRANSCRIPT, _SEGMENTS, _FRAME_DESCRIPTIONS, _ALL_FRAMES)

        # Frame index 5 (timestamp 8s) has OCR but no vision → should get ON-SCREEN TEXT
        assert "[ON-SCREEN TEXT at 0:08:" in result
        assert "binary_search.py" in result

        # Frame index 35 (timestamp 35s) has OCR but no vision → should get ON-SCREEN TEXT
        assert "[ON-SCREEN TEXT at 0:35:" in result
        assert "Edge cases" in result

    def test_no_duplicate_ocr_for_vision_frames(self):
        """Frames covered by vision should NOT also get OCR annotations."""
        result = inject_visual_context(_TRANSCRIPT, _SEGMENTS, _FRAME_DESCRIPTIONS, _ALL_FRAMES)

        # Frame index 12 is covered by vision → no ON-SCREEN TEXT
        assert "[ON-SCREEN TEXT at 0:12:" not in result
        # Frame index 48 is covered by vision → no ON-SCREEN TEXT
        assert "[ON-SCREEN TEXT at 0:48:" not in result

    def test_annotation_ordering_in_transcript(self):
        """Annotations must appear in chronological order within the transcript."""
        result = inject_visual_context(_TRANSCRIPT, _SEGMENTS, _FRAME_DESCRIPTIONS, _ALL_FRAMES)

        positions = []
        for marker in ["0:08:", "0:12:", "0:35:", "0:48:", "0:57:"]:
            pos = result.find(marker)
            if pos != -1:
                positions.append(pos)

        # All found markers should be in ascending order
        assert positions == sorted(positions), f"Annotations not in order: {positions}"

    def test_original_transcript_preserved(self):
        """All original transcript lines should still be present."""
        result = inject_visual_context(_TRANSCRIPT, _SEGMENTS, _FRAME_DESCRIPTIONS, _ALL_FRAMES)

        for line in _TRANSCRIPT.strip().split("\n"):
            assert line in result, f"Original line missing: {line!r}"

    def test_extraction_prompt_would_contain_annotations(self):
        """Simulate what the extraction LLM would see."""
        injected = inject_visual_context(_TRANSCRIPT, _SEGMENTS, _FRAME_DESCRIPTIONS, _ALL_FRAMES)

        # Count how many visual context annotations exist
        visual_count = injected.count("[VISUAL at")
        ocr_count = injected.count("[ON-SCREEN TEXT at")

        # We have 3 vision frames (1 talking_head filtered) + 9 OCR-only frames
        assert visual_count == 3, f"Expected 3 vision annotations, got {visual_count}"
        assert ocr_count == 9, f"Expected 9 OCR annotations, got {ocr_count}"

    def test_without_segments_uses_estimation(self):
        """When segments are None, annotations should still appear via estimation."""
        result = inject_visual_context(_TRANSCRIPT, None, _FRAME_DESCRIPTIONS, _ALL_FRAMES)

        # Should still have annotations
        assert "[VISUAL at" in result
        assert "[ON-SCREEN TEXT at" in result

    def test_empty_descriptions_only_uses_ocr(self):
        """With no vision descriptions, only OCR annotations should appear."""
        result = inject_visual_context(_TRANSCRIPT, _SEGMENTS, [], _ALL_FRAMES)

        assert "[VISUAL at" not in result
        # OCR annotations for frames with text
        assert "[ON-SCREEN TEXT at" in result


# ─────────────────────────────────────────────────────────────────────────────
# Integration: assembly with frame_descriptions
# ─────────────────────────────────────────────────────────────────────────────


class TestAssemblyWithFrameDescriptions:
    """Test that assembly uses frame_descriptions for gallery captions."""

    def _triage_with_overview(self):
        return {
            "contentTags": ["tech"],
            "primaryTag": "tech",
            "userGoal": "Learn binary search",
            "modifiers": [],
            "tabs": [
                {"id": "overview", "label": "Overview", "emoji": "📖", "dataSource": "tech"},
                {"id": "code", "label": "Code", "emoji": "💻", "dataSource": "tech.snippets"},
            ],
        }

    def _extraction(self):
        return {
            "tech": {
                "languages": ["Python"],
                "snippets": [{"language": "python", "code": "def binary_search():", "explanation": "Main function"}],
            },
        }

    def test_gallery_captions_from_vision_descriptions(self):
        """Gallery images should use vision content for captions when available."""
        result = assemble_response(
            triage=self._triage_with_overview(),
            extraction=self._extraction(),
            enrichment=None,
            synthesis={"tldr": "A binary search tutorial"},
            frames=_ALL_FRAMES,
            gallery_frames=_GALLERY_FRAMES,
            all_frames=_ALL_FRAMES,
            frame_descriptions=_FRAME_DESCRIPTIONS,
        )

        # Find the gallery tab
        gallery_tab = None
        for tab in result["tabs"]:
            if tab["id"] == "frames-gallery":
                gallery_tab = tab
                break

        assert gallery_tab is not None, "Gallery tab not found"
        images = gallery_tab["props"]["images"]
        assert len(images) == len(_GALLERY_FRAMES)

        # Frame at 12s should have vision description as caption
        frame_12 = next(img for img in images if img["timestamp"] == 12.0)
        assert "binary search function" in frame_12["caption"].lower()

        # Frame at 48s should have vision description as caption
        frame_48 = next(img for img in images if img["timestamp"] == 48.0)
        assert "flowchart" in frame_48["caption"].lower()

    def test_gallery_captions_fallback_to_ocr(self):
        """Frames not covered by vision should use OCR text for captions."""
        result = assemble_response(
            triage=self._triage_with_overview(),
            extraction=self._extraction(),
            enrichment=None,
            synthesis=None,
            frames=_ALL_FRAMES,
            gallery_frames=_GALLERY_FRAMES,
            all_frames=_ALL_FRAMES,
            frame_descriptions=_FRAME_DESCRIPTIONS,
        )

        gallery_tab = next(t for t in result["tabs"] if t["id"] == "frames-gallery")
        images = gallery_tab["props"]["images"]

        # Frame at 35s has no vision description but has OCR text
        frame_35 = next(img for img in images if img["timestamp"] == 35.0)
        assert "Edge cases" in frame_35["caption"]

    def test_gallery_without_frame_descriptions(self):
        """Without frame_descriptions, gallery uses OCR or generic captions."""
        result = assemble_response(
            triage=self._triage_with_overview(),
            extraction=self._extraction(),
            enrichment=None,
            synthesis=None,
            frames=_ALL_FRAMES,
            gallery_frames=_GALLERY_FRAMES,
            all_frames=_ALL_FRAMES,
            frame_descriptions=None,
        )

        gallery_tab = next(t for t in result["tabs"] if t["id"] == "frames-gallery")
        images = gallery_tab["props"]["images"]

        # Without vision, frame_12 should use OCR text
        frame_12 = next(img for img in images if img["timestamp"] == 12.0)
        assert "def binary_search" in frame_12["caption"]

        # Frame_35 should use OCR text
        frame_35 = next(img for img in images if img["timestamp"] == 35.0)
        assert "Edge cases" in frame_35["caption"]


# ─────────────────────────────────────────────────────────────────────────────
# Integration: find_description_for_frame
# ─────────────────────────────────────────────────────────────────────────────


class TestFindDescriptionForFrame:
    """Test timestamp-based frame description matching."""

    def test_exact_match(self):
        frame = {"timestamp": 12.0}
        desc = find_description_for_frame(frame, _FRAME_DESCRIPTIONS)
        assert desc is not None
        assert desc["scene_type"] == "code"

    def test_close_match_within_tolerance(self):
        frame = {"timestamp": 14.0}  # 2s away from 12.0
        desc = find_description_for_frame(frame, _FRAME_DESCRIPTIONS, tolerance=5.0)
        assert desc is not None
        assert desc["timestamp_sec"] == 12.0

    def test_no_match_outside_tolerance(self):
        frame = {"timestamp": 30.0}  # Far from any description
        desc = find_description_for_frame(frame, _FRAME_DESCRIPTIONS, tolerance=3.0)
        assert desc is None

    def test_empty_descriptions(self):
        frame = {"timestamp": 12.0}
        assert find_description_for_frame(frame, []) is None

    def test_picks_nearest(self):
        frame = {"timestamp": 50.0}  # Closest to 48.0 (diagram)
        desc = find_description_for_frame(frame, _FRAME_DESCRIPTIONS, tolerance=5.0)
        assert desc is not None
        assert desc["scene_type"] == "diagram"


# ─────────────────────────────────────────────────────────────────────────────
# Integration: vision → injection → assembly full chain
# ─────────────────────────────────────────────────────────────────────────────


class TestFullChainIntegration:
    """End-to-end test: vision analysis → transcript injection → assembly."""

    async def test_full_pipeline_chain(self):
        """Simulate the complete frame-intelligence data flow."""
        # Step 1: Vision analysis (mock LLM returns structured response)
        vision_response = json.dumps([
            {
                "frame_index": 0,
                "scene_type": "code",
                "content": "Python binary search implementation",
                "text_visible": "def binary_search(arr, target):",
                "educational_value": "Shows the actual code",
            },
            {
                "frame_index": 1,
                "scene_type": "diagram",
                "content": "Search space halving visualization",
                "text_visible": "O(log n)",
                "educational_value": "Illustrates the algorithm's efficiency",
            },
        ])

        frame_metadata = [
            {"index": 0, "timestamp_sec": 12.0, "s3_url": "https://s3/f12.jpg", "original_index": 12},
            {"index": 1, "timestamp_sec": 48.0, "s3_url": "https://s3/f48.jpg", "original_index": 48},
        ]

        # Parse vision response (unit operation)
        descriptions = parse_vision_response(vision_response, frame_metadata)
        assert len(descriptions) == 2
        assert descriptions[0]["scene_type"] == "code"
        assert descriptions[1]["scene_type"] == "diagram"

        # Step 2: Inject visual context into transcript
        injected_transcript = inject_visual_context(
            _TRANSCRIPT, _SEGMENTS, descriptions, _ALL_FRAMES,
        )

        # Verify annotations appeared
        assert "[VISUAL at 0:12:" in injected_transcript
        assert "[VISUAL at 0:48:" in injected_transcript
        assert "binary search implementation" in injected_transcript

        # OCR-only frames still annotated
        assert "[ON-SCREEN TEXT at" in injected_transcript

        # Original transcript intact
        assert "Welcome to this Python tutorial" in injected_transcript
        assert "Thanks for watching" in injected_transcript

        # Step 3: Assembly with frame_descriptions produces descriptive captions
        assembled = assemble_response(
            triage={
                "contentTags": ["tech"],
                "primaryTag": "tech",
                "userGoal": "Learn binary search",
                "modifiers": [],
                "tabs": [
                    {"id": "code", "label": "Code", "emoji": "💻", "dataSource": "tech.snippets"},
                ],
            },
            extraction={
                "tech": {
                    "snippets": [{"language": "python", "code": "def binary_search():", "explanation": "Main"}],
                },
            },
            enrichment=None,
            synthesis={"tldr": "Binary search tutorial"},
            frames=_ALL_FRAMES,
            gallery_frames=_GALLERY_FRAMES,
            all_frames=_ALL_FRAMES,
            frame_descriptions=descriptions,
        )

        # Gallery tab should exist with descriptive captions
        gallery = next((t for t in assembled["tabs"] if t["id"] == "frames-gallery"), None)
        assert gallery is not None

        captions = [img["caption"] for img in gallery["props"]["images"]]
        # At least one caption should come from vision (not generic "Moment at")
        vision_captions = [c for c in captions if "Moment at" not in c]
        assert len(vision_captions) >= 1, f"No vision captions found: {captions}"

    async def test_pipeline_degrades_gracefully_without_vision(self):
        """When vision returns nothing, pipeline still works with OCR only."""
        # No vision descriptions
        injected = inject_visual_context(_TRANSCRIPT, _SEGMENTS, [], _ALL_FRAMES)

        # No VISUAL annotations
        assert "[VISUAL at" not in injected
        # But OCR annotations present
        assert "[ON-SCREEN TEXT at" in injected

        # Assembly without frame_descriptions
        assembled = assemble_response(
            triage={
                "contentTags": ["learning"],
                "primaryTag": "learning",
                "userGoal": "Learn",
                "modifiers": [],
                "tabs": [],
            },
            extraction={"learning": {"keyPoints": []}},
            enrichment=None,
            synthesis=None,
            frames=_ALL_FRAMES,
            gallery_frames=_GALLERY_FRAMES,
            all_frames=_ALL_FRAMES,
            frame_descriptions=None,
        )

        # Gallery should still exist with OCR/generic captions
        gallery = next((t for t in assembled["tabs"] if t["id"] == "frames-gallery"), None)
        assert gallery is not None
        captions = [img["caption"] for img in gallery["props"]["images"]]
        # All captions should be OCR or generic (no vision)
        assert all("VISUAL" not in c for c in captions)

    async def test_feature_flag_disabled_produces_no_descriptions(self):
        """Simulate FRAME_VISION_ENABLED=false: no frame_descriptions, pipeline unaffected."""
        # With no descriptions and no OCR frames
        empty_frames = [{"index": 0, "timestamp": 10.0}]
        injected = inject_visual_context(_TRANSCRIPT, _SEGMENTS, [], empty_frames)

        # Transcript should be unchanged (no annotations)
        assert injected == _TRANSCRIPT
