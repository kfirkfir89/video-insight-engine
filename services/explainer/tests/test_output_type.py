"""Tests for output type label mapping utilities."""

from src.utils.output_type import (
    OUTPUT_TYPE_LABELS,
    get_output_type_hint,
    get_output_type_label,
)

# Must match the canonical OutputType values
EXPECTED_OUTPUT_TYPES = [
    "explanation", "recipe", "code_walkthrough", "study_kit",
    "trip_planner", "workout", "verdict", "highlights",
    "music_guide", "project_guide",
]


class TestOutputTypeLabels:
    """Tests for OUTPUT_TYPE_LABELS completeness and structure."""

    def test_all_expected_types_present(self):
        """All 10 output types should have entries."""
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
        assert get_output_type_label("code_walkthrough") == "Code Walkthrough"
        assert get_output_type_label("workout") == "Workout Plan"

    def test_compound_types_return_label(self):
        assert get_output_type_label("study_kit") == "Study Kit"
        assert get_output_type_label("trip_planner") == "Trip Planner"
        assert get_output_type_label("highlights") == "Highlights"
        assert get_output_type_label("project_guide") == "Project Guide"
        assert get_output_type_label("verdict") == "Verdict"
        assert get_output_type_label("music_guide") == "Music Guide"

    def test_explanation_default(self):
        assert get_output_type_label("explanation") == "Explanation"

    def test_unknown_type_returns_default(self):
        assert get_output_type_label("unknown_type") == "Explanation"
        assert get_output_type_label("") == "Explanation"


class TestGetOutputTypeHint:
    """Tests for get_output_type_hint function."""

    def test_known_type_returns_hint(self):
        hint = get_output_type_hint("recipe")
        assert "cooking" in hint.lower() or "ingredient" in hint.lower()

    def test_unknown_type_returns_default_hint(self):
        default_hint = get_output_type_hint("explanation")
        assert get_output_type_hint("nonexistent") == default_hint

    def test_hint_is_meaningful_sentence(self):
        """Hints should contain the word 'Frame' (our convention)."""
        for key in EXPECTED_OUTPUT_TYPES:
            hint = get_output_type_hint(key)
            assert "Frame" in hint or "frame" in hint, f"{key}: hint doesn't follow convention"
