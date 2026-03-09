# Block Design Overhaul — Phase 3: Multi-Column Views & Layout Engine

**Last Updated: 2026-02-20**

---

## Executive Summary

The block design system has reached visual maturity (Phases 1-7: accent gradients, compact callouts, row-aligned grids, fade-edge system, view deduplication, section headers, table modernization — 1041 tests pass). However, **all 10 views render as single-column vertical stacks**, wasting horizontal space and making every chapter look identical regardless of content type. This phase introduces multi-column layouts, compact block fixes, and a smart auto-flow engine to create distinct, space-efficient view templates.

**Scope:** Pure frontend — layout components, view refactors, block fixes. No backend/summarizer changes required.

---

## Current State Analysis

### What's Working
- 33 block types with consistent fade-edge visual language
- 10 specialized views with `SectionHeader` + fade-dividers between sections
- `useGroupedBlocks` hook for clean block categorization
- `ContentBlocks` component with smart size-based grid layout (half=2-col, compact=3-col)
- `block-layout.ts` with BLOCK_SIZE_MAP (full/half/compact) and spacing matrix
- Per-chapter `view` field from summarizer + global `category`

### Problems
1. **Single-column monotony** — Every view stacks sections vertically. RecipeView's ingredients take full width when they could sit beside steps
2. **NutritionBlock inconsistency** — Uses `<table className="table-fade-dividers">` instead of div-based fade-divider pattern used by all other list blocks
3. **RatingBlock too spacious** — Label line, large score, then breakdown below a divider. Wastes vertical space when breakdown could sit beside the score
4. **LocationBlock map too faint** — Background pattern at 6% opacity (light) / 10% (dark) is barely visible
5. **No layout composition system** — Views can't express "sidebar + main" or "2-col top row" patterns

### Content Area Constraints
- Container: `max-w-[820px]` with `px-10` = ~640-760px usable width
- Sidebar: ~280px works well for data-dense blocks (ratings, nutrition, keyvalue, stats)
- Main: remaining ~360-480px for full-width content (steps, code, comparisons)
- Mobile: all layouts collapse to single-column via `flex-col` → `md:flex-row`

---

## Proposed Future State

### Layout Composition System
New `ViewLayout`, `LayoutRow`, `LayoutColumn`, `LayoutSection` primitives let views declare multi-column layouts declaratively. On mobile (< md breakpoint), everything collapses to single-column.

### View-Specific Templates
Each view gets a curated layout:
- **RecipeView**: Sidebar (ingredients/info) + Main (steps)
- **ReviewView**: Top row (verdict + rating side-by-side) + full-width proCons/comparisons
- **TravelView**: Sidebar (costs/locations) + Main (itineraries/routes)
- **EducationView**: Sidebar (formulas/keyvalues) + Main (definitions)
- **FitnessView**: Sidebar (nutrition/stats) + Main (exercises)
- **PodcastView**: Equal 2-col top (guests + quotes)
- **DIYView**: Sidebar (tools) + Main (steps)
- **CodeView/GamingView**: Stay single-column (content needs full width)

### Auto-Flow Engine
`StandardView` (and fallback) uses an algorithm to automatically pair sidebar-compatible blocks with full-width blocks, creating multi-column rows without manual templates.

---

## Implementation Phases

### Phase A: Block-Level Fixes [S] — Effort: S

**Goal:** Fix 3 specific block-level visual issues.

**A.1 — NutritionBlock: Table → Div-Based Fade-Dividers**
- File: `apps/web/src/components/video-detail/blocks/NutritionBlock.tsx`
- Replace `<table>/<tbody>/<tr>` with `<div>` flex rows
- Add `<div className="fade-divider my-1" />` between items
- Keep nutrient left, amount right, dailyValue far-right
- Keep `stagger-children` class
- Acceptance: NutritionBlock renders with fade-dividers between rows, same data layout

**A.2 — RatingBlock: Compact Horizontal Layout**
- File: `apps/web/src/components/video-detail/blocks/RatingBlock.tsx`
- Remove label line (`{label && <span>...}`)
- Horizontal layout: score+stars left (~120px), breakdown bars right (flex-1)
- Remove fade-divider between main rating and breakdown
- If no breakdown, keep current single-column
- Acceptance: Rating + breakdown render side-by-side, saving ~50% vertical space

**A.3 — LocationBlock: Enhanced Map Background**
- File: `apps/web/src/index.css` (`.location-map-bg`)
- Light: opacity 0.06 → 0.12, Dark: 0.1 → 0.18
- Add 2 more contour ellipse gradients (smaller + larger)
- Grid line opacity 0.15 → 0.22
- Acceptance: Map pattern clearly visible in both light and dark modes

**Dependencies:** None
**Tests:** Update nutrition-block, rating-block tests; no new test files

---

### Phase B: Layout Infrastructure [M] — Effort: M

**Goal:** Create reusable layout primitives for multi-column views.

**B.1 — ViewLayout Components**
- New file: `apps/web/src/components/video-detail/views/ViewLayout.tsx`
- `ViewLayout` — root container with `space-y-6` + auto fade-dividers between children
- `LayoutRow` — `flex flex-col md:flex-row {gap}` for horizontal multi-column
- `LayoutColumn` — width variants: `sidebar` (md:w-[280px] shrink-0), `main` (flex-1 min-w-0), `equal` (flex-1)
- `LayoutSection` — optional SectionHeader + children wrapper
- Acceptance: Components render correctly, mobile collapses to single-column

**B.2 — Sidebar-Compatible Classification**
- File: `apps/web/src/lib/block-layout.ts`
- Add `SIDEBAR_COMPATIBLE_TYPES: Set<ContentBlockType>` (rating, nutrition, cost, keyvalue, statistic, ingredient, tool_list, guest, timestamp, formula)
- Add `partitionForSidebar(blocks): { sidebar, main }` helper
- Acceptance: Function correctly partitions blocks; existing tests pass

**Dependencies:** None
**Tests:** New `views/__tests__/view-layout.test.tsx` for layout components

---

### Phase C: View Templates [L] — Effort: L

**Goal:** Refactor 7 views to use multi-column layouts. CodeView and GamingView stay single-column.

Each view keeps its existing `useGroupedBlocks` rules — only the composition changes.

**C.1 — RecipeView: Sidebar + Main**
- Sidebar: recipeInfo + ingredients
- Main: steps (+ other)
- Below: tips, timestamps full-width

**C.2 — ReviewView: Top Row + Full Width**
- Top row: verdict (main) + rating (sidebar)
- Below: proCons, comparisons, other, timestamps

**C.3 — TravelView: Sidebar + Main**
- Sidebar: costs + locations (new rule)
- Main: itineraries + routes
- Below: tips, other, timestamps
- Add `locations` to TRAVEL_RULES

**C.4 — CodeView: No Change**

**C.5 — EducationView: Sidebar + Main**
- Sidebar: formulas + keyvalues (new rule)
- Main: definitions
- Below: questions, other, timestamps

**C.6 — FitnessView: Sidebar + Main**
- Sidebar: nutrition + stats (new rule)
- Main: exercises
- Below: timers, other, timestamps

**C.7 — PodcastView: Equal 2-Col Top**
- Top row: guests (equal) + quotes (equal)
- Below: topics, other, timestamps

**C.8 — DIYView: Sidebar + Main**
- Sidebar: tools
- Main: steps (+ other)
- Below: tips, timestamps

**C.9 — GamingView: No Change**

**C.10 — StandardView: Auto-Flow (Phase D)**

**Dependencies:** Phase B (layout components)
**Tests:** Existing view tests should still pass; add layout-specific assertions

---

### Phase D: Auto-Flow Layout Engine [M] — Effort: M

**Goal:** Smart automatic layout for StandardView and fallback.

**D.1 — Auto-Flow Algorithm**
- New file: `apps/web/src/lib/auto-flow-layout.ts`
- `computeAutoFlowLayout(blocks): FlowRow[]`
- FlowRow types: `sidebar-main`, `equal-2`, `full`
- Pairs sidebar-compatible blocks with adjacent full-width blocks
- Complementary pairs prioritized: verdict+rating, cost+nutrition, guest+quote
- Consecutive half-width blocks → equal-2 row

**D.2 — StandardView Integration**
- Update `StandardView` to use auto-flow for `other` group
- Use `ViewLayout` + `LayoutRow`/`LayoutColumn` to render FlowRows

**D.3 — Auto-Flow Hook**
- New file: `apps/web/src/hooks/use-auto-flow-layout.ts`
- Memoized wrapper: `useAutoFlowLayout(blocks): FlowRow[]`

**Dependencies:** Phase B (layout components), Phase C (tested view pattern)
**Tests:** New `lib/__tests__/auto-flow-layout.test.ts` with comprehensive algorithm tests

---

## Execution Order & Dependencies

```
Phase A (Block Fixes) ──→ independent, do first

Phase B (Infrastructure) ──→ Phase C (View Templates) ──→ Phase D (Auto-Flow)
```

| Priority | Phase | Effort | Depends On |
|----------|-------|--------|-----------|
| 1 | Phase A: Block Fixes | S | None |
| 2 | Phase B: Layout Infrastructure | M | None |
| 3 | Phase C: View Templates | L | Phase B |
| 4 | Phase D: Auto-Flow Engine | M | Phase B, C |

Phases A and B can run in parallel.

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Multi-column breaks at edge widths | Medium | Medium | Test at 640px, 768px, 1024px; ensure flex-col fallback |
| Sidebar content overflows 280px | Medium | High | Test nutrition/rating/keyvalue blocks at 280px; use min-w-0 |
| Auto-flow creates awkward pairings | Low | Medium | Conservative algorithm; fall back to full-width for ambiguous cases |
| Existing view tests break | Medium | Low | Views keep same block grouping; only composition changes |
| NutritionBlock layout shift | Low | Low | Match existing spacing/alignment exactly |
| Mobile stacking order wrong | Low | Medium | Use `reverse` prop on LayoutRow when sidebar should come after on mobile |

---

## Success Metrics

- [ ] `cd apps/web && npx tsc --noEmit` passes
- [ ] `cd apps/web && npm test` — all unit tests pass (existing + new)
- [ ] Playwright e2e — block-design-overhaul (24) + block-ux-v2 (12) still pass
- [ ] RecipeView: ingredients sidebar + steps main (visual check)
- [ ] ReviewView: verdict + rating side-by-side (visual check)
- [ ] StandardView: auto-flow pairs sidebar-compatible blocks (visual check)
- [ ] NutritionBlock: div-based with fade-dividers (visual check)
- [ ] RatingBlock: compact horizontal layout (visual check)
- [ ] LocationBlock: map pattern clearly visible (visual check)
- [ ] Mobile (375px): all layouts collapse to single column
- [ ] Dark mode: all new layouts render correctly

---

## Key Files Reference

| File | Role |
|------|------|
| `apps/web/src/lib/block-layout.ts` | Block size classification, spacing matrix |
| `apps/web/src/hooks/use-grouped-blocks.ts` | Block grouping hook used by all views |
| `apps/web/src/components/video-detail/ContentBlocks.tsx` | Block renderer with grid layout |
| `apps/web/src/components/video-detail/views/SectionHeader.tsx` | Reusable section header |
| `apps/web/src/components/video-detail/ArticleSection.tsx` | View selection (chapter.view ?? category) |
| `apps/web/src/components/video-detail/blocks/VerdictBlock.tsx` | Reference: fade-divider + bullet pattern |
| `apps/web/src/index.css` | All custom CSS (fade-divider, location-map-bg, etc.) |
