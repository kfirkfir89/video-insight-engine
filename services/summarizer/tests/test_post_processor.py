"""Tests for post_processor utilities."""

import pytest

from src.services.pipeline.post_processor import (
    drop_empty_tabs,
    assign_section_accents,
    merge_narrative,
    resolve_celebrations,
    validate_extraction_counts,
    _count_items_at_path,
    COMPLETENESS_THRESHOLD,
)
from src.models.pipeline_types import ManifestResult, ItemCounts


class TestDropEmptyTabs:
    """Test drop_empty_tabs function."""

    def test_keeps_tabs_with_enough_items(self):
        tabs = [
            {"id": "itinerary", "label": "Itinerary", "dataSource": "travel.itinerary"},
        ]
        data = {
            "travel": {
                "itinerary": [{"day": 1}, {"day": 2}, {"day": 3}],
            },
        }

        result = drop_empty_tabs(tabs, data)
        assert len(result) == 1

    def test_drops_tabs_with_less_than_two_items(self):
        tabs = [
            {"id": "itinerary", "label": "Itinerary", "dataSource": "travel.itinerary"},
            {"id": "budget", "label": "Budget", "dataSource": "travel.budget"},
        ]
        data = {
            "travel": {
                "itinerary": [{"day": 1}],  # Only 1 item
                "budget": {"total": 1000},  # Not a list
            },
        }

        result = drop_empty_tabs(tabs, data)
        assert len(result) == 1
        assert result[0]["id"] == "budget"

    def test_keeps_tabs_with_no_data_source(self):
        tabs = [
            {"id": "overview", "label": "Overview"},
        ]
        data = {}

        result = drop_empty_tabs(tabs, data)
        assert len(result) == 1

    def test_keeps_tabs_with_unresolved_path(self):
        tabs = [
            {"id": "test", "label": "Test", "dataSource": "nonexistent.path"},
        ]
        data = {}

        result = drop_empty_tabs(tabs, data)
        assert len(result) == 1

    def test_keeps_tabs_with_enough_analysis_items(self):
        tabs = [
            {"id": "analysis", "label": "Analysis", "dataSource": "music.analysis"},
        ]
        data = {
            "music": {
                "analysis": [
                    {"aspect": "Production", "detail": "Great"},
                    {"aspect": "Vocals", "detail": "Powerful"},
                ],
            },
        }

        result = drop_empty_tabs(tabs, data)
        assert len(result) == 1

    def test_empty_tabs_list(self):
        result = drop_empty_tabs([], {})
        assert result == []

    def test_drops_tab_with_empty_list(self):
        tabs = [
            {"id": "tips", "label": "Tips", "dataSource": "food.tips"},
        ]
        data = {
            "food": {
                "tips": [],
            },
        }

        result = drop_empty_tabs(tabs, data)
        assert len(result) == 0

    def test_empty_data_source_string_keeps_tab(self):
        tabs = [
            {"id": "overview", "label": "Overview", "dataSource": ""},
        ]
        data = {}

        result = drop_empty_tabs(tabs, data)
        assert len(result) == 1


class TestAssignSectionAccents:
    """Test assign_section_accents function."""

    def test_assigns_cycling_indices(self):
        sections = [{"type": "day", "items": []} for _ in range(10)]

        result = assign_section_accents(sections)

        assert len(result) == 10
        assert result[0]["accentIndex"] == 0
        assert result[1]["accentIndex"] == 1
        assert result[6]["accentIndex"] == 6
        assert result[7]["accentIndex"] == 0  # Cycles back

    def test_does_not_mutate_originals(self):
        sections = [{"type": "day", "items": []}]

        result = assign_section_accents(sections)

        assert "accentIndex" not in sections[0]
        assert "accentIndex" in result[0]

    def test_empty_sections(self):
        result = assign_section_accents([])
        assert result == []

    def test_preserves_existing_fields(self):
        sections = [{"type": "step", "items": [{"label": "Step 1"}], "extra": "data"}]

        result = assign_section_accents(sections)

        assert result[0]["type"] == "step"
        assert result[0]["items"] == [{"label": "Step 1"}]
        assert result[0]["extra"] == "data"
        assert result[0]["accentIndex"] == 0


class TestMergeNarrative:
    """Test merge_narrative function."""

    def test_merges_narrative_data(self):
        data = {"food": {"ingredients": []}}
        narrative = {"keyMoments": [{"description": "A moment"}], "quotes": []}

        result = merge_narrative(data, narrative)

        assert "narrative" in result
        assert result["narrative"]["keyMoments"][0]["description"] == "A moment"
        assert result["food"] == {"ingredients": []}

    def test_returns_data_unchanged_when_none(self):
        data = {"food": {"ingredients": []}}

        result = merge_narrative(data, None)

        assert result == data
        assert "narrative" not in result

    def test_does_not_mutate_original(self):
        data = {"food": {"ingredients": []}}
        narrative = {"keyMoments": []}

        result = merge_narrative(data, narrative)

        assert "narrative" not in data
        assert "narrative" in result


class TestResolveCelebrations:
    """Test resolve_celebrations function."""

    def test_adds_celebration_to_quiz_tab(self):
        tabs = [
            {"id": "quizzes", "label": "Quiz"},
            {"id": "overview", "label": "Overview"},
        ]

        result = resolve_celebrations(tabs)

        assert result[0]["celebration"] is True
        assert result[1]["celebration"] is False

    def test_celebration_tab_ids(self):
        celebration_ids = ["quizzes", "flashcards", "scenarios", "packing", "ingredients", "materials", "tools"]
        for tab_id in celebration_ids:
            tabs = [{"id": tab_id, "label": "Test"}]
            result = resolve_celebrations(tabs)
            assert result[0]["celebration"] is True, f"{tab_id} should trigger celebration"

    def test_non_celebration_tabs(self):
        non_celebration_ids = ["overview", "analysis", "budget", "itinerary", "tips"]
        for tab_id in non_celebration_ids:
            tabs = [{"id": tab_id, "label": "Test"}]
            result = resolve_celebrations(tabs)
            assert result[0]["celebration"] is False, f"{tab_id} should not trigger celebration"

    def test_does_not_mutate_originals(self):
        tabs = [{"id": "quizzes", "label": "Quiz"}]

        result = resolve_celebrations(tabs)

        assert "celebration" not in tabs[0]
        assert "celebration" in result[0]

    def test_empty_tabs(self):
        result = resolve_celebrations([])
        assert result == []


class TestCountItemsAtPath:
    """Test _count_items_at_path helper."""

    def test_simple_path(self):
        data = {"food": {"ingredients": ["a", "b", "c"]}}
        assert _count_items_at_path(data, "food.ingredients") == 3

    def test_wildcard_path(self):
        data = {
            "travel": {
                "itinerary": [
                    {"spots": ["spot1", "spot2"]},
                    {"spots": ["spot3"]},
                ],
            },
        }
        assert _count_items_at_path(data, "travel.itinerary.*.spots") == 3

    def test_missing_path_returns_zero(self):
        assert _count_items_at_path({}, "food.ingredients") == 0

    def test_non_list_value_returns_zero(self):
        data = {"food": {"name": "pasta"}}
        assert _count_items_at_path(data, "food.name") == 0

    def test_nested_wildcard_with_empty_lists(self):
        data = {
            "travel": {
                "itinerary": [
                    {"tips": []},
                    {"tips": ["tip1"]},
                ],
            },
        }
        assert _count_items_at_path(data, "travel.itinerary.*.tips") == 1


class TestValidateExtractionCounts:
    """Test validate_extraction_counts function."""

    def test_returns_empty_when_no_manifest(self):
        assert validate_extraction_counts(None, {"food": {"ingredients": []}}) == {}

    def test_returns_empty_when_no_extraction_data(self):
        manifest = ManifestResult(item_counts=ItemCounts(ingredients=5))
        assert validate_extraction_counts(manifest, None) == {}

    def test_returns_empty_when_both_none(self):
        assert validate_extraction_counts(None, None) == {}

    def test_no_warnings_when_counts_match(self):
        manifest = ManifestResult(item_counts=ItemCounts(ingredients=5))
        data = {"food": {"ingredients": ["a", "b", "c", "d", "e"]}}

        warnings = validate_extraction_counts(manifest, data)
        assert warnings == {}

    def test_no_warnings_above_threshold(self):
        manifest = ManifestResult(item_counts=ItemCounts(ingredients=5))
        # 4/5 = 0.8 > 0.6 threshold
        data = {"food": {"ingredients": ["a", "b", "c", "d"]}}

        warnings = validate_extraction_counts(manifest, data)
        assert warnings == {}

    def test_warns_below_threshold(self):
        manifest = ManifestResult(item_counts=ItemCounts(ingredients=10))
        # 2/10 = 0.2 < 0.6 threshold
        data = {"food": {"ingredients": ["a", "b"]}}

        warnings = validate_extraction_counts(manifest, data)
        assert "ingredients" in warnings
        assert warnings["ingredients"]["manifest"] == 10
        assert warnings["ingredients"]["extracted"] == 2
        assert warnings["ingredients"]["ratio"] == 0.2

    def test_skips_zero_manifest_counts(self):
        manifest = ManifestResult(item_counts=ItemCounts(ingredients=0, spots=0))
        data = {}

        warnings = validate_extraction_counts(manifest, data)
        assert warnings == {}

    def test_multiple_paths_summed(self):
        manifest = ManifestResult(item_counts=ItemCounts(tips=10))
        # tips checks food.tips + fitness.tips + travel.itinerary.*.tips
        data = {
            "food": {"tips": ["t1", "t2", "t3"]},
            "fitness": {"tips": ["t4", "t5", "t6"]},
        }

        # 6/10 = 0.6, exactly at threshold — should NOT warn
        warnings = validate_extraction_counts(manifest, data)
        assert warnings == {}

    def test_warns_when_extraction_missing_entirely(self):
        manifest = ManifestResult(item_counts=ItemCounts(exercises=5))
        data = {}  # No fitness.exercises at all

        warnings = validate_extraction_counts(manifest, data)
        assert "exercises" in warnings
        assert warnings["exercises"]["extracted"] == 0
