"""Tests for the Plan stage validator — specifically the `outboundLinks` field
which carries LLM-generated source-language CTA labels for cross-tab navigation.

Walker-level translation tests live in `test_translation.py`; this file focuses
on the parsing/preservation contract between the LLM JSON output and the
downstream cross_tab.py consumer.
"""

from __future__ import annotations

from src.services.pipeline.plan import _validate_tabs


class TestValidateTabsOutboundLinks:
    """`_validate_tabs` must preserve the LLM-emitted ``outboundLinks`` map
    so the assembly stage can hand source-language labels to cross_tab.py."""

    def test_preserves_outbound_links_when_present(self):
        tabs = [
            {
                "id": "overview",
                "label": "Overview",
                "component": "overview",
                "outboundLinks": {
                    "concepts": "Learn the concepts",
                    "quiz": "Test yourself",
                },
            },
        ]
        result = _validate_tabs(tabs)
        assert len(result) == 1
        assert result[0]["outboundLinks"] == {
            "concepts": "Learn the concepts",
            "quiz": "Test yourself",
        }

    def test_defaults_to_empty_dict_when_missing(self):
        tabs = [{"id": "overview", "label": "Overview", "component": "overview"}]
        result = _validate_tabs(tabs)
        assert result[0]["outboundLinks"] == {}

    def test_drops_non_string_label_values(self):
        tabs = [
            {
                "id": "overview",
                "label": "Overview",
                "component": "overview",
                "outboundLinks": {
                    "good": "Learn the concepts",
                    "bad_int": 42,
                    "bad_empty": "",
                    "bad_whitespace": "   ",
                },
            },
        ]
        result = _validate_tabs(tabs)
        assert result[0]["outboundLinks"] == {"good": "Learn the concepts"}

    def test_drops_non_dict_outbound_links(self):
        tabs = [
            {
                "id": "overview",
                "label": "Overview",
                "component": "overview",
                "outboundLinks": ["not", "a", "dict"],
            },
        ]
        result = _validate_tabs(tabs)
        assert result[0]["outboundLinks"] == {}

    def test_strips_whitespace_from_labels(self):
        tabs = [
            {
                "id": "overview",
                "label": "Overview",
                "component": "overview",
                "outboundLinks": {"concepts": "  Learn the concepts  "},
            },
        ]
        result = _validate_tabs(tabs)
        assert result[0]["outboundLinks"] == {"concepts": "Learn the concepts"}

    def test_preserves_hebrew_labels(self):
        """The whole point of this field — labels can be in any language and
        the walker translates them downstream."""
        tabs = [
            {
                "id": "overview",
                "label": "סקירה",
                "component": "overview",
                "outboundLinks": {"concepts": "ללמוד את המושגים"},
            },
        ]
        result = _validate_tabs(tabs)
        assert result[0]["outboundLinks"] == {"concepts": "ללמוד את המושגים"}
