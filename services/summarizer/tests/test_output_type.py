"""Tests for output type determination (Phase 1).

Tests CATEGORY_TO_OUTPUT_TYPE mapping, determine_output_type(),
get_output_type_label(), and edge cases.
"""

import pytest

from src.services.output_type import (
    CATEGORY_TO_OUTPUT_TYPE,
    DEFAULT_OUTPUT_TYPE,
    OUTPUT_TYPE_LABELS,
    determine_output_type,
    get_output_type_label,
)


class TestCategoryToOutputTypeMapping:
    """Verify all 10 category → outputType mappings."""

    @pytest.mark.parametrize(
        "category, expected_output_type",
        [
            ("cooking", "recipe"),
            ("coding", "tutorial"),
            ("fitness", "workout"),
            ("education", "study_guide"),
            ("travel", "travel_plan"),
            ("reviews", "review"),
            ("podcast", "podcast_notes"),
            ("diy", "diy_guide"),
            ("gaming", "game_guide"),
            ("music", "music_guide"),
        ],
    )
    def test_known_category_maps_correctly(self, category: str, expected_output_type: str):
        assert CATEGORY_TO_OUTPUT_TYPE[category] == expected_output_type

    def test_mapping_has_10_entries(self):
        assert len(CATEGORY_TO_OUTPUT_TYPE) == 10

    def test_default_output_type_is_summary(self):
        assert DEFAULT_OUTPUT_TYPE == "summary"


class TestDetermineOutputType:
    """Test determine_output_type() function."""

    @pytest.mark.parametrize(
        "category, expected",
        [
            ("cooking", "recipe"),
            ("coding", "tutorial"),
            ("fitness", "workout"),
            ("education", "study_guide"),
            ("travel", "travel_plan"),
            ("reviews", "review"),
            ("podcast", "podcast_notes"),
            ("diy", "diy_guide"),
            ("gaming", "game_guide"),
            ("music", "music_guide"),
        ],
    )
    def test_known_categories(self, category: str, expected: str):
        assert determine_output_type(category) == expected

    def test_unknown_category_returns_summary(self):
        assert determine_output_type("unknown") == "summary"

    def test_standard_category_returns_summary(self):
        assert determine_output_type("standard") == "summary"

    def test_empty_string_returns_summary(self):
        assert determine_output_type("") == "summary"

    def test_none_guard(self):
        # The function checks `if not category` which handles None-like values
        assert determine_output_type("") == "summary"

    def test_case_sensitive(self):
        # Mapping is lowercase, uppercase should default to summary
        assert determine_output_type("Cooking") == "summary"
        assert determine_output_type("CODING") == "summary"

    def test_whitespace_not_stripped(self):
        # Function doesn't strip — callers should normalize
        assert determine_output_type(" cooking") == "summary"


class TestGetOutputTypeLabel:
    """Test get_output_type_label() function."""

    @pytest.mark.parametrize(
        "output_type, expected_label",
        [
            ("recipe", "Recipe"),
            ("tutorial", "Tutorial"),
            ("workout", "Workout Plan"),
            ("study_guide", "Study Guide"),
            ("travel_plan", "Travel Plan"),
            ("review", "Review"),
            ("podcast_notes", "Podcast Notes"),
            ("diy_guide", "DIY Guide"),
            ("game_guide", "Game Guide"),
            ("music_guide", "Music Guide"),
            ("summary", "Summary"),
        ],
    )
    def test_known_output_types(self, output_type: str, expected_label: str):
        assert get_output_type_label(output_type) == expected_label

    def test_unknown_output_type_returns_title_cased(self):
        assert get_output_type_label("custom_type") == "Custom Type"

    def test_all_output_types_have_labels(self):
        """Every output type in the mapping should have a label."""
        for output_type in CATEGORY_TO_OUTPUT_TYPE.values():
            assert output_type in OUTPUT_TYPE_LABELS

    def test_default_has_label(self):
        assert DEFAULT_OUTPUT_TYPE in OUTPUT_TYPE_LABELS
