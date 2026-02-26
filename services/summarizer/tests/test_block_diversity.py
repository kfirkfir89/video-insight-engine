"""Tests for enforce_block_diversity post-generation safety net."""

from src.services.block_postprocessing import enforce_block_diversity


class TestEnforceBlockDiversity:
    """Tests for enforce_block_diversity function."""

    def test_empty_content_returns_empty(self):
        assert enforce_block_diversity([], "Chapter 1") == []

    def test_single_callout_preserved(self):
        content = [
            {"type": "paragraph", "text": "Hello"},
            {"type": "callout", "style": "tip", "text": "Tip here"},
        ]
        result = enforce_block_diversity(content, "Chapter 1")
        callouts = [b for b in result if b.get("type") == "callout"]
        assert len(callouts) == 1

    def test_excess_callouts_trimmed_to_one(self):
        content = [
            {"type": "callout", "style": "tip", "text": "First tip"},
            {"type": "paragraph", "text": "Middle"},
            {"type": "callout", "style": "warning", "text": "Second tip"},
            {"type": "callout", "style": "note", "text": "Third tip"},
        ]
        result = enforce_block_diversity(content, "Chapter 1")
        callouts = [b for b in result if b.get("type") == "callout"]
        assert len(callouts) == 1
        assert callouts[0]["text"] == "First tip"

    def test_single_comparison_preserved(self):
        content = [
            {"type": "comparison", "left": {}, "right": {}},
            {"type": "paragraph", "text": "Hello"},
        ]
        result = enforce_block_diversity(content, "Chapter 1")
        comparisons = [b for b in result if b.get("type") == "comparison"]
        assert len(comparisons) == 1

    def test_excess_comparisons_trimmed_to_one(self):
        content = [
            {"type": "comparison", "left": {"label": "A"}, "right": {"label": "B"}},
            {"type": "paragraph", "text": "Middle"},
            {"type": "comparison", "left": {"label": "C"}, "right": {"label": "D"}},
        ]
        result = enforce_block_diversity(content, "Chapter 1")
        comparisons = [b for b in result if b.get("type") == "comparison"]
        assert len(comparisons) == 1

    def test_cross_chapter_callout_dedup(self):
        """Trailing callout removed when previous chapter also ended with callout."""
        content = [
            {"type": "paragraph", "text": "Hello"},
            {"type": "callout", "style": "tip", "text": "Ending tip"},
        ]
        prev_block_types = ["paragraph", "callout"]
        result = enforce_block_diversity(content, "Chapter 2", prev_block_types)
        # The trailing callout should be removed
        assert result[-1]["type"] == "paragraph"

    def test_no_cross_chapter_dedup_when_different_ending(self):
        """Trailing callout preserved when previous chapter ended differently."""
        content = [
            {"type": "paragraph", "text": "Hello"},
            {"type": "callout", "style": "tip", "text": "Ending tip"},
        ]
        prev_block_types = ["paragraph", "quote"]
        result = enforce_block_diversity(content, "Chapter 2", prev_block_types)
        assert result[-1]["type"] == "callout"

    def test_no_cross_chapter_dedup_without_prev(self):
        """Trailing callout preserved when no previous chapter data."""
        content = [
            {"type": "paragraph", "text": "Hello"},
            {"type": "callout", "style": "tip", "text": "Ending tip"},
        ]
        result = enforce_block_diversity(content, "Chapter 1", None)
        assert result[-1]["type"] == "callout"

    def test_generic_attribution_replaced_with_highlight(self):
        content = [
            {"type": "quote", "text": "Something insightful", "attribution": "Expert Name"},
        ]
        result = enforce_block_diversity(content, "Chapter 1")
        assert result[0]["variant"] == "highlight"
        assert "attribution" not in result[0]

    def test_specific_attribution_preserved(self):
        content = [
            {"type": "quote", "text": "Hello world", "attribution": "John Smith"},
        ]
        result = enforce_block_diversity(content, "Chapter 1")
        assert result[0]["attribution"] == "John Smith"
        assert result[0].get("variant") is None

    def test_various_generic_attributions(self):
        """All known generic attributions should be replaced."""
        generics = [
            "Speaker", "Host", "Expert", "the speaker",
            "the host", "interviewee", "presenter", "Engineer",
        ]
        for attr in generics:
            content = [{"type": "quote", "text": "Test", "attribution": attr}]
            result = enforce_block_diversity(content, "Test")
            assert result[0]["variant"] == "highlight", f"Failed for attribution: {attr}"

    def test_preserves_block_count_minus_trimmed(self):
        """Total block count should equal input minus trimmed blocks."""
        content = [
            {"type": "paragraph", "text": "A"},
            {"type": "callout", "style": "tip", "text": "B"},
            {"type": "callout", "style": "note", "text": "C"},
            {"type": "comparison", "left": {}, "right": {}},
            {"type": "comparison", "left": {}, "right": {}},
        ]
        result = enforce_block_diversity(content, "Chapter 1")
        # 1 paragraph + 1 callout (of 2) + 1 comparison (of 2) = 3
        assert len(result) == 3

    def test_does_not_mutate_input(self):
        """Input list should not be modified."""
        content = [
            {"type": "quote", "text": "Test", "attribution": "Speaker"},
        ]
        original_len = len(content)
        original_attr = content[0].get("attribution")
        enforce_block_diversity(content, "Chapter 1")
        # Original dict should still have attribution (we use {**b} spread)
        assert len(content) == original_len
        assert content[0].get("attribution") == original_attr

    def test_combined_rules(self):
        """Multiple rules should apply together."""
        content = [
            {"type": "callout", "style": "tip", "text": "First"},
            {"type": "callout", "style": "note", "text": "Second"},
            {"type": "quote", "text": "Wise words", "attribution": "Expert"},
            {"type": "comparison", "left": {}, "right": {}},
            {"type": "comparison", "left": {}, "right": {}},
            {"type": "callout", "style": "warning", "text": "Third"},
        ]
        prev_block_types = ["paragraph", "quote"]
        result = enforce_block_diversity(content, "Chapter 2", prev_block_types)
        callouts = [b for b in result if b.get("type") == "callout"]
        comparisons = [b for b in result if b.get("type") == "comparison"]
        quotes = [b for b in result if b.get("type") == "quote"]
        assert len(callouts) == 1
        assert len(comparisons) == 1
        assert quotes[0]["variant"] == "highlight"
