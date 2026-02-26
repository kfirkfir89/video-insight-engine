# Block Output Quality V3 — Tasks

Last Updated: 2026-02-24 (session 2)

## Batch 1: Cross-Chapter State + Anti-Repetition [Critical] ✅

### 1.1 Quote Attribution Fix ✅
- [x] **1.1.1** Add `guest_names: list[str] | None = None` param to `summarize_chapter()` [S]
- [x] **1.1.2** Build `{guest_attribution}` prompt injection when guest_names present [S]
- [x] **1.1.3** Fix example attribution in chapter_summary.txt: "Expert Name" → "Andrej Karpathy" [S]
- [x] **1.1.4** Add `{guest_attribution}` placeholder to chapter_summary.txt after `{fact_sheet}` [S]
- [x] **1.1.5** Add SELF-CHECK item: "ATTRIBUTION: Every quote must use a real person's name" [S]
- [x] **1.1.6** Extract guest names from first chapter's `guest` blocks in `process_creator_chapters()` [M]
- [x] **1.1.7** Pass `guest_names` to all subsequent `summarize_chapter()` calls [S]
- [x] **1.1.8** Same guest name extraction + passing for `process_ai_chapters()` [M]

### 1.2 Post-Generation Block Diversity Enforcer ✅
- [x] **1.2.1** Add constants: `CALLOUT_MAX_PER_CHAPTER`, `COMPARISON_MAX_PER_CHAPTER`, `GENERIC_ATTRIBUTIONS` [S]
- [x] **1.2.2** Implement `_enforce_block_diversity(content, title, prev_block_types)` [M]
- [x] **1.2.3** Wire between content parsing and `inject_block_ids()` [S]
- [x] **1.2.4** Unit test: callout trimming [S]
- [x] **1.2.5** Unit test: generic attribution replacement [S]
- [x] **1.2.6** Unit test: cross-chapter callout ending prevention [S]

### 1.3 Cross-Chapter Diversity Prompt Injection ✅
- [x] **1.3.1** Add `prev_chapter_block_types: list[str] | None = None` param [S]
- [x] **1.3.2** Build `{diversity_instruction}` prompt injection [S]
- [x] **1.3.3** Add `{diversity_instruction}` placeholder to chapter_summary.txt [S]
- [x] **1.3.4** Track `prev_block_types` in `process_creator_chapters()` [M]
- [x] **1.3.5** Track `prev_block_types` in `process_ai_chapters()` [M]
- [x] **1.3.6** Pass `prev_block_types` to `summarize_chapter()` calls [S]

### 1.4 View Misassignment Fix ✅
- [x] **1.4.1** Add `VIEW_SIGNATURE_THRESHOLD` dict + `DEFAULT_THRESHOLD` constant [S]
- [x] **1.4.2** Update `_infer_view_from_blocks()` to use per-view thresholds [S]
- [x] **1.4.3** Add `category: str | None = None` param to `_resolve_view()` [S]
- [x] **1.4.4** Add `PERSONA_CATEGORY_MAP` dict [S]
- [x] **1.4.5** Implement category-aware fallback logic in `_resolve_view()` [M]
- [x] **1.4.6** Thread category from `summarize_chapter()` through to `_resolve_view()` [S]
- [x] **1.4.7** Unit test: podcast view with single `guest` block [S]
- [x] **1.4.8** Unit test: category fallback [S]

### 1.5 Prompt Anti-Repetition Rules ✅
- [x] **1.5.1** Add ANTI-REPETITION RULES section to chapter_summary.txt [S]
- [x] **1.5.2** Add callout style variety instruction [S]

## Batch 2: Visual Block Images [Medium] ✅

- [x] **2.1** Add `_populate_visual_images(content, youtube_id)` helper [S]
- [x] **2.2** Add `youtube_id` param to `build_chapter_dict()` [S]
- [x] **2.3** Thread `youtube_id` through both process functions [M]
- [x] **2.4** Unit test: visual blocks get imageUrl populated [S]

## Batch 3: Conditional generatedTitle [Low] ✅

- [x] **3.1** Add `_VAGUE_TITLE_RE` regex and `_title_needs_subtitle()` function [S]
- [x] **3.2** Replace `has_creator_title=True` in process_creator_chapters [S]
- [x] **3.3** Replace `has_creator_title=True` in process_ai_chapters [S]
- [x] **3.4** Unit test: `_title_needs_subtitle()` [S]

## Verification [Required] ✅

- [x] **V.1** Run existing tests — no regressions (520 pass, 14 pre-existing failures) [M]
- [x] **V.2** Integration test: Quote attributions use real names (4 tests) [L]
- [x] **V.3** Integration test: Max 1 callout per chapter, no consecutive same-ending (5 tests) [L]
- [x] **V.4** Integration test: Podcast video gets "podcast" views (4 tests) [M]
- [x] **V.5** Integration test: Visual blocks have `imageUrl` (4 tests) [M]
- [x] **V.6** Integration test: Conditional generatedTitle (6 tests) [M]
- [x] **V.7** Playwright layout audit: no overflow at all breakpoints [M]
- [x] **V.8** Playwright layout audit: dark/light mode correct [S]
- [x] **V.9** Playwright visual check: new blocks render properly [S]

---

## Extensions (done this session, beyond original V3 scope) ✅

### EXT.1 Persona Accuracy Rules ✅
- [x] **EXT.1.1** Add ACCURACY RULES to code.txt [S]
- [x] **EXT.1.2** Add ACCURACY RULES to education.txt [S]
- [x] **EXT.1.3** Add ACCURACY RULES to fitness.txt [S]
- [x] **EXT.1.4** Add ACCURACY RULES to interview.txt [S]
- [x] **EXT.1.5** Add ACCURACY RULES to music.txt [S]
- [x] **EXT.1.6** Add ACCURACY RULES to recipe.txt [S]
- [x] **EXT.1.7** Add ACCURACY RULES to review.txt [S]
- [x] **EXT.1.8** Add ACCURACY RULES to standard.txt [S]
- [x] **EXT.1.9** Add ACCURACY RULES to travel.txt [S]

### EXT.2 Frontend: New Block Types ✅
- [x] **EXT.2.1** Add `ProblemSolutionBlock` + `VisualBlock` types to `@vie/types` [S]
- [x] **EXT.2.2** Create `ProblemSolutionBlock.tsx` component [M]
- [x] **EXT.2.3** Create `VisualBlock.tsx` component [M]
- [x] **EXT.2.4** Register in `ContentBlockRenderer.tsx`, `blocks/index.ts` [S]
- [x] **EXT.2.5** Add labels in `block-labels.ts` [S]
- [x] **EXT.2.6** Add to `block-layout.ts` size + spacing maps [S]
- [x] **EXT.2.7** Add mock data in `mock-blocks.ts`, bump `BLOCK_TYPE_COUNT` to 34 [S]
- [x] **EXT.2.8** Unit test: `problem-solution-block.test.tsx` [S]
- [x] **EXT.2.9** Unit test: `visual-block.test.tsx` [S]
- [x] **EXT.2.10** Design system showcase entry in `BlockShowcase.tsx` [S]

### EXT.3 Enhanced Auto-Flow Layout Engine ✅
- [x] **EXT.3.1** Create `content-weight.ts` — weight classification system (micro/compact/standard/expanded) [L]
- [x] **EXT.3.2** Create `use-block-measurements.ts` hook [S]
- [x] **EXT.3.3** Add `FlowRowType` union with `equal-3`, `equal-4`, `aside-stack` [S]
- [x] **EXT.3.4** Enhance `computeAutoFlowLayout()` — content-aware rules, micro/compact runs [M]
- [x] **EXT.3.5** Update `useAutoFlowLayout()` to accept measurements param [S]
- [x] **EXT.3.6** Extract `FlowRowRenderer.tsx` from StandardView [M]
- [x] **EXT.3.7** Wire measurements in `StandardView.tsx` [S]
- [x] **EXT.3.8** Unit test: `content-weight.test.ts` [S]
- [x] **EXT.3.9** Update `auto-flow-layout.test.ts` for new algorithm [M]

### EXT.4 Spacing & Layout Tightening ✅
- [x] **EXT.4.1** Tighten spacing matrix ~40% in `block-layout.ts` [M]
- [x] **EXT.4.2** Reclassify blocks: step/ingredient → list, pro_con/cost/nutrition/guest/formula → dense [S]
- [x] **EXT.4.3** Card padding: `p-5` → `px-4 py-3.5` in `index.css` [S]
- [x] **EXT.4.4** Add container query flow grid system (`.flow-grid-equal-{2,3,4}`) [M]
- [x] **EXT.4.5** Chapter wrapper: `space-y-6` → `space-y-4`, add `content-container` [S]
- [x] **EXT.4.6** Chapter divider: `my-8` → `my-6` [S]
- [x] **EXT.4.7** Update `block-layout.test.ts` for new spacing values [S]

---

## Effort Legend
- **S** = Small (< 30 min)
- **M** = Medium (30-60 min)
- **L** = Large (1-2 hours)
