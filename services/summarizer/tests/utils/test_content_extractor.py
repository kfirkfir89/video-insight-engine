"""Tests for content extraction utility functions.

These tests verify that summary and bullets can be correctly extracted
from dynamic content blocks, matching the behavior of pre-computed fields.
"""

import pytest

from src.utils.content_extractor import (
    extract_summary_from_content,
    extract_bullets_from_content,
)


class TestExtractSummaryFromContent:
    """Tests for extract_summary_from_content function."""

    def test_empty_content_returns_empty_string(self):
        """Empty content list returns empty string."""
        assert extract_summary_from_content([]) == ""
        assert extract_summary_from_content(None) == ""  # type: ignore

    def test_single_paragraph(self):
        """Single paragraph block extracts text."""
        content = [{"type": "paragraph", "text": "This is the summary."}]
        assert extract_summary_from_content(content) == "This is the summary."

    def test_multiple_paragraphs_joined(self):
        """Multiple paragraphs are joined with space."""
        content = [
            {"type": "paragraph", "text": "First paragraph."},
            {"type": "paragraph", "text": "Second paragraph."},
        ]
        assert extract_summary_from_content(content) == "First paragraph. Second paragraph."

    def test_paragraph_with_empty_text_skipped(self):
        """Paragraphs with empty text are skipped."""
        content = [
            {"type": "paragraph", "text": ""},
            {"type": "paragraph", "text": "Valid text."},
        ]
        assert extract_summary_from_content(content) == "Valid text."

    def test_quote_block_extracted(self):
        """Quote block text is extracted."""
        content = [{"type": "quote", "text": "To be or not to be.", "attribution": "Shakespeare"}]
        assert extract_summary_from_content(content) == '"To be or not to be." — Shakespeare'

    def test_quote_without_attribution(self):
        """Quote without attribution works."""
        content = [{"type": "quote", "text": "Hello world"}]
        assert extract_summary_from_content(content) == '"Hello world"'

    def test_definition_extracted(self):
        """Definition block is extracted as term: meaning."""
        content = [
            {"type": "definition", "term": "API", "meaning": "Application Programming Interface"},
        ]
        assert extract_summary_from_content(content) == "API: Application Programming Interface"

    def test_callout_extracted(self):
        """Callout text is extracted."""
        content = [
            {"type": "callout", "style": "tip", "text": "This is a useful tip."},
        ]
        assert extract_summary_from_content(content) == "This is a useful tip."

    def test_example_explanation_extracted(self):
        """Example explanation is extracted."""
        content = [
            {"type": "example", "code": "print('hi')", "explanation": "Prints hello to console"},
        ]
        assert extract_summary_from_content(content) == "Prints hello to console"

    def test_example_title_fallback(self):
        """Example falls back to title if no explanation."""
        content = [
            {"type": "example", "code": "print('hi')", "title": "Hello World Example"},
        ]
        assert extract_summary_from_content(content) == "Hello World Example"

    def test_timestamp_label_extracted(self):
        """Timestamp label is extracted."""
        content = [
            {"type": "timestamp", "time": "5:30", "seconds": 330, "label": "Key moment explained"},
        ]
        assert extract_summary_from_content(content) == "Key moment explained"

    def test_statistic_items_extracted(self):
        """Statistic items are extracted."""
        content = [
            {"type": "statistic", "items": [
                {"value": "85%", "label": "Success rate"},
                {"value": "10x", "label": "Performance boost"},
            ]},
        ]
        assert extract_summary_from_content(content) == "Success rate: 85% Performance boost: 10x"

    def test_comparison_labels_extracted(self):
        """Comparison block extracts label summary."""
        content = [
            {"type": "comparison", "left": {"label": "React", "items": []}, "right": {"label": "Vue", "items": []}},
        ]
        assert extract_summary_from_content(content) == "Comparison: React vs Vue"

    def test_verdict_summary_extracted(self):
        """Verdict summary is extracted."""
        content = [
            {"type": "verdict", "verdict": "recommended", "summary": "Great product for beginners"},
        ]
        assert extract_summary_from_content(content) == "Great product for beginners"

    def test_bullets_first_item_as_fallback(self):
        """Bullets first item is included."""
        content = [
            {"type": "bullets", "items": ["First item", "Second item"]},
        ]
        assert extract_summary_from_content(content) == "First item"

    def test_combined_content_all_extracted(self):
        """Multiple block types combine their text."""
        content = [
            {"type": "paragraph", "text": "Main point."},
            {"type": "quote", "text": "Important quote"},
            {"type": "callout", "style": "tip", "text": "Useful tip."},
        ]
        result = extract_summary_from_content(content)
        assert "Main point." in result
        assert '"Important quote"' in result
        assert "Useful tip." in result

    def test_handles_non_dict_items(self):
        """Gracefully handles non-dict items in content list."""
        content = [
            "not a dict",
            None,
            123,
            {"type": "paragraph", "text": "Valid."},
        ]
        assert extract_summary_from_content(content) == "Valid."

    def test_handles_missing_type(self):
        """Handles blocks without type field."""
        content = [
            {"text": "No type field"},
            {"type": "paragraph", "text": "Valid."},
        ]
        assert extract_summary_from_content(content) == "Valid."


class TestExtractBulletsFromContent:
    """Tests for extract_bullets_from_content function."""

    def test_empty_content_returns_empty_list(self):
        """Empty content list returns empty list."""
        assert extract_bullets_from_content([]) == []
        assert extract_bullets_from_content(None) == []  # type: ignore

    def test_bullets_block_extracts_items(self):
        """Bullets block extracts all items."""
        content = [{"type": "bullets", "items": ["Item 1", "Item 2", "Item 3"]}]
        assert extract_bullets_from_content(content) == ["Item 1", "Item 2", "Item 3"]

    def test_numbered_block_extracts_items(self):
        """Numbered block extracts all items."""
        content = [{"type": "numbered", "items": ["Step 1", "Step 2"]}]
        assert extract_bullets_from_content(content) == ["Step 1", "Step 2"]

    def test_do_dont_block_extracts_with_labels(self):
        """Do/don't block extracts items with checkmark labels."""
        content = [
            {
                "type": "do_dont",
                "do": ["Use async", "Add types"],
                "dont": ["Block event loop", "Use any"],
            }
        ]
        result = extract_bullets_from_content(content)
        assert result == [
            "✓ Use async",
            "✓ Add types",
            "✗ Block event loop",
            "✗ Use any",
        ]

    def test_callout_block_extracts_with_style(self):
        """Callout block extracts with capitalized style label."""
        content = [
            {"type": "callout", "style": "tip", "text": "Use caching."},
            {"type": "callout", "style": "warning", "text": "Avoid blocking."},
            {"type": "callout", "style": "chef_tip", "text": "Season well."},
        ]
        result = extract_bullets_from_content(content)
        assert result == [
            "Tip: Use caching.",
            "Warning: Avoid blocking.",
            "Chef Tip: Season well.",
        ]

    def test_quote_block_extracted(self):
        """Quote block is extracted as bullet."""
        content = [{"type": "quote", "text": "Stay hungry", "attribution": "Steve Jobs"}]
        assert extract_bullets_from_content(content) == ['"Stay hungry" — Steve Jobs']

    def test_comparison_block_extracts_items(self):
        """Comparison block extracts items from both sides."""
        content = [
            {
                "type": "comparison",
                "left": {"label": "Pros", "items": ["Fast", "Easy"]},
                "right": {"label": "Cons", "items": ["Expensive"]},
            }
        ]
        result = extract_bullets_from_content(content)
        assert result == ["Pros: Fast", "Pros: Easy", "Cons: Expensive"]

    def test_pro_con_block_extracts_items(self):
        """Pro/con block extracts items with labels."""
        content = [
            {"type": "pro_con", "pros": ["Great UI", "Fast"], "cons": ["Expensive", "Learning curve"]}
        ]
        result = extract_bullets_from_content(content)
        assert result == [
            "✓ Pro: Great UI",
            "✓ Pro: Fast",
            "✗ Con: Expensive",
            "✗ Con: Learning curve",
        ]

    def test_timestamp_block_extracted(self):
        """Timestamp block is extracted as bullet."""
        content = [{"type": "timestamp", "time": "5:30", "seconds": 330, "label": "Key moment"}]
        assert extract_bullets_from_content(content) == ["[5:30] Key moment"]

    def test_statistic_block_extracted(self):
        """Statistic block items are extracted."""
        content = [
            {"type": "statistic", "items": [
                {"value": "85%", "label": "Accuracy"},
                {"value": "2x", "label": "Speed"},
            ]}
        ]
        assert extract_bullets_from_content(content) == ["Accuracy: 85%", "Speed: 2x"]

    def test_definition_block_extracted(self):
        """Definition block is extracted as bullet."""
        content = [{"type": "definition", "term": "API", "meaning": "Application interface"}]
        assert extract_bullets_from_content(content) == ["API: Application interface"]

    def test_keyvalue_block_extracted(self):
        """Key-value block items are extracted."""
        content = [
            {"type": "keyvalue", "items": [
                {"key": "Duration", "value": "2 hours"},
                {"key": "Level", "value": "Beginner"},
            ]}
        ]
        assert extract_bullets_from_content(content) == ["Duration: 2 hours", "Level: Beginner"]

    def test_ingredient_block_extracted(self):
        """Ingredient block items are extracted."""
        content = [
            {"type": "ingredient", "items": [
                {"name": "flour", "amount": "2", "unit": "cups"},
                {"name": "salt", "amount": "1", "unit": "tsp"},
                {"name": "water"},
            ]}
        ]
        assert extract_bullets_from_content(content) == ["2 cups flour", "1 tsp salt", "water"]

    def test_step_block_extracted(self):
        """Step block items are extracted."""
        content = [
            {"type": "step", "steps": [
                {"number": 1, "instruction": "Preheat oven"},
                {"number": 2, "instruction": "Mix ingredients"},
            ]}
        ]
        assert extract_bullets_from_content(content) == ["1. Preheat oven", "2. Mix ingredients"]

    def test_exercise_block_extracted(self):
        """Exercise block items are extracted."""
        content = [
            {"type": "exercise", "exercises": [
                {"name": "Push-ups", "sets": 3, "reps": "10"},
                {"name": "Squats", "reps": "15"},
                {"name": "Plank"},
            ]}
        ]
        assert extract_bullets_from_content(content) == [
            "Push-ups: 3 sets × 10",
            "Squats: 15",
            "Plank",
        ]

    def test_location_block_extracted(self):
        """Location block is extracted."""
        content = [{"type": "location", "name": "Eiffel Tower", "description": "Iconic Paris landmark"}]
        assert extract_bullets_from_content(content) == ["Eiffel Tower: Iconic Paris landmark"]

    def test_cost_block_extracted(self):
        """Cost block items are extracted."""
        content = [
            {"type": "cost", "currency": "€", "items": [
                {"category": "Flights", "amount": 500},
                {"category": "Hotel", "amount": 300},
            ]}
        ]
        assert extract_bullets_from_content(content) == ["Flights: €500", "Hotel: €300"]

    def test_tool_list_block_extracted(self):
        """Tool list block items are extracted."""
        content = [
            {"type": "tool_list", "tools": [
                {"name": "Hammer", "quantity": "1"},
                {"name": "Nails"},
            ]}
        ]
        assert extract_bullets_from_content(content) == ["Hammer (1)", "Nails"]

    def test_multiple_blocks_combined(self):
        """Multiple blocks combine their items in order."""
        content = [
            {"type": "bullets", "items": ["Bullet 1"]},
            {"type": "numbered", "items": ["Step 1"]},
            {"type": "do_dont", "do": ["Do this"], "dont": ["Don't do that"]},
        ]
        result = extract_bullets_from_content(content)
        assert result == [
            "Bullet 1",
            "Step 1",
            "✓ Do this",
            "✗ Don't do that",
        ]

    def test_empty_items_filtered(self):
        """Empty or falsy items are filtered out."""
        content = [
            {"type": "bullets", "items": ["Valid", "", None, "Also valid"]},
        ]
        result = extract_bullets_from_content(content)
        assert result == ["Valid", "Also valid"]

    def test_handles_non_dict_items(self):
        """Gracefully handles non-dict items in content list."""
        content = [
            "not a dict",
            None,
            {"type": "bullets", "items": ["Valid"]},
        ]
        assert extract_bullets_from_content(content) == ["Valid"]


class TestIntegration:
    """Integration tests with realistic content blocks."""

    def test_realistic_coding_chapter(self):
        """Extract from realistic coding chapter content."""
        content = [
            {"blockId": "1", "type": "paragraph", "text": "This chapter covers error handling in Python."},
            {"blockId": "2", "type": "bullets", "items": ["Use try/except blocks", "Handle specific exceptions", "Log errors properly"]},
            {"blockId": "3", "type": "callout", "style": "tip", "text": "Always catch the most specific exception first."},
            {"blockId": "4", "type": "example", "code": "try:\n    risky_op()\nexcept ValueError as e:\n    logger.error(e)"},
        ]

        summary = extract_summary_from_content(content)
        bullets = extract_bullets_from_content(content)

        assert "This chapter covers error handling in Python." in summary
        assert "Use try/except blocks" in bullets
        assert "Handle specific exceptions" in bullets
        assert "Tip: Always catch the most specific exception first." in bullets

    def test_realistic_cooking_chapter(self):
        """Extract from realistic cooking chapter content."""
        content = [
            {"blockId": "1", "type": "paragraph", "text": "Prepare the sauce by combining all ingredients."},
            {"blockId": "2", "type": "numbered", "items": ["Dice the onions", "Sauté for 5 minutes", "Add tomatoes"]},
            {"blockId": "3", "type": "callout", "style": "chef_tip", "text": "Don't rush the sautéing process."},
        ]

        summary = extract_summary_from_content(content)
        bullets = extract_bullets_from_content(content)

        assert "Prepare the sauce by combining all ingredients." in summary
        assert "Dice the onions" in bullets
        assert "Chef Tip: Don't rush the sautéing process." in bullets

    def test_realistic_review_chapter(self):
        """Extract from realistic review chapter content."""
        content = [
            {"blockId": "1", "type": "paragraph", "text": "The camera system is excellent."},
            {"blockId": "2", "type": "comparison", "left": {"label": "iPhone", "items": ["Better video"]}, "right": {"label": "Android", "items": ["More flexibility"]}},
            {"blockId": "3", "type": "statistic", "items": [{"value": "9/10", "label": "Camera score"}]},
        ]

        summary = extract_summary_from_content(content)
        bullets = extract_bullets_from_content(content)

        assert "The camera system is excellent." in summary
        assert "Comparison: iPhone vs Android" in summary
        assert "iPhone: Better video" in bullets
        assert "Android: More flexibility" in bullets
        assert "Camera score: 9/10" in bullets

    def test_content_with_quotes_and_timestamps(self):
        """Handle content with quotes and timestamps."""
        content = [
            {"blockId": "1", "type": "quote", "text": "The future is already here", "attribution": "William Gibson"},
            {"blockId": "2", "type": "timestamp", "time": "10:30", "seconds": 630, "label": "Main argument begins"},
            {"blockId": "3", "type": "bullets", "items": ["Point one", "Point two"]},
        ]

        summary = extract_summary_from_content(content)
        bullets = extract_bullets_from_content(content)

        assert '"The future is already here" — William Gibson' in summary
        assert "Main argument begins" in summary
        assert '"The future is already here" — William Gibson' in bullets
        assert "[10:30] Main argument begins" in bullets
        assert "Point one" in bullets
