"""Tests for block output quality V3 features.

Covers:
- enforce_block_diversity() — callout/comparison trimming, cross-chapter, generic attribution
- title_needs_subtitle() — vague vs descriptive title detection
- infer_view_from_blocks() — per-view signature thresholds (podcast=1)
- resolve_view() — category-aware fallback
- populate_visual_thumbnails() — YouTube thumbnail population
- Integration: summarize_chapter() end-to-end with mocked LLM
- Integration: process_creator_chapters() cross-chapter state threading
- Integration: build_chapter_dict() visual image + generatedTitle wiring
"""

import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from src.services.llm import (
    LLMService,
    ChapterSummaryRequest,
    ChapterContext,
    AccuracyHints,
    title_needs_subtitle,
)
from src.services.block_postprocessing import (
    enforce_block_diversity,
    infer_view_from_blocks,
    resolve_view,
    CALLOUT_MAX_PER_CHAPTER,
    COMPARISON_MAX_PER_CHAPTER,
)
from src.utils.constants import GENERIC_ATTRIBUTIONS
from src.services.chapter_pipeline import populate_visual_thumbnails, build_chapter_dict


# ─────────────────────────────────────────────────────────────────
# enforce_block_diversity
# ─────────────────────────────────────────────────────────────────


class TestEnforceBlockDiversity:
    """Tests for post-generation block diversity enforcement."""

    def test_empty_content_returns_empty(self):
        assert enforce_block_diversity([], "Title") == []

    def test_single_callout_preserved(self):
        content = [
            {"type": "paragraph", "text": "intro"},
            {"type": "callout", "style": "tip", "text": "a tip"},
        ]
        result = enforce_block_diversity(content, "Title")
        callouts = [b for b in result if b["type"] == "callout"]
        assert len(callouts) == 1

    def test_excess_callouts_trimmed(self):
        content = [
            {"type": "paragraph", "text": "intro"},
            {"type": "callout", "style": "tip", "text": "first tip"},
            {"type": "paragraph", "text": "middle"},
            {"type": "callout", "style": "warning", "text": "a warning"},
            {"type": "callout", "style": "note", "text": "a note"},
        ]
        result = enforce_block_diversity(content, "Title")
        callouts = [b for b in result if b["type"] == "callout"]
        assert len(callouts) == CALLOUT_MAX_PER_CHAPTER
        # First callout is kept
        assert callouts[0]["text"] == "first tip"

    def test_excess_comparisons_trimmed(self):
        content = [
            {"type": "comparison", "left": {"label": "A"}, "right": {"label": "B"}},
            {"type": "paragraph", "text": "mid"},
            {"type": "comparison", "left": {"label": "C"}, "right": {"label": "D"}},
        ]
        result = enforce_block_diversity(content, "Title")
        comparisons = [b for b in result if b["type"] == "comparison"]
        assert len(comparisons) == COMPARISON_MAX_PER_CHAPTER
        assert comparisons[0]["left"]["label"] == "A"

    def test_cross_chapter_callout_ending_removed(self):
        content = [
            {"type": "paragraph", "text": "intro"},
            {"type": "callout", "style": "tip", "text": "ending tip"},
        ]
        prev_types = ["paragraph", "quote", "callout"]
        result = enforce_block_diversity(content, "Title", prev_block_types=prev_types)
        # Last block (callout) removed since prev chapter also ended with callout
        assert len(result) == 1
        assert result[0]["type"] == "paragraph"

    def test_cross_chapter_different_ending_preserved(self):
        content = [
            {"type": "paragraph", "text": "intro"},
            {"type": "callout", "style": "tip", "text": "ending tip"},
        ]
        prev_types = ["paragraph", "quote", "bullets"]
        result = enforce_block_diversity(content, "Title", prev_block_types=prev_types)
        # Callout kept since prev chapter did NOT end with callout
        assert len(result) == 2
        assert result[-1]["type"] == "callout"

    def test_no_prev_types_skips_cross_chapter_check(self):
        content = [
            {"type": "paragraph", "text": "intro"},
            {"type": "callout", "style": "tip", "text": "ending tip"},
        ]
        result = enforce_block_diversity(content, "Title", prev_block_types=None)
        assert len(result) == 2

    def test_generic_attribution_replaced_with_highlight(self):
        content = [
            {"type": "quote", "text": "Some statement", "attribution": "Expert Name"},
        ]
        result = enforce_block_diversity(content, "Title")
        assert result[0]["variant"] == "highlight"
        assert "attribution" not in result[0]

    def test_real_attribution_preserved(self):
        content = [
            {"type": "quote", "text": "Some statement", "attribution": "Andrej Karpathy"},
        ]
        result = enforce_block_diversity(content, "Title")
        assert result[0]["attribution"] == "Andrej Karpathy"
        assert result[0].get("variant") != "highlight"

    def test_all_generic_attributions_caught(self):
        for attr in GENERIC_ATTRIBUTIONS:
            content = [{"type": "quote", "text": "test", "attribution": attr.title()}]
            result = enforce_block_diversity(content, "Title")
            assert result[0].get("variant") == "highlight", f"Failed for: {attr}"
            assert "attribution" not in result[0], f"Attribution not removed for: {attr}"

    def test_non_quote_blocks_unaffected(self):
        content = [
            {"type": "paragraph", "text": "hello"},
            {"type": "bullets", "items": ["a", "b"]},
            {"type": "definition", "term": "X", "meaning": "Y"},
        ]
        result = enforce_block_diversity(content, "Title")
        assert len(result) == 3
        assert result[0]["type"] == "paragraph"


# ─────────────────────────────────────────────────────────────────
# title_needs_subtitle
# ─────────────────────────────────────────────────────────────────


class TestTitleNeedsSubtitle:
    """Tests for vague title detection."""

    def test_empty_title(self):
        assert title_needs_subtitle("") is True

    def test_whitespace_only(self):
        assert title_needs_subtitle("   ") is True

    def test_intro(self):
        assert title_needs_subtitle("Intro") is True

    def test_outro(self):
        assert title_needs_subtitle("Outro") is True

    def test_part_number(self):
        assert title_needs_subtitle("Part 1") is True
        assert title_needs_subtitle("Part 12") is True

    def test_chapter_number(self):
        assert title_needs_subtitle("Chapter 3") is True

    def test_section_number(self):
        assert title_needs_subtitle("Section 5") is True

    def test_wrapup(self):
        assert title_needs_subtitle("Wrap-up") is True
        assert title_needs_subtitle("Wrapup") is True

    def test_conclusion(self):
        assert title_needs_subtitle("Conclusion") is True

    def test_bonus(self):
        assert title_needs_subtitle("Bonus") is True

    def test_qa(self):
        assert title_needs_subtitle("Q&A") is True
        assert title_needs_subtitle("Q & A") is True
        assert title_needs_subtitle("QA") is True

    def test_final_thoughts(self):
        assert title_needs_subtitle("Final Thoughts") is True

    def test_closing(self):
        assert title_needs_subtitle("Closing") is True

    def test_opening(self):
        assert title_needs_subtitle("Opening") is True

    def test_welcome(self):
        assert title_needs_subtitle("Welcome") is True

    def test_preface(self):
        assert title_needs_subtitle("Preface") is True

    def test_single_word_non_vague(self):
        """Single non-regex words still need subtitles (only 1 word)."""
        assert title_needs_subtitle("Setup") is True
        assert title_needs_subtitle("Overview") is True

    def test_two_word_titles_are_descriptive(self):
        """Two-word titles are considered descriptive enough."""
        assert title_needs_subtitle("The Setup") is False
        assert title_needs_subtitle("Getting Started") is False
        assert title_needs_subtitle("React Hooks") is False

    def test_descriptive_title_3_words(self):
        assert title_needs_subtitle("React State Management") is False
        assert title_needs_subtitle("Token Refresh Middleware") is False

    def test_descriptive_title_4_words(self):
        assert title_needs_subtitle("How JWT Authentication Works") is False

    def test_descriptive_title_long(self):
        assert title_needs_subtitle("Setting Up Token Refresh Middleware") is False

    def test_case_insensitive(self):
        assert title_needs_subtitle("INTRO") is True
        assert title_needs_subtitle("outro") is True
        assert title_needs_subtitle("Part 1") is True


# ─────────────────────────────────────────────────────────────────
# infer_view_from_blocks (per-view thresholds)
# ─────────────────────────────────────────────────────────────────


class TestInferViewFromBlocks:
    """Tests for block-based view inference with per-view thresholds."""

    def test_empty_content(self):
        assert infer_view_from_blocks([]) is None

    def test_no_signature_blocks(self):
        content = [{"type": "paragraph"}, {"type": "bullets"}]
        assert infer_view_from_blocks(content) is None

    def test_cooking_needs_two(self):
        # Only 1 cooking signature → no match
        content = [{"type": "ingredient"}]
        assert infer_view_from_blocks(content) is None

        # 2 cooking signatures → match
        content = [{"type": "ingredient"}, {"type": "step"}]
        assert infer_view_from_blocks(content) == "cooking"

    def test_podcast_needs_one(self):
        """Podcast has threshold=1 since it only has 'guest' as signature."""
        content = [{"type": "guest"}, {"type": "paragraph"}]
        assert infer_view_from_blocks(content) == "podcast"

    def test_coding_needs_two(self):
        content = [{"type": "code"}]
        assert infer_view_from_blocks(content) is None

        content = [{"type": "code"}, {"type": "terminal"}]
        assert infer_view_from_blocks(content) == "coding"

    def test_reviews_needs_two(self):
        content = [{"type": "pro_con"}, {"type": "rating"}]
        assert infer_view_from_blocks(content) == "reviews"

    def test_tie_defers_to_llm(self):
        # Both cooking and diy have 'step' as signature
        # Only possible tie: step + tool_list (diy) and step + ingredient (cooking)
        content = [{"type": "step"}, {"type": "ingredient"}, {"type": "tool_list"}]
        result = infer_view_from_blocks(content)
        # Both cooking (step+ingredient) and diy (step+tool_list) match → tie → None
        assert result is None


# ─────────────────────────────────────────────────────────────────
# resolve_view (category-aware fallback)
# ─────────────────────────────────────────────────────────────────


class TestResolveView:
    """Tests for view resolution with category fallback."""

    def test_valid_llm_view_returned(self):
        content = [{"type": "paragraph"}]
        assert resolve_view(content, "coding", "Title") == "coding"

    def test_invalid_llm_view_falls_to_standard(self):
        content = [{"type": "paragraph"}]
        assert resolve_view(content, "invalid_view", "Title") == "standard"

    def test_inferred_overrides_llm(self):
        content = [{"type": "ingredient"}, {"type": "step"}, {"type": "nutrition"}]
        result = resolve_view(content, "coding", "Title")
        assert result == "cooking"

    def test_category_fallback_when_llm_standard(self):
        content = [{"type": "paragraph"}, {"type": "quote"}]
        result = resolve_view(content, "standard", "Title", persona_hint="interview")
        assert result == "podcast"

    def test_category_fallback_recipe_to_cooking(self):
        content = [{"type": "paragraph"}]
        result = resolve_view(content, "standard", "Title", persona_hint="recipe")
        assert result == "cooking"

    def test_category_fallback_code_to_coding(self):
        content = [{"type": "paragraph"}]
        result = resolve_view(content, "standard", "Title", persona_hint="code")
        assert result == "coding"

    def test_no_category_fallback_when_llm_view_valid(self):
        content = [{"type": "paragraph"}]
        result = resolve_view(content, "fitness", "Title", persona_hint="recipe")
        # LLM view is not 'standard', so category fallback does not trigger
        assert result == "fitness"

    def test_no_category_no_fallback(self):
        content = [{"type": "paragraph"}]
        result = resolve_view(content, "standard", "Title", persona_hint=None)
        assert result == "standard"

    def test_standard_category_no_fallback(self):
        content = [{"type": "paragraph"}]
        result = resolve_view(content, "standard", "Title", persona_hint="standard")
        assert result == "standard"


# ─────────────────────────────────────────────────────────────────
# populate_visual_thumbnails
# ─────────────────────────────────────────────────────────────────


class TestPopulateVisualImages:
    """Tests for YouTube thumbnail population on visual blocks."""

    def test_empty_content(self):
        result = populate_visual_thumbnails([], "dQw4w9WgXcQ")
        assert result == []

    def test_visual_block_gets_thumbnail(self):
        content = [
            {"type": "visual", "description": "A diagram"},
        ]
        result = populate_visual_thumbnails(content, "dQw4w9WgXcQ")
        assert result[0]["imageUrl"] == "https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg"

    def test_existing_imageUrl_not_overwritten(self):
        content = [
            {"type": "visual", "description": "A diagram", "imageUrl": "https://existing.com/img.jpg"},
        ]
        result = populate_visual_thumbnails(content, "dQw4w9WgXcQ")
        assert result[0]["imageUrl"] == "https://existing.com/img.jpg"

    def test_non_visual_blocks_unaffected(self):
        content = [
            {"type": "paragraph", "text": "hello"},
            {"type": "quote", "text": "quoted"},
        ]
        result = populate_visual_thumbnails(content, "dQw4w9WgXcQ")
        assert "imageUrl" not in result[0]
        assert "imageUrl" not in result[1]

    def test_mixed_content(self):
        content = [
            {"type": "paragraph", "text": "intro"},
            {"type": "visual", "description": "diagram 1"},
            {"type": "visual", "description": "diagram 2", "imageUrl": "https://custom.com/img.jpg"},
            {"type": "callout", "style": "tip", "text": "tip"},
        ]
        result = populate_visual_thumbnails(content, "jNQXAC9IVRw")
        assert "imageUrl" not in result[0]
        assert result[1]["imageUrl"] == "https://img.youtube.com/vi/jNQXAC9IVRw/maxresdefault.jpg"
        assert result[2]["imageUrl"] == "https://custom.com/img.jpg"
        assert "imageUrl" not in result[3]


# ─────────────────────────────────────────────────────────────────
# Integration: summarize_chapter() end-to-end (V.2, V.3, V.4)
# ─────────────────────────────────────────────────────────────────


class TestSummarizeChapterIntegration:
    """Integration tests for summarize_chapter() with mocked LLM.

    These verify the full pipeline: LLM call → parse → diversity enforcement →
    block IDs → view resolution, without requiring live LLM calls.
    """

    def _make_service(self, llm_response: str) -> LLMService:
        """Create an LLMService with a mocked _call_llm returning the given response."""
        provider = MagicMock()
        provider.model = "test-model"
        service = LLMService(provider)
        service._call_llm = AsyncMock(return_value=llm_response)
        return service

    # ── V.2: Quote attributions use real names ──

    @pytest.mark.asyncio
    async def test_generic_attributions_replaced_in_pipeline(self):
        """summarize_chapter() replaces generic attributions via diversity enforcer."""
        llm_output = json.dumps({
            "content": [
                {"type": "paragraph", "text": "Introduction to the topic."},
                {"type": "quote", "text": "AI will transform everything.", "attribution": "Expert Name"},
                {"type": "quote", "text": "We need careful regulation.", "attribution": "The Speaker"},
            ],
            "view": "standard",
        })
        service = self._make_service(llm_output)

        result = await service.summarize_chapter(ChapterSummaryRequest(
            chapter_text="Some transcript text about AI...",
            context=ChapterContext(title="The Future of AI"),
            accuracy=AccuracyHints(guest_names=["Sam Altman", "Demis Hassabis"]),
        ))

        content = result["content"]
        quotes = [b for b in content if b["type"] == "quote"]
        # Both had generic attributions → converted to highlight variant
        for q in quotes:
            assert q.get("variant") == "highlight"
            assert "attribution" not in q

    @pytest.mark.asyncio
    async def test_real_attributions_preserved_in_pipeline(self):
        """summarize_chapter() preserves real name attributions."""
        llm_output = json.dumps({
            "content": [
                {"type": "paragraph", "text": "A discussion about ML."},
                {"type": "quote", "text": "Training data matters.", "attribution": "Andrej Karpathy"},
            ],
            "view": "podcast",
        })
        service = self._make_service(llm_output)

        result = await service.summarize_chapter(ChapterSummaryRequest(
            chapter_text="Transcript about ML training...",
            context=ChapterContext(title="Training Deep Networks"),
            accuracy=AccuracyHints(guest_names=["Andrej Karpathy"]),
        ))

        content = result["content"]
        quotes = [b for b in content if b["type"] == "quote"]
        assert len(quotes) == 1
        assert quotes[0]["attribution"] == "Andrej Karpathy"
        assert quotes[0].get("variant") != "highlight"

    @pytest.mark.asyncio
    async def test_guest_attribution_prompt_injected(self):
        """summarize_chapter() injects guest attribution into prompt when guest_names provided."""
        llm_output = json.dumps({
            "content": [{"type": "paragraph", "text": "Test."}],
            "view": "standard",
        })
        service = self._make_service(llm_output)

        await service.summarize_chapter(ChapterSummaryRequest(
            chapter_text="Some transcript...",
            context=ChapterContext(title="Test Chapter"),
            accuracy=AccuracyHints(guest_names=["Lex Fridman", "Elon Musk"]),
        ))

        # Verify the prompt sent to LLM contains guest attribution instruction
        call_args = service._call_llm.call_args
        prompt = call_args[0][0]
        assert "SPEAKER ATTRIBUTION" in prompt
        assert "Lex Fridman" in prompt
        assert "Elon Musk" in prompt

    @pytest.mark.asyncio
    async def test_no_guest_attribution_when_none(self):
        """summarize_chapter() does not inject attribution when guest_names is None."""
        llm_output = json.dumps({
            "content": [{"type": "paragraph", "text": "Test."}],
            "view": "standard",
        })
        service = self._make_service(llm_output)

        await service.summarize_chapter(ChapterSummaryRequest(
            chapter_text="Some transcript...",
            context=ChapterContext(title="Test Chapter"),
            accuracy=AccuracyHints(guest_names=None),
        ))

        prompt = service._call_llm.call_args[0][0]
        assert "SPEAKER ATTRIBUTION" not in prompt

    # ── V.3: Max 1 callout, no consecutive same-ending ──

    @pytest.mark.asyncio
    async def test_excess_callouts_trimmed_in_pipeline(self):
        """summarize_chapter() trims excess callouts via diversity enforcer."""
        llm_output = json.dumps({
            "content": [
                {"type": "paragraph", "text": "Introduction."},
                {"type": "callout", "style": "tip", "text": "First tip."},
                {"type": "paragraph", "text": "More content."},
                {"type": "callout", "style": "warning", "text": "A warning."},
                {"type": "callout", "style": "note", "text": "A note."},
            ],
            "view": "standard",
        })
        service = self._make_service(llm_output)

        result = await service.summarize_chapter(ChapterSummaryRequest(
            chapter_text="Transcript about tips and warnings...",
            context=ChapterContext(title="Important Guidelines"),
        ))

        content = result["content"]
        callouts = [b for b in content if b["type"] == "callout"]
        assert len(callouts) == CALLOUT_MAX_PER_CHAPTER
        assert callouts[0]["text"] == "First tip."

    @pytest.mark.asyncio
    async def test_excess_comparisons_trimmed_in_pipeline(self):
        """summarize_chapter() trims excess comparisons via diversity enforcer."""
        llm_output = json.dumps({
            "content": [
                {"type": "comparison", "left": {"label": "React"}, "right": {"label": "Vue"}},
                {"type": "paragraph", "text": "Also comparing:"},
                {"type": "comparison", "left": {"label": "Angular"}, "right": {"label": "Svelte"}},
            ],
            "view": "coding",
        })
        service = self._make_service(llm_output)

        result = await service.summarize_chapter(ChapterSummaryRequest(
            chapter_text="Transcript comparing frameworks...",
            context=ChapterContext(title="Framework Comparison"),
        ))

        content = result["content"]
        comparisons = [b for b in content if b["type"] == "comparison"]
        assert len(comparisons) == COMPARISON_MAX_PER_CHAPTER
        assert comparisons[0]["left"]["label"] == "React"

    @pytest.mark.asyncio
    async def test_consecutive_callout_ending_prevented(self):
        """summarize_chapter() prevents consecutive chapters from ending with callout."""
        llm_output = json.dumps({
            "content": [
                {"type": "paragraph", "text": "Some content."},
                {"type": "callout", "style": "tip", "text": "Ending tip."},
            ],
            "view": "standard",
        })
        service = self._make_service(llm_output)

        result = await service.summarize_chapter(ChapterSummaryRequest(
            chapter_text="Transcript...",
            context=ChapterContext(title="Chapter 2"),
            accuracy=AccuracyHints(prev_chapter_block_types=["paragraph", "quote", "callout"]),
        ))

        content = result["content"]
        # Trailing callout removed since previous chapter also ended with callout
        assert content[-1]["type"] != "callout"

    @pytest.mark.asyncio
    async def test_diversity_instruction_injected(self):
        """summarize_chapter() injects diversity instruction when prev_chapter_block_types present."""
        llm_output = json.dumps({
            "content": [{"type": "paragraph", "text": "Test."}],
            "view": "standard",
        })
        service = self._make_service(llm_output)

        await service.summarize_chapter(ChapterSummaryRequest(
            chapter_text="Transcript...",
            context=ChapterContext(title="Chapter 3"),
            accuracy=AccuracyHints(prev_chapter_block_types=["paragraph", "quote", "comparison", "callout"]),
        ))

        prompt = service._call_llm.call_args[0][0]
        assert "BLOCK DIVERSITY ENFORCEMENT" in prompt
        assert "paragraph, quote, comparison, callout" in prompt

    @pytest.mark.asyncio
    async def test_all_blocks_get_block_ids(self):
        """summarize_chapter() injects blockId into every content block."""
        llm_output = json.dumps({
            "content": [
                {"type": "paragraph", "text": "Introduction."},
                {"type": "bullets", "items": ["item 1", "item 2"]},
                {"type": "callout", "style": "tip", "text": "A tip."},
            ],
            "view": "standard",
        })
        service = self._make_service(llm_output)

        result = await service.summarize_chapter(ChapterSummaryRequest(chapter_text="Transcript...", context=ChapterContext(title="Test Chapter")))

        for block in result["content"]:
            assert "blockId" in block
            assert len(block["blockId"]) > 0

    # ── V.4: Podcast video gets "podcast" views ──

    @pytest.mark.asyncio
    async def test_guest_block_infers_podcast_view(self):
        """summarize_chapter() infers 'podcast' when guest block present (threshold=1)."""
        llm_output = json.dumps({
            "content": [
                {"type": "guest", "guests": [{"name": "Tim Ferriss", "role": "Author"}]},
                {"type": "paragraph", "text": "Discussion about habits."},
                {"type": "quote", "text": "Focus on systems.", "attribution": "Tim Ferriss"},
            ],
            "view": "coding",  # LLM returns wrong view
        })
        service = self._make_service(llm_output)

        result = await service.summarize_chapter(ChapterSummaryRequest(
            chapter_text="Transcript of podcast interview...",
            context=ChapterContext(title="Interview with Tim Ferriss", persona_hint="interview"),
        ))

        # Block inference should override LLM since guest block → podcast (threshold=1)
        assert result["view"] == "podcast"

    @pytest.mark.asyncio
    async def test_category_fallback_interview_to_podcast(self):
        """summarize_chapter() falls back to 'podcast' via category when LLM returns 'standard'."""
        llm_output = json.dumps({
            "content": [
                {"type": "paragraph", "text": "A conversation about technology."},
                {"type": "quote", "text": "Technology changes everything.", "attribution": "Jane Smith"},
            ],
            "view": "standard",  # LLM returns generic view
        })
        service = self._make_service(llm_output)

        result = await service.summarize_chapter(ChapterSummaryRequest(
            chapter_text="Transcript of interview...",
            context=ChapterContext(title="Tech Discussion", persona_hint="interview"),
        ))

        # Category fallback: interview → podcast
        assert result["view"] == "podcast"

    @pytest.mark.asyncio
    async def test_category_fallback_recipe_to_cooking(self):
        """summarize_chapter() falls back to 'cooking' via persona_hint='recipe'."""
        llm_output = json.dumps({
            "content": [
                {"type": "paragraph", "text": "Let's make pasta."},
            ],
            "view": "standard",
        })
        service = self._make_service(llm_output)

        result = await service.summarize_chapter(ChapterSummaryRequest(
            chapter_text="Transcript about cooking pasta...",
            context=ChapterContext(title="Perfect Pasta", persona_hint="recipe"),
        ))

        assert result["view"] == "cooking"

    @pytest.mark.asyncio
    async def test_valid_llm_view_preserved_over_category(self):
        """summarize_chapter() keeps valid LLM view when it's not 'standard'."""
        llm_output = json.dumps({
            "content": [
                {"type": "paragraph", "text": "A fitness routine."},
            ],
            "view": "fitness",  # Valid non-standard view
        })
        service = self._make_service(llm_output)

        result = await service.summarize_chapter(ChapterSummaryRequest(
            chapter_text="Transcript about workout...",
            context=ChapterContext(title="Morning Routine", persona_hint="recipe"),  # Category says recipe, but LLM says fitness
        ))

        # LLM view is valid and non-standard, so category fallback doesn't trigger
        assert result["view"] == "fitness"


# ─────────────────────────────────────────────────────────────────
# Integration: build_chapter_dict() visual images (V.5)
# ─────────────────────────────────────────────────────────────────


class TestBuildChapterDictIntegration:
    """Integration tests for build_chapter_dict() with visual blocks and youtube_id."""

    def test_visual_blocks_get_thumbnail_via_build_chapter_dict(self):
        """build_chapter_dict() populates imageUrl on visual blocks when youtube_id provided."""
        raw = {"title": "Making Carbonara", "startSeconds": 120, "endSeconds": 300}
        summary_data = {
            "content": [
                {"type": "paragraph", "text": "In this chapter..."},
                {"type": "visual", "description": "Adding eggs to pasta"},
                {"type": "step", "title": "Mix eggs", "detail": "Stir gently"},
            ],
            "view": "cooking",
        }

        chapter = build_chapter_dict(raw, summary_data, is_creator_chapter=True, youtube_id="dQw4w9WgXcQ")

        visual_blocks = [b for b in chapter["content"] if b["type"] == "visual"]
        assert len(visual_blocks) == 1
        assert visual_blocks[0]["imageUrl"] == "https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg"

    def test_no_youtube_id_skips_image_population(self):
        """build_chapter_dict() leaves visual blocks unchanged without youtube_id."""
        raw = {"title": "A Visual Chapter", "startSeconds": 0, "endSeconds": 60}
        summary_data = {
            "content": [
                {"type": "visual", "description": "A diagram"},
            ],
            "view": "standard",
        }

        chapter = build_chapter_dict(raw, summary_data, is_creator_chapter=False, youtube_id=None)

        visual_blocks = [b for b in chapter["content"] if b["type"] == "visual"]
        assert "imageUrl" not in visual_blocks[0]

    def test_existing_image_url_not_overwritten(self):
        """build_chapter_dict() preserves existing imageUrl on visual blocks."""
        raw = {"title": "Diagrams", "startSeconds": 0, "endSeconds": 60}
        summary_data = {
            "content": [
                {"type": "visual", "description": "Custom image", "imageUrl": "https://custom.com/img.png"},
            ],
            "view": "standard",
        }

        chapter = build_chapter_dict(raw, summary_data, is_creator_chapter=False, youtube_id="jNQXAC9IVRw")

        assert chapter["content"][0]["imageUrl"] == "https://custom.com/img.png"

    def test_view_passed_through(self):
        """build_chapter_dict() includes view from summary_data."""
        raw = {"title": "Cooking", "startSeconds": 0, "endSeconds": 60}
        summary_data = {"content": [{"type": "paragraph", "text": "Hi"}], "view": "cooking"}

        chapter = build_chapter_dict(raw, summary_data, is_creator_chapter=True, youtube_id="abc")

        assert chapter["view"] == "cooking"


# ─────────────────────────────────────────────────────────────────
# Integration: Conditional generatedTitle (V.6)
# ─────────────────────────────────────────────────────────────────


class TestConditionalGeneratedTitleIntegration:
    """Integration tests for conditional generatedTitle via title_needs_subtitle."""

    def _make_service(self, llm_response: str) -> LLMService:
        provider = MagicMock()
        provider.model = "test-model"
        service = LLMService(provider)
        service._call_llm = AsyncMock(return_value=llm_response)
        return service

    @pytest.mark.asyncio
    async def test_vague_title_triggers_subtitle_generation(self):
        """has_creator_title=True (from title_needs_subtitle) triggers generatedTitle in prompt."""
        llm_output = json.dumps({
            "content": [{"type": "paragraph", "text": "Intro content."}],
            "view": "standard",
            "generatedTitle": "How JWT Token Refresh Prevents Session Expiry",
        })
        service = self._make_service(llm_output)

        # "Intro" is vague → title_needs_subtitle("Intro") returns True
        assert title_needs_subtitle("Intro") is True

        result = await service.summarize_chapter(ChapterSummaryRequest(
            chapter_text="Transcript about authentication...",
            context=ChapterContext(title="Intro", has_creator_title=True),  # What pipeline passes for vague titles
        ))

        # Prompt should include subtitle generation instruction
        prompt = service._call_llm.call_args[0][0]
        assert "subtitle" in prompt.lower() or "generatedTitle" in prompt

        # generatedTitle should be present in result
        assert result["generatedTitle"] == "How JWT Token Refresh Prevents Session Expiry"

    @pytest.mark.asyncio
    async def test_descriptive_title_skips_subtitle(self):
        """has_creator_title=False (descriptive title) does not request generatedTitle."""
        llm_output = json.dumps({
            "content": [{"type": "paragraph", "text": "Content about auth."}],
            "view": "standard",
        })
        service = self._make_service(llm_output)

        # Descriptive title → title_needs_subtitle returns False
        assert title_needs_subtitle("How JWT Authentication Works") is False

        result = await service.summarize_chapter(ChapterSummaryRequest(
            chapter_text="Transcript about JWT...",
            context=ChapterContext(title="How JWT Authentication Works", has_creator_title=False),  # What pipeline passes for descriptive titles
        ))

        # Prompt should NOT include subtitle instruction
        prompt = service._call_llm.call_args[0][0]
        assert "generatedTitle" not in prompt

        # generatedTitle should be None
        assert result["generatedTitle"] is None

    @pytest.mark.asyncio
    async def test_single_word_title_triggers_subtitle(self):
        """Single-word titles trigger generatedTitle generation."""
        assert title_needs_subtitle("Setup") is True

        llm_output = json.dumps({
            "content": [{"type": "paragraph", "text": "Setup steps."}],
            "view": "standard",
            "generatedTitle": "Setting Up Your Development Environment",
        })
        service = self._make_service(llm_output)

        result = await service.summarize_chapter(ChapterSummaryRequest(
            chapter_text="Transcript about setup...",
            context=ChapterContext(title="Setup", has_creator_title=True),
        ))

        assert result["generatedTitle"] == "Setting Up Your Development Environment"

    @pytest.mark.asyncio
    async def test_conclusion_triggers_subtitle(self):
        """'Conclusion' is detected as vague and triggers generatedTitle."""
        assert title_needs_subtitle("Conclusion") is True

        llm_output = json.dumps({
            "content": [{"type": "paragraph", "text": "Wrapping up."}],
            "view": "standard",
            "generatedTitle": "Key Takeaways and Next Steps for Implementation",
        })
        service = self._make_service(llm_output)

        result = await service.summarize_chapter(ChapterSummaryRequest(
            chapter_text="Transcript wrapping up...",
            context=ChapterContext(title="Conclusion", has_creator_title=True),
        ))

        assert result["generatedTitle"] == "Key Takeaways and Next Steps for Implementation"

    def test_build_chapter_dict_includes_generated_title(self):
        """build_chapter_dict() includes generated_title for creator chapters."""
        raw = {"title": "Intro", "startSeconds": 0, "endSeconds": 60}
        summary_data = {
            "content": [{"type": "paragraph", "text": "Hello"}],
            "view": "standard",
            "generatedTitle": "Why Video Summarization Matters",
        }

        chapter = build_chapter_dict(raw, summary_data, is_creator_chapter=True)

        assert chapter["generated_title"] == "Why Video Summarization Matters"
        assert chapter["original_title"] == "Intro"

    def test_build_chapter_dict_no_generated_title_for_ai_chapters(self):
        """build_chapter_dict() does not include generated_title for AI chapters."""
        raw = {"title": "AI Detected Chapter", "startSeconds": 0, "endSeconds": 60}
        summary_data = {
            "content": [{"type": "paragraph", "text": "Content"}],
            "view": "standard",
            "generatedTitle": "Some title",
        }

        chapter = build_chapter_dict(raw, summary_data, is_creator_chapter=False)

        assert "generated_title" not in chapter
        assert "original_title" not in chapter


# ─────────────────────────────────────────────────────────────────
# Integration: Cross-chapter state threading (V.2 + V.3 pipeline)
# ─────────────────────────────────────────────────────────────────


class TestCrossChapterStateThreading:
    """Integration tests for guest_names and prev_block_types threading
    through process_creator_chapters() and process_ai_chapters().

    These mock summarize_chapter() at the service level to test
    the state management logic in the pipeline functions.
    """

    @pytest.mark.asyncio
    async def test_guest_names_extracted_from_first_chapter(self):
        """process_creator_chapters() extracts guest names from first chapter's guest blocks."""
        from src.routes.stream import process_creator_chapters
        from src.services.youtube import Chapter, VideoData, SubtitleSegment

        # First chapter result has a guest block
        first_chapter_result = {
            "content": [
                {"type": "guest", "guests": [
                    {"name": "Lex Fridman", "role": "Host"},
                    {"name": "Elon Musk", "role": "Guest"},
                ]},
                {"type": "paragraph", "text": "Welcome to the podcast."},
            ],
            "view": "podcast",
        }

        # Mock video data with 3 chapters
        chapters = [
            Chapter(start_time=0, end_time=600, title="Welcome"),
            Chapter(start_time=600, end_time=1200, title="AI Discussion"),
            Chapter(start_time=1200, end_time=1800, title="Final Thoughts"),
        ]
        subtitles = [
            SubtitleSegment(text="Hello everyone", start=0, duration=5),
            SubtitleSegment(text="Welcome to the show", start=5, duration=5),
            SubtitleSegment(text="Let's talk about AI", start=600, duration=5),
            SubtitleSegment(text="AI is transformative", start=605, duration=5),
            SubtitleSegment(text="In conclusion", start=1200, duration=5),
            SubtitleSegment(text="Thanks for watching", start=1205, duration=5),
        ]
        video_data = VideoData(
            video_id="test123",
            title="Podcast Interview",
            channel="Test Channel",
            duration=1800,
            thumbnail_url=None,
            description="A podcast interview",
            chapters=chapters,
            subtitles=subtitles,
        )

        # Mock LLM service — capture summarize_chapter calls
        llm_service = MagicMock()
        llm_service.summarize_chapter = AsyncMock(return_value={
            "content": [{"type": "paragraph", "text": "Summary."}],
            "view": "podcast",
        })

        # Collect all yielded events (standalone accuracy functions fail gracefully with MagicMock provider)
        events = []
        from src.routes.stream import ChapterProcessingContext
        ctx = ChapterProcessingContext(
            llm_service=llm_service, persona="interview",
            normalized_segments=[], youtube_id="test123",
        )
        async for event in process_creator_chapters(
            ctx, video_data,
            first_chapter_result=first_chapter_result,
        ):
            events.append(event)

        # summarize_chapter should have been called for chapters 1 and 2
        calls = llm_service.summarize_chapter.call_args_list
        assert len(calls) >= 1

        # All calls should have guest_names=["Lex Fridman", "Elon Musk"] via ChapterSummaryRequest
        for call in calls:
            req = call.args[0]  # ChapterSummaryRequest
            assert req.accuracy.guest_names == ["Lex Fridman", "Elon Musk"]

    @pytest.mark.asyncio
    async def test_prev_block_types_tracked_across_batches(self):
        """process_creator_chapters() tracks prev_block_types across batch boundaries.

        Within a batch, all tasks are created with the same prev_block_types
        (from the previous batch's last chapter). The update only applies to
        the next batch. With CHAPTER_BATCH_SIZE=3, we need 4+ remaining chapters
        to test cross-batch behavior.
        """
        from src.routes.stream import process_creator_chapters, CHAPTER_BATCH_SIZE
        from src.services.youtube import Chapter, VideoData, SubtitleSegment

        first_chapter_result = {
            "content": [
                {"type": "paragraph", "text": "First."},
                {"type": "bullets", "items": ["a", "b"]},
                {"type": "callout", "style": "tip", "text": "tip"},
            ],
            "view": "standard",
        }

        # Create enough chapters to span 2 batches (batch_size + 1 remaining)
        num_remaining = CHAPTER_BATCH_SIZE + 1
        chapters = [Chapter(start_time=i * 300, end_time=(i + 1) * 300, title=f"Chapter {i}")
                     for i in range(num_remaining + 1)]  # +1 for first chapter
        subtitles = [SubtitleSegment(text=f"Content for ch{i}", start=i * 300, duration=5)
                     for i in range(num_remaining + 1)]
        video_data = VideoData(
            video_id="test456",
            title="Tutorial",
            channel="Test",
            duration=(num_remaining + 1) * 300,
            thumbnail_url=None,
            description="A tutorial",
            chapters=chapters,
            subtitles=subtitles,
        )

        # Last chapter in first batch returns distinctive block types
        last_batch1_result = {
            "content": [
                {"type": "definition", "term": "X", "meaning": "Y"},
                {"type": "statistic", "value": "42%", "label": "accuracy"},
            ],
            "view": "standard",
        }

        call_count = 0

        async def mock_summarize(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            # Last call in batch 1 returns distinctive types
            if call_count == CHAPTER_BATCH_SIZE:
                return last_batch1_result
            return {
                "content": [{"type": "paragraph", "text": "Generic."}],
                "view": "standard",
            }

        llm_service = MagicMock()
        llm_service.summarize_chapter = AsyncMock(side_effect=mock_summarize)

        from src.routes.stream import ChapterProcessingContext
        ctx = ChapterProcessingContext(
            llm_service=llm_service, persona="standard",
            normalized_segments=[],
        )
        events = []
        async for event in process_creator_chapters(
            ctx, video_data,
            first_chapter_result=first_chapter_result,
        ):
            events.append(event)

        calls = llm_service.summarize_chapter.call_args_list

        # All calls in batch 1 should get prev_block_types from chapter 0 (first_chapter_result)
        for i in range(min(CHAPTER_BATCH_SIZE, len(calls))):
            req = calls[i].args[0]  # ChapterSummaryRequest
            assert req.accuracy.prev_chapter_block_types == ["paragraph", "bullets", "callout"], \
                f"Batch 1, call {i}: expected chapter 0 types but got {req.accuracy.prev_chapter_block_types}"

        # First call in batch 2 should get prev_block_types from last chapter in batch 1
        if len(calls) > CHAPTER_BATCH_SIZE:
            req = calls[CHAPTER_BATCH_SIZE].args[0]
            assert req.accuracy.prev_chapter_block_types == ["definition", "statistic"], \
                f"Batch 2 should see types from batch 1's last chapter, got {req.accuracy.prev_chapter_block_types}"
