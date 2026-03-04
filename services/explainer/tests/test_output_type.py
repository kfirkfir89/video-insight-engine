"""Tests for output type label mapping utilities."""

from src.utils.output_type import (
    OUTPUT_TYPE_LABELS,
    get_output_type_hint,
    get_output_type_label,
)

# Must match summarizer's OutputType values
EXPECTED_OUTPUT_TYPES = [
    "summary", "recipe", "tutorial", "workout", "study_guide",
    "travel_plan", "review", "podcast_notes", "diy_guide",
    "game_guide", "music_guide",
]


class TestOutputTypeLabels:
    """Tests for OUTPUT_TYPE_LABELS completeness and structure."""

    def test_all_expected_types_present(self):
        """All 11 output types should have entries."""
        for output_type in EXPECTED_OUTPUT_TYPES:
            assert output_type in OUTPUT_TYPE_LABELS, f"Missing output type: {output_type}"

    def test_each_entry_is_tuple_of_two_strings(self):
        """Each entry should be a (label, hint) tuple."""
        for key, value in OUTPUT_TYPE_LABELS.items():
            assert isinstance(value, tuple), f"{key}: expected tuple, got {type(value)}"
            assert len(value) == 2, f"{key}: expected 2 elements, got {len(value)}"
            assert isinstance(value[0], str), f"{key}: label should be str"
            assert isinstance(value[1], str), f"{key}: hint should be str"

    def test_labels_are_nonempty(self):
        """Labels and hints should not be empty strings."""
        for key, (label, hint) in OUTPUT_TYPE_LABELS.items():
            assert label.strip(), f"{key}: label is empty"
            assert hint.strip(), f"{key}: hint is empty"


class TestGetOutputTypeLabel:
    """Tests for get_output_type_label function."""

    def test_known_type_returns_label(self):
        assert get_output_type_label("recipe") == "Recipe"
        assert get_output_type_label("tutorial") == "Tutorial"
        assert get_output_type_label("workout") == "Workout Plan"

    def test_compound_types_return_label(self):
        assert get_output_type_label("study_guide") == "Study Guide"
        assert get_output_type_label("travel_plan") == "Travel Plan"
        assert get_output_type_label("podcast_notes") == "Podcast Notes"
        assert get_output_type_label("diy_guide") == "DIY Guide"
        assert get_output_type_label("game_guide") == "Game Guide"
        assert get_output_type_label("music_guide") == "Music Guide"

    def test_summary_default(self):
        assert get_output_type_label("summary") == "Summary"

    def test_unknown_type_returns_default(self):
        assert get_output_type_label("unknown_type") == "Summary"
        assert get_output_type_label("") == "Summary"


class TestGetOutputTypeHint:
    """Tests for get_output_type_hint function."""

    def test_known_type_returns_hint(self):
        hint = get_output_type_hint("recipe")
        assert "cooking" in hint.lower() or "ingredient" in hint.lower()

    def test_unknown_type_returns_default_hint(self):
        default_hint = get_output_type_hint("summary")
        assert get_output_type_hint("nonexistent") == default_hint

    def test_hint_is_meaningful_sentence(self):
        """Hints should contain the word 'Frame' (our convention)."""
        for key in EXPECTED_OUTPUT_TYPES:
            hint = get_output_type_hint(key)
            assert "Frame" in hint or "frame" in hint, f"{key}: hint doesn't follow convention"
