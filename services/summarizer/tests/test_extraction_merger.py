"""Tests for extraction_merger — per-domain merge logic + dedup."""

import pytest

from src.services.pipeline.extraction_merger import (
    merge_batch_extractions,
    _dedup_list,
    _merge_dicts,
    _renumber_ordered_lists,
)


# ---------------------------------------------------------------------------
# merge_batch_extractions
# ---------------------------------------------------------------------------

class TestMergeBatchExtractions:
    def test_single_batch_returns_unchanged(self):
        data = {"key_points": [{"text": "Point 1"}], "title": "Test"}
        result = merge_batch_extractions([data], ["learning"])
        assert result == data

    def test_empty_batches_returns_empty(self):
        result = merge_batch_extractions([None, None], ["learning"])
        assert result == {}

    def test_all_none_returns_empty(self):
        result = merge_batch_extractions([], ["learning"])
        assert result == {}

    def test_merges_list_fields_across_batches(self):
        batch1 = {"key_points": [{"text": "A"}]}
        batch2 = {"key_points": [{"text": "B"}]}

        result = merge_batch_extractions([batch1, batch2], ["learning"])

        assert len(result["key_points"]) == 2
        assert result["key_points"][0]["text"] == "A"
        assert result["key_points"][1]["text"] == "B"

    def test_deduplicates_by_name_field(self):
        batch1 = {"ingredients": [
            {"name": "Chicken", "amount": "500g"},
            {"name": "Rice", "amount": "200g"},
        ]}
        batch2 = {"ingredients": [
            {"name": "chicken", "amount": "500g"},  # duplicate (case-insensitive)
            {"name": "Garlic", "amount": "3 cloves"},
        ]}

        result = merge_batch_extractions([batch1, batch2], ["food"])

        assert len(result["ingredients"]) == 3

    def test_deduplicates_string_lists(self):
        batch1 = {"tips": ["Tip A", "Tip B"]}
        batch2 = {"tips": ["tip b", "Tip C"]}  # "tip b" matches "Tip B" case-insensitive

        result = merge_batch_extractions([batch1, batch2], ["learning"])

        assert len(result["tips"]) == 3

    def test_renumbers_ordered_steps(self):
        batch1 = {"steps": [
            {"step": 1, "text": "First"},
            {"step": 2, "text": "Second"},
        ]}
        batch2 = {"steps": [
            {"step": 1, "text": "Third"},  # Would be step 1 in batch 2
            {"step": 2, "text": "Fourth"},
        ]}

        result = merge_batch_extractions([batch1, batch2], ["food"])

        assert len(result["steps"]) == 4
        assert result["steps"][0]["step"] == 1
        assert result["steps"][1]["step"] == 2
        assert result["steps"][2]["step"] == 3
        assert result["steps"][3]["step"] == 4

    def test_keeps_longest_string_scalar(self):
        batch1 = {"overview": "Short"}
        batch2 = {"overview": "A much longer overview text"}

        result = merge_batch_extractions([batch1, batch2], ["learning"])

        assert result["overview"] == "A much longer overview text"

    def test_merges_nested_dicts(self):
        batch1 = {"learningData": {"concepts": [{"term": "X"}]}}
        batch2 = {"learningData": {"concepts": [{"term": "Y"}]}}

        result = merge_batch_extractions([batch1, batch2], ["learning"])

        assert len(result["learningData"]["concepts"]) == 2

    def test_handles_mixed_domains(self):
        batch1 = {
            "learningData": {"key_points": [{"text": "Learn A"}]},
            "techData": {"tools": [{"name": "Python"}]},
        }
        batch2 = {
            "learningData": {"key_points": [{"text": "Learn B"}]},
            "techData": {"tools": [{"name": "Python"}, {"name": "Rust"}]},
        }

        result = merge_batch_extractions([batch1, batch2], ["learning", "tech"])

        assert len(result["learningData"]["key_points"]) == 2
        assert len(result["techData"]["tools"]) == 2  # Python deduped

    def test_skips_none_batches(self):
        batch1 = {"key_points": [{"text": "A"}]}
        result = merge_batch_extractions([None, batch1, None], ["learning"])

        assert len(result["key_points"]) == 1


# ---------------------------------------------------------------------------
# _dedup_list
# ---------------------------------------------------------------------------

class TestDedupList:
    def test_dedup_dicts_by_name(self):
        items = [
            {"name": "Apple", "color": "red"},
            {"name": "apple", "color": "green"},
            {"name": "Banana", "color": "yellow"},
        ]
        result = _dedup_list(items)
        assert len(result) == 2

    def test_dedup_dicts_by_term(self):
        items = [
            {"term": "API", "definition": "Application Programming Interface"},
            {"term": "api", "definition": "Application Programming Interface"},
        ]
        result = _dedup_list(items)
        assert len(result) == 1

    def test_dedup_strings(self):
        items = ["Hello", "World", "hello", "world"]
        result = _dedup_list(items)
        assert len(result) == 2

    def test_dedup_dicts_by_json(self):
        items = [
            {"a": 1, "b": 2},
            {"b": 2, "a": 1},  # Same when serialized with sort_keys
            {"a": 1, "b": 3},
        ]
        result = _dedup_list(items)
        assert len(result) == 2

    def test_empty_list_unchanged(self):
        assert _dedup_list([]) == []

    def test_single_item_unchanged(self):
        assert _dedup_list(["only"]) == ["only"]


# ---------------------------------------------------------------------------
# _merge_dicts
# ---------------------------------------------------------------------------

class TestMergeDicts:
    def test_merges_non_overlapping_keys(self):
        result = _merge_dicts({"a": 1}, {"b": 2})
        assert result == {"a": 1, "b": 2}

    def test_concatenates_lists(self):
        result = _merge_dicts({"items": [1, 2]}, {"items": [3, 4]})
        assert result["items"] == [1, 2, 3, 4]

    def test_keeps_longer_string(self):
        result = _merge_dicts({"desc": "short"}, {"desc": "a longer description"})
        assert result["desc"] == "a longer description"

    def test_recursive_dict_merge(self):
        result = _merge_dicts(
            {"nested": {"a": 1}},
            {"nested": {"b": 2}},
        )
        assert result["nested"] == {"a": 1, "b": 2}

    def test_none_replaced_by_value(self):
        result = _merge_dicts({"val": None}, {"val": "something"})
        assert result["val"] == "something"


# ---------------------------------------------------------------------------
# _renumber_ordered_lists
# ---------------------------------------------------------------------------

class TestRenumberOrderedLists:
    def test_renumbers_steps(self):
        data = {"steps": [
            {"step": 5, "text": "A"},
            {"step": 10, "text": "B"},
            {"step": 15, "text": "C"},
        ]}
        _renumber_ordered_lists(data)
        assert [s["step"] for s in data["steps"]] == [1, 2, 3]

    def test_renumbers_order_field(self):
        data = {"items": [
            {"order": 99, "value": "X"},
            {"order": 88, "value": "Y"},
        ]}
        _renumber_ordered_lists(data)
        assert data["items"][0]["order"] == 1
        assert data["items"][1]["order"] == 2

    def test_ignores_non_ordered_lists(self):
        data = {"tips": [
            {"text": "Tip 1"},
            {"text": "Tip 2"},
        ]}
        _renumber_ordered_lists(data)
        # No change — no order keys
        assert data["tips"][0] == {"text": "Tip 1"}

    def test_handles_nested_dicts(self):
        data = {"foodData": {"steps": [
            {"step": 3, "text": "A"},
            {"step": 7, "text": "B"},
        ]}}
        _renumber_ordered_lists(data)
        assert data["foodData"]["steps"][0]["step"] == 1
        assert data["foodData"]["steps"][1]["step"] == 2
