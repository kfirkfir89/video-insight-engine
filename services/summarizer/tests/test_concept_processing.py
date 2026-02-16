"""Tests for concept processing: build_concept_dicts, fuzzy dedup, merge_chapter_concepts."""

import pytest

from src.services.llm import (
    build_concept_dicts,
    _validate_timestamp,
    _extract_concept_short_form,
    _build_concepts_anchor,
    _normalize_for_dedup,
    _names_are_similar,
    merge_chapter_concepts,
    _build_concept_extraction_section,
)


class TestValidateTimestamp:
    """Tests for _validate_timestamp helper."""

    def test_valid_mm_ss(self):
        assert _validate_timestamp("5:30") == "5:30"

    def test_valid_mm_ss_padded(self):
        assert _validate_timestamp("05:30") == "05:30"

    def test_valid_m_ss(self):
        assert _validate_timestamp("0:00") == "0:00"

    def test_valid_h_mm_ss(self):
        assert _validate_timestamp("1:05:30") == "1:05:30"

    def test_valid_hh_mm_ss(self):
        assert _validate_timestamp("01:05:30") == "01:05:30"

    def test_invalid_text(self):
        assert _validate_timestamp("invalid") is None

    def test_invalid_empty(self):
        assert _validate_timestamp("") is None

    def test_invalid_none(self):
        assert _validate_timestamp(None) is None

    def test_invalid_int(self):
        assert _validate_timestamp(123) is None

    def test_invalid_too_many_colons(self):
        assert _validate_timestamp("1:2:3:4") is None

    def test_invalid_no_colon(self):
        assert _validate_timestamp("530") is None

    def test_invalid_with_letters(self):
        assert _validate_timestamp("5:3a") is None

    def test_strips_whitespace(self):
        assert _validate_timestamp("  5:30  ") == "5:30"

    def test_invalid_with_brackets(self):
        assert _validate_timestamp("[5:30]") is None


class TestBuildConceptDicts:
    """Tests for build_concept_dicts with normalization and dedup."""

    def test_basic_concept(self):
        raw = [{"name": "Concept A", "definition": "Def A", "timestamp": "1:00"}]
        result = build_concept_dicts(raw)
        assert len(result) == 1
        assert result[0]["name"] == "Concept A"
        assert result[0]["definition"] == "Def A"
        assert result[0]["timestamp"] == "1:00"
        assert "id" in result[0]

    def test_strips_whitespace_from_name(self):
        raw = [{"name": "  Concept B  ", "definition": "Def B"}]
        result = build_concept_dicts(raw)
        assert result[0]["name"] == "Concept B"

    def test_strips_whitespace_from_definition(self):
        raw = [{"name": "Concept", "definition": "  Def with spaces  "}]
        result = build_concept_dicts(raw)
        assert result[0]["definition"] == "Def with spaces"

    def test_rejects_whitespace_only_name(self):
        raw = [{"name": "   ", "definition": "Should be rejected"}]
        result = build_concept_dicts(raw)
        assert len(result) == 0

    def test_rejects_empty_name(self):
        raw = [{"name": "", "definition": "Should be rejected"}]
        result = build_concept_dicts(raw)
        assert len(result) == 0

    def test_rejects_missing_name(self):
        raw = [{"definition": "No name key"}]
        result = build_concept_dicts(raw)
        assert len(result) == 0

    def test_case_insensitive_dedup_first_wins(self):
        raw = [
            {"name": "Machine Learning", "definition": "First definition"},
            {"name": "machine learning", "definition": "Second definition"},
            {"name": "MACHINE LEARNING", "definition": "Third definition"},
        ]
        result = build_concept_dicts(raw)
        assert len(result) == 1
        assert result[0]["name"] == "Machine Learning"
        assert result[0]["definition"] == "First definition"

    def test_invalid_timestamp_becomes_none(self):
        raw = [{"name": "Concept", "timestamp": "invalid"}]
        result = build_concept_dicts(raw)
        assert result[0]["timestamp"] is None

    def test_valid_timestamp_preserved(self):
        raw = [{"name": "Concept", "timestamp": "5:30"}]
        result = build_concept_dicts(raw)
        assert result[0]["timestamp"] == "5:30"

    def test_skips_non_dict_items(self):
        raw = [
            {"name": "Valid"},
            "not a dict",
            42,
            None,
            {"name": "Also Valid"},
        ]
        result = build_concept_dicts(raw)
        assert len(result) == 2

    def test_whitespace_only_definition_becomes_none(self):
        raw = [{"name": "Concept", "definition": "   "}]
        result = build_concept_dicts(raw)
        assert result[0]["definition"] is None

    def test_none_definition_stays_none(self):
        raw = [{"name": "Concept", "definition": None}]
        result = build_concept_dicts(raw)
        assert result[0]["definition"] is None

    def test_multiple_valid_concepts(self):
        raw = [
            {"name": "Alpha", "definition": "First", "timestamp": "0:00"},
            {"name": "Beta", "definition": "Second", "timestamp": "1:00"},
            {"name": "Gamma", "definition": "Third", "timestamp": "2:00"},
        ]
        result = build_concept_dicts(raw)
        assert len(result) == 3
        assert [c["name"] for c in result] == ["Alpha", "Beta", "Gamma"]

    def test_empty_input(self):
        result = build_concept_dicts([])
        assert result == []

    def test_uuid_uniqueness(self):
        raw = [{"name": "A"}, {"name": "B"}]
        result = build_concept_dicts(raw)
        assert result[0]["id"] != result[1]["id"]


class TestExtractConceptShortForm:
    """Tests for _extract_concept_short_form helper."""

    def test_standard_abbreviation(self):
        assert _extract_concept_short_form("Search Engine Optimization (SEO)") == "SEO"

    def test_reversed_pattern(self):
        assert _extract_concept_short_form("EMDR (Eye Movement Desensitization Reprocessing)") == "EMDR"

    def test_dpo_style(self):
        # Both base and parens are long — returns None
        assert _extract_concept_short_form("DPO analysis (Duration, Path, Outcome)") is None

    def test_short_abbreviation(self):
        assert _extract_concept_short_form("Artificial Intelligence (AI)") == "AI"

    def test_no_parentheses(self):
        assert _extract_concept_short_form("Neuroplasticity") is None

    def test_empty_string(self):
        assert _extract_concept_short_form("") is None


class TestBuildConceptsAnchor:
    """Tests for _build_concepts_anchor with variant forms."""

    def test_empty_list(self):
        assert _build_concepts_anchor([]) == ""

    def test_none_input(self):
        assert _build_concepts_anchor(None) == ""

    def test_simple_concepts(self):
        result = _build_concepts_anchor(["Dopamine", "Neuroplasticity"])
        assert "- Dopamine" in result
        assert "- Neuroplasticity" in result
        assert "CONCEPT ANCHORING" in result

    def test_includes_short_form_for_abbreviation(self):
        result = _build_concepts_anchor(["Search Engine Optimization (SEO)"])
        assert "(also: SEO)" in result

    def test_includes_short_form_for_reversed(self):
        result = _build_concepts_anchor(["EMDR (Eye Movement Desensitization Reprocessing)"])
        assert "(also: EMDR)" in result

    def test_no_short_form_for_simple_names(self):
        result = _build_concepts_anchor(["Dopamine"])
        assert "(also:" not in result


class TestNormalizeForDedup:
    """Tests for _normalize_for_dedup helper."""

    def test_lowercase(self):
        assert _normalize_for_dedup("Neural Plasticity") == "neural plasticity"

    def test_strip_parenthetical(self):
        assert _normalize_for_dedup("Search Engine Optimization (SEO)") == "search engine optimization"

    def test_remove_leading_article_the(self):
        assert _normalize_for_dedup("The Immune System") == "immune system"

    def test_remove_leading_article_a(self):
        assert _normalize_for_dedup("A Neural Network") == "neural network"

    def test_normalize_hyphens(self):
        assert _normalize_for_dedup("Self-Directed Learning") == "self directed learning"

    def test_collapse_whitespace(self):
        assert _normalize_for_dedup("  Neural   Plasticity  ") == "neural plasticity"

    def test_empty_string(self):
        assert _normalize_for_dedup("") == ""


class TestNamesAreSimilar:
    """Tests for _names_are_similar fuzzy matching."""

    def test_exact_match(self):
        assert _names_are_similar("Neuroplasticity", "Neuroplasticity") is True

    def test_case_insensitive(self):
        assert _names_are_similar("neuroplasticity", "NEUROPLASTICITY") is True

    def test_neuroplasticity_vs_neural_plasticity(self):
        """Core use case: space-stripped match."""
        assert _names_are_similar("Neuroplasticity", "Neural Plasticity") is True

    def test_substring_containment(self):
        assert _names_are_similar("Machine Learning", "Machine Learning Models") is True

    def test_substring_containment_reverse(self):
        assert _names_are_similar("Deep Learning Architecture", "Deep Learning") is True

    def test_parenthetical_stripped(self):
        assert _names_are_similar("SEO (Search Engine Optimization)", "Search Engine Optimization") is True

    def test_leading_article_stripped(self):
        assert _names_are_similar("The Immune Response", "Immune Response") is True

    def test_hyphen_normalized(self):
        assert _names_are_similar("Self-Directed Learning", "Self Directed Learning") is True

    def test_token_jaccard_high_overlap(self):
        """Token Jaccard >= 0.6 should match."""
        assert _names_are_similar("Cognitive Behavioral Therapy", "Behavioral Cognitive Therapy") is True

    def test_completely_different(self):
        assert _names_are_similar("Dopamine", "Serotonin") is False

    def test_low_token_overlap(self):
        assert _names_are_similar("Machine Learning", "Deep Neural Network") is False

    def test_empty_strings(self):
        assert _names_are_similar("", "Something") is False
        assert _names_are_similar("Something", "") is False


class TestMergeChapterConcepts:
    """Tests for merge_chapter_concepts with fuzzy dedup."""

    def test_basic_merge(self):
        """Concepts from different chapters are merged."""
        input_data = [
            (0, [{"name": "Dopamine Receptors", "definition": "Def A", "timestamp": "0:30"}]),
            (1, [{"name": "Cortisol Response", "definition": "Def B", "timestamp": "2:00"}]),
        ]
        result = merge_chapter_concepts(input_data)
        assert len(result) == 2
        assert result[0]["name"] == "Dopamine Receptors"
        assert result[0]["chapter_index"] == 0
        assert result[1]["name"] == "Cortisol Response"
        assert result[1]["chapter_index"] == 1

    def test_fuzzy_dedup_neuroplasticity(self):
        """'Neuroplasticity' and 'Neural Plasticity' should be deduped."""
        input_data = [
            (0, [{"name": "Neuroplasticity", "definition": "Brain's ability to reorganize", "timestamp": "1:00"}]),
            (2, [{"name": "Neural Plasticity", "definition": "The brain can change", "timestamp": "5:00"}]),
        ]
        result = merge_chapter_concepts(input_data)
        assert len(result) == 1
        assert result[0]["name"] == "Neuroplasticity"  # First wins
        assert result[0]["chapter_index"] == 0

    def test_exact_dedup(self):
        """Exact same name from different chapters should be deduped."""
        input_data = [
            (0, [{"name": "Dopamine", "definition": "A neurotransmitter"}]),
            (3, [{"name": "Dopamine", "definition": "Brain chemical"}]),
        ]
        result = merge_chapter_concepts(input_data)
        assert len(result) == 1
        assert result[0]["definition"] == "A neurotransmitter"  # First wins

    def test_case_insensitive_dedup(self):
        input_data = [
            (0, [{"name": "Growth Mindset", "definition": "Belief abilities can develop"}]),
            (1, [{"name": "growth mindset", "definition": "Different def"}]),
        ]
        result = merge_chapter_concepts(input_data)
        assert len(result) == 1
        assert result[0]["name"] == "Growth Mindset"

    def test_parenthetical_dedup(self):
        """'SEO' and 'Search Engine Optimization (SEO)' should be deduped."""
        input_data = [
            (0, [{"name": "Search Engine Optimization (SEO)", "definition": "Optimizing for search"}]),
            (1, [{"name": "Search Engine Optimization", "definition": "SEO technique"}]),
        ]
        result = merge_chapter_concepts(input_data)
        assert len(result) == 1

    def test_preserves_unique_concepts(self):
        """Different concepts should not be deduped."""
        input_data = [
            (0, [{"name": "Dopamine", "definition": "A neurotransmitter"}]),
            (1, [{"name": "Serotonin", "definition": "Another neurotransmitter"}]),
            (2, [{"name": "Cortisol", "definition": "Stress hormone"}]),
        ]
        result = merge_chapter_concepts(input_data)
        assert len(result) == 3

    def test_empty_input(self):
        result = merge_chapter_concepts([])
        assert result == []

    def test_empty_concepts_list(self):
        result = merge_chapter_concepts([(0, []), (1, [])])
        assert result == []

    def test_skips_invalid_entries(self):
        input_data = [
            (0, [
                {"name": "Valid", "definition": "Def"},
                "not a dict",
                {"name": "", "definition": "Empty name"},
                {"definition": "No name key"},
            ]),
        ]
        result = merge_chapter_concepts(input_data)
        assert len(result) == 1
        assert result[0]["name"] == "Valid"

    def test_uuid_assigned(self):
        input_data = [(0, [{"name": "A"}])]
        result = merge_chapter_concepts(input_data)
        assert "id" in result[0]
        assert len(result[0]["id"]) == 36  # UUID format

    def test_timestamp_validated(self):
        input_data = [(0, [
            {"name": "Dopamine", "timestamp": "5:30"},
            {"name": "Serotonin", "timestamp": "invalid"},
        ])]
        result = merge_chapter_concepts(input_data)
        assert result[0]["timestamp"] == "5:30"
        assert result[1]["timestamp"] is None


class TestBuildConceptExtractionSection:
    """Tests for _build_concept_extraction_section."""

    def test_basic_output(self):
        result = _build_concept_extraction_section(10)
        assert "CONCEPT EXTRACTION" in result
        assert "NAMING RULES" in result
        assert "WHAT TO EXTRACT" in result

    def test_few_chapters_higher_concept_count(self):
        result = _build_concept_extraction_section(3)
        assert "3-5" in result

    def test_many_chapters_lower_concept_count(self):
        result = _build_concept_extraction_section(15)
        assert "2-3" in result

    def test_already_extracted_included(self):
        result = _build_concept_extraction_section(10, ["Dopamine", "Serotonin"])
        assert "ALREADY EXTRACTED" in result
        assert "Dopamine" in result
        assert "Serotonin" in result

    def test_no_already_extracted_section_when_none(self):
        result = _build_concept_extraction_section(10)
        assert "ALREADY EXTRACTED" not in result

    def test_no_already_extracted_section_when_empty(self):
        result = _build_concept_extraction_section(10, [])
        assert "ALREADY EXTRACTED" not in result
