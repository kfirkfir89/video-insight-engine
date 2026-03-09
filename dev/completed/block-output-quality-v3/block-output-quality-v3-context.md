# Block Output Quality V3 — Context

Last Updated: 2026-02-24 (session 2)

## Status: FULLY COMPLETE + EXTENSIONS DONE (UNCOMMITTED)

All 3 V3 batches implemented and verified. Additionally, this session extended the work with:
- Persona accuracy rules for all 9 personas
- New block types (ProblemSolution, Visual) on frontend
- Enhanced auto-flow layout engine with content-weight system
- Spacing matrix tightening (~40% reduction)
- FlowRowRenderer extraction from StandardView
- Container query adaptive grid system (CSS)

**All changes are uncommitted on branch `dev-0`**, on top of commit `ed62051`.

## Relationship to Previous Task

- **block-output-quality (V1/V2)**: Addressed accuracy/fidelity — term renaming, list completeness, timestamp accuracy, callout quality gates, fact extraction pipeline.
- **block-output-quality-v3 (this task)**: Addresses structural quality — cross-chapter state, anti-repetition, view misassignment, quote attribution, visual images, conditional generatedTitle.
- **Extensions (this session)**: Persona-specific accuracy rules, new frontend block types, layout engine enhancements.

## What Was Implemented

### Batch 1: Cross-Chapter State + Anti-Repetition
1. **Quote Attribution Fix** — Guest names extracted from `guest` blocks in first chapter, passed to all subsequent `summarize_chapter()` calls. `{guest_attribution}` prompt injection when guest names present. Fixed example "Expert Name" → "Andrej Karpathy".
2. **Block Diversity Enforcer** — `_enforce_block_diversity()` post-generation function: trims excess callouts (max 1), trims excess comparisons (max 1), prevents cross-chapter same-ending, replaces generic attributions ("Expert Name", "Speaker", etc.) with `highlight` variant.
3. **Cross-Chapter Diversity Prompt** — `{diversity_instruction}` injected when `prev_chapter_block_types` present, telling LLM to avoid ending with same block type.
4. **View Misassignment Fix** — Per-view signature thresholds (podcast=1, others=2), category-aware fallback in `_resolve_view()` using `PERSONA_CATEGORY_MAP`.
5. **Anti-Repetition Rules** — New section in chapter_summary.txt with rules for callout limits, comparison limits, block variety.

### Batch 2: Visual Block Images
- `_populate_visual_images()` helper populates `imageUrl` on visual blocks with YouTube thumbnail URL.
- Threaded `youtube_id` through pipeline to `build_chapter_dict()`.

### Batch 3: Conditional generatedTitle
- `_title_needs_subtitle()` detects vague titles ("Intro", "Part 1", "Conclusion", etc.) and short titles (< 4 words).
- `has_creator_title` now conditionally set based on title vagueness instead of always `True`.

### Extension: Persona Accuracy Rules (NEW this session)
Added `ACCURACY RULES ({persona}):` section to all 9 persona prompts:
- **code.txt** — Exact variable/function names, version numbers, package names, error messages
- **education.txt** — Teaching progression, analogies, exact terminology, complete enumerations
- **fitness.txt** — Exact exercise names, sets/reps/rest, form cues, modifications, tempo
- **interview.txt** — Speaker attribution, verbatim quotes, guest credentials, conversational dynamics
- **music.txt** — Accurate lyrics, credits, specific genre, production details, chart positions
- **recipe.txt** — Every ingredient with exact measurement, temperatures, timing, step order
- **review.txt** — All specs with numbers, pros AND cons, exact prices/ratings/scores, verdict preservation
- **standard.txt** — All key arguments, specific examples, exact numbers/names/dates
- **travel.txt** — Exact location names, prices with currency, hours, transportation details

### Extension: New Frontend Block Types (NEW this session)
- **`ProblemSolutionBlock.tsx`** — Renders problem/solution pairs with optional context
- **`VisualBlock.tsx`** — Renders visual moment descriptions with optional image, variant badge, timestamp link
- **`ProblemSolutionBlock` + `VisualBlock` types** added to `@vie/types` (packages/types/src/index.ts)
- Registered in `ContentBlockRenderer.tsx`, `blocks/index.ts`, `block-labels.ts`, `block-layout.ts`, `mock-blocks.ts`
- Unit tests: `problem-solution-block.test.tsx`, `visual-block.test.tsx`
- `BLOCK_TYPE_COUNT` bumped from 32 → 34

### Extension: Enhanced Auto-Flow Layout Engine (NEW this session)
- **`content-weight.ts`** (new, 261 lines) — Content weight system: classifies blocks as `micro`, `compact`, `standard`, or `expanded` based on content size. Type-based fallback weights. `getTypeFallbackWeight()` function.
- **`use-block-measurements.ts`** (new, 12 lines) — Hook that returns a `Map<ContentBlock, BlockMeasurement>` for content-aware layout
- **`FlowRowRenderer.tsx`** (new, 94 lines) — Extracted from StandardView. Handles `full`, `sidebar-main`, `equal-2`, `equal-3`, `equal-4`, `aside-stack` row types
- **`auto-flow-layout.ts`** (enhanced) — New `FlowRowType` union with `equal-3`, `equal-4`, `aside-stack`. Algorithm enhanced: expanded → full, micro runs → equal-4, compact runs → equal-3. Accepts optional `measurements` param.
- **`use-auto-flow-layout.ts`** (enhanced) — Accepts optional `measurements` param, passes to engine.
- **`StandardView.tsx`** (refactored) — FlowRowRenderer extracted, uses `useBlockMeasurements()`, tighter spacing (`space-y-4`)

### Extension: Spacing & Layout Tightening (NEW this session)
- **`block-layout.ts`** — Spacing matrix tightened ~40% (e.g., `mt-5` → `mt-3`, `mt-3` → `mt-2`). Reclassified blocks: `step`/`ingredient` → list, `pro_con`/`cost`/`nutrition`/`guest`/`formula` → dense. Added `problem_solution`/`visual` to size and spacing maps.
- **`index.css`** — Block card padding tightened (`p-5` → `px-4 py-3.5`). Added flow grid system with container queries: `.content-container`, `.flow-grid-equal-2`, `.flow-grid-equal-3`, `.flow-grid-equal-4` with progressive breakpoints.
- **`VideoDetailDesktop.tsx`** — Chapter wrapper: `space-y-6` → `space-y-4`, added `content-container` class. Chapter divider: `my-8` → `my-6`.

## Files Modified (all uncommitted)

### Backend (Summarizer)
| File | Changes |
|------|---------|
| `services/summarizer/src/services/llm.py` | V3 constants, `_enforce_block_diversity()`, `_title_needs_subtitle()`, view resolution updates |
| `services/summarizer/src/routes/stream.py` | `_populate_visual_images()`, cross-chapter state threading, `youtube_id` wiring |
| `services/summarizer/src/prompts/chapter_summary.txt` | Attribution fix, anti-repetition rules, diversity/guest placeholders |
| `services/summarizer/src/prompts/personas/*.txt` (9 files) | ACCURACY RULES section added to all personas |

### Frontend (Web)
| File | Changes |
|------|---------|
| `packages/types/src/index.ts` | `ProblemSolutionBlock`, `VisualBlock` interfaces + union |
| `apps/web/src/components/video-detail/ContentBlockRenderer.tsx` | Added `problem_solution`, `visual` cases |
| `apps/web/src/components/video-detail/VideoDetailDesktop.tsx` | `content-container`, tighter spacing |
| `apps/web/src/components/video-detail/views/StandardView.tsx` | FlowRowRenderer extraction, measurements |
| `apps/web/src/components/video-detail/views/ViewLayout.tsx` | Minor update |
| `apps/web/src/components/video-detail/blocks/index.ts` | New block exports |
| `apps/web/src/hooks/use-auto-flow-layout.ts` | Measurements param |
| `apps/web/src/index.css` | Card padding, flow grid system |
| `apps/web/src/lib/auto-flow-layout.ts` | Enhanced algorithm with content weights |
| `apps/web/src/lib/block-labels.ts` | Labels for new blocks |
| `apps/web/src/lib/block-layout.ts` | Spacing tightening, new block entries |
| `apps/web/src/lib/dev/mock-blocks.ts` | Sample data for new blocks |
| `apps/web/src/lib/dev/__tests__/mock-blocks.test.ts` | Updated block count |
| `apps/web/src/lib/__tests__/auto-flow-layout.test.ts` | Updated tests for new algorithm |
| `apps/web/src/lib/__tests__/block-layout.test.ts` | Updated tests for new spacing values |

### E2E Tests (Updated)
| File | Changes |
|------|---------|
| `apps/web/e2e/design-system-visual.spec.ts` | Minor updates |
| `apps/web/e2e/explainer-v2.spec.ts` | Updated assertions |
| `apps/web/e2e/fixtures.ts` | Updated fixture |
| `apps/web/e2e/per-chapter-views.spec.ts` | Updated assertions |
| `apps/web/e2e/right-panel-layout-audit.spec.ts` | Updated assertions |
| `apps/web/e2e/sidebar-header-redesign.spec.ts` | Updated assertions |
| `apps/web/e2e/video-detail-ux.spec.ts` | Updated assertions |
| `apps/web/e2e/video-playback.spec.ts` | Updated assertions |

## Files Created (all new, untracked)

| File | Purpose |
|------|---------|
| `services/summarizer/tests/test_block_quality_v3.py` | 52 unit tests + 25 integration tests (1044 lines) |
| `services/summarizer/src/prompts/chapter_facts.txt` | Fact extraction prompt (from V1/V2) |
| `services/summarizer/src/prompts/chapter_validate.txt` | Validation prompt (from V1/V2) |
| `apps/web/src/components/video-detail/FlowRowRenderer.tsx` | Extracted row renderer (94 lines) |
| `apps/web/src/components/video-detail/blocks/ProblemSolutionBlock.tsx` | Problem/Solution block component |
| `apps/web/src/components/video-detail/blocks/VisualBlock.tsx` | Visual moment block component |
| `apps/web/src/components/video-detail/blocks/__tests__/problem-solution-block.test.tsx` | Tests |
| `apps/web/src/components/video-detail/blocks/__tests__/visual-block.test.tsx` | Tests |
| `apps/web/src/hooks/use-block-measurements.ts` | Content-aware measurement hook |
| `apps/web/src/lib/content-weight.ts` | Content weight classification system (261 lines) |
| `apps/web/src/lib/__tests__/content-weight.test.ts` | Tests |

## Test Results

- **77 V3 tests**: All passing (52 unit + 25 integration)
- **545 existing tests**: All passing
- **14 pre-existing failures**: Legacy `sections` → `chapters` rename (not related to V3)
- **Playwright audit**: No layout issues at 1440px, 1024px, 768px, 375px; dark/light mode correct

## Key Decisions Made This Session

1. **Persona accuracy rules as prompt additions, not code changes** — Simpler, directly guides LLM behavior. Each persona gets domain-specific accuracy instructions (e.g., recipe must preserve exact measurements).
2. **Content weight system for layout** — Instead of just type-based sizing, blocks can be classified by actual content weight (micro/compact/standard/expanded). Enables smarter multi-column layouts.
3. **Container queries for flow grids** — CSS container queries (not viewport media queries) so grid columns adapt to the content panel width, working correctly regardless of sidebar state.
4. **Spacing tightening ~40%** — Original spacing was too generous, causing content to feel sparse. Tighter spacing creates a more editorial/magazine feel. Dense blocks (callout, quote, statistic) got even tighter spacing.
5. **FlowRowRenderer extraction** — Moved from StandardView to standalone component for reuse by other views (cooking, podcast, etc.).

## Blockers / Issues

None. All work is complete and tested.

## Next Steps

1. **Commit all changes** — Large commit spanning summarizer + web + types. Consider splitting into:
   - Commit 1: V3 backend (summarizer prompts + llm.py + stream.py + tests)
   - Commit 2: Frontend new blocks + layout engine + spacing
   - Or: single commit if preferred
2. **Test with real videos** — Run actual summarization on podcast, cooking, review, and coding videos to verify quality improvements end-to-end
3. **Consider task closure** — V3 task is complete. Extensions could be tracked under `layout-engine-overhaul` or closed as part of V3.
