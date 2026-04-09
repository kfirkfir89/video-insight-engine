"""Tests for extraction quality check and retry prompt builder."""

import pytest

from src.utils.data_helpers import is_empty_data
from src.services.pipeline.extraction_quality import (
    check_extraction_quality,
    build_synthesis_fed_retry_prompt,
    _resolve_dot_path,
)


class TestIsEmptyData:
    def test_none_is_empty(self):
        assert is_empty_data(None) is True

    def test_empty_list_is_empty(self):
        assert is_empty_data([]) is True

    def test_empty_dict_is_empty(self):
        assert is_empty_data({}) is True

    def test_nonempty_list_not_empty(self):
        assert is_empty_data([1]) is False

    def test_nonempty_dict_not_empty(self):
        assert is_empty_data({"key": "val"}) is False

    def test_string_not_empty(self):
        assert is_empty_data("hello") is False

    def test_zero_not_empty(self):
        assert is_empty_data(0) is False


class TestResolveDotPath:
    def test_simple_path(self):
        data = {"travel": {"itinerary": [{"day": 1}]}}
        assert _resolve_dot_path(data, "travel.itinerary") == [{"day": 1}]

    def test_single_key(self):
        data = {"fitness": {"exercises": []}}
        assert _resolve_dot_path(data, "fitness") == {"exercises": []}

    def test_missing_path(self):
        data = {"travel": {}}
        assert _resolve_dot_path(data, "travel.budget") is None

    def test_wildcard(self):
        data = {"food": {"ingredients": ["salt"]}}
        assert _resolve_dot_path(data, "food.*") == {"ingredients": ["salt"]}

    def test_deeply_nested(self):
        data = {"a": {"b": {"c": "deep"}}}
        assert _resolve_dot_path(data, "a.b.c") == "deep"


class TestCheckExtractionQuality:
    def test_all_populated_score_1(self):
        tabs = [
            {"dataSource": "learning.keyPoints"},
            {"dataSource": "learning.concepts"},
            {"dataSource": "learning.takeaways"},
        ]
        extraction = {
            "learning": {
                "keyPoints": [{"title": "point1"}],
                "concepts": [{"name": "concept1"}],
                "takeaways": ["takeaway1"],
            }
        }
        result = check_extraction_quality(tabs, extraction)
        assert result.score == 1.0
        assert result.populated == 3
        assert result.total == 3
        assert result.empty_fields == []

    def test_some_empty_correct_score(self):
        tabs = [
            {"dataSource": "learning.keyPoints"},
            {"dataSource": "learning.concepts"},
            {"dataSource": "learning.takeaways"},
        ]
        extraction = {
            "learning": {
                "keyPoints": [{"title": "point1"}],
                "concepts": [],
                "takeaways": [],
            }
        }
        result = check_extraction_quality(tabs, extraction)
        assert result.score == pytest.approx(1/3)
        assert result.populated == 1
        assert result.total == 3
        assert "learning.concepts" in result.empty_fields
        assert "learning.takeaways" in result.empty_fields

    def test_all_empty_score_0(self):
        tabs = [
            {"dataSource": "learning.keyPoints"},
            {"dataSource": "learning.concepts"},
        ]
        extraction = {"learning": {"keyPoints": [], "concepts": []}}
        result = check_extraction_quality(tabs, extraction)
        assert result.score == 0.0
        assert result.populated == 0
        assert result.total == 2

    def test_skips_meta_sources(self):
        tabs = [
            {"dataSource": "meta"},
            {"dataSource": "learning.keyPoints"},
        ]
        extraction = {"learning": {"keyPoints": [{"title": "point"}]}}
        result = check_extraction_quality(tabs, extraction)
        assert result.total == 1
        assert result.populated == 1
        assert result.score == 1.0

    def test_skips_synthesis_sources(self):
        tabs = [
            {"dataSource": "synthesis.tldr"},
            {"dataSource": "learning.keyPoints"},
        ]
        extraction = {"learning": {"keyPoints": []}}
        result = check_extraction_quality(tabs, extraction)
        assert result.total == 1
        assert result.populated == 0

    def test_skips_enrichment_sources(self):
        tabs = [
            {"dataSource": "enrichment.quiz"},
            {"dataSource": "enrichment.flashcards"},
            {"dataSource": "learning.concepts"},
        ]
        extraction = {"learning": {"concepts": [{"name": "c1"}]}}
        result = check_extraction_quality(tabs, extraction)
        assert result.total == 1
        assert result.populated == 1

    def test_none_extraction_data(self):
        tabs = [{"dataSource": "learning.keyPoints"}]
        result = check_extraction_quality(tabs, {})
        assert result.score == 0.0
        assert result.total == 0

    def test_empty_tabs(self):
        result = check_extraction_quality([], {"learning": {"keyPoints": []}})
        assert result.score == 0.0
        assert result.total == 0

    def test_missing_dotted_path(self):
        tabs = [{"dataSource": "travel.budget.breakdown"}]
        extraction = {"travel": {"budget": {}}}
        result = check_extraction_quality(tabs, extraction)
        assert result.total == 1
        assert result.populated == 0
        assert "travel.budget.breakdown" in result.empty_fields

    def test_tabs_without_datasource_skipped(self):
        tabs = [
            {"dataSource": ""},
            {"id": "no_ds"},
            {"dataSource": "learning.keyPoints"},
        ]
        extraction = {"learning": {"keyPoints": [{"title": "p"}]}}
        result = check_extraction_quality(tabs, extraction)
        assert result.total == 1
        assert result.populated == 1


class TestBuildSynthesisFedRetryPrompt:
    def test_includes_empty_fields(self):
        prompt = build_synthesis_fed_retry_prompt(
            ["learning.concepts", "learning.takeaways"],
            {"tldr": "Test video", "keyTakeaways": ["t1", "t2"], "masterSummary": "Summary"},
        )
        assert "learning.concepts" in prompt
        assert "learning.takeaways" in prompt

    def test_includes_synthesis_evidence(self):
        prompt = build_synthesis_fed_retry_prompt(
            ["learning.concepts"],
            {"tldr": "Great video about Python", "keyTakeaways": ["Learn decorators"], "masterSummary": "A deep dive"},
        )
        assert "Great video about Python" in prompt
        assert "Learn decorators" in prompt
        assert "A deep dive" in prompt

    def test_warns_against_fabrication(self):
        prompt = build_synthesis_fed_retry_prompt(
            ["learning.concepts"],
            {"tldr": "test"},
        )
        assert "DO NOT fabricate" in prompt
        assert "DO NOT hallucinate" in prompt

    def test_wraps_evidence_in_tags(self):
        prompt = build_synthesis_fed_retry_prompt(
            ["learning.concepts"],
            {"tldr": "test"},
        )
        assert "<synthesis_evidence>" in prompt
        assert "</synthesis_evidence>" in prompt

    def test_handles_empty_synthesis(self):
        prompt = build_synthesis_fed_retry_prompt(
            ["learning.concepts"],
            {},
        )
        assert "learning.concepts" in prompt
        assert "RETRY INSTRUCTION" in prompt

    def test_truncates_master_summary(self):
        long_summary = "x" * 1000
        prompt = build_synthesis_fed_retry_prompt(
            ["field"],
            {"masterSummary": long_summary},
        )
        # Should only include first 500 chars
        assert "x" * 500 in prompt
        assert "x" * 501 not in prompt
