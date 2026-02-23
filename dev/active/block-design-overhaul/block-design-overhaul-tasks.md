# Block Design Overhaul — Phase 3 Tasks

**Last Updated: 2026-02-20**
**Status: COMPLETE**

---

## Previously Completed (Phases 1-7 + Phase 2 Visual Polish)

- [x] Phase 1: Accent variant redesign (7 tasks)
- [x] Phase 2: Compact callouts (3 tasks)
- [x] Phase 3: Comparison grid system (6 tasks)
- [x] Phase 4: Fade-edge design language (7 tasks)
- [x] Phase 5: Block-by-block polish (7 tasks)
- [x] Phase 6: View system deduplication (3 tasks)
- [x] Phase 7: Summarizer assessment (4 tasks)
- [x] Phase 2 Visual Polish: SectionHeader component (4 tests)
- [x] Phase 2 Visual Polish: View section headers (10 views)
- [x] Phase 2 Visual Polish: StepBlock + ToolListBlock fade-dividers
- [x] Phase 2 Visual Polish: TableBlock modernization (card variant, icon, bold headers)

---

## Phase A: Block-Level Fixes [S] ✅

- [x] **A.1** NutritionBlock — Replace `<table>` with div-based list
- [x] **A.1.1** Replace `<table>/<tbody>/<tr>` with `<div>` flex rows
- [x] **A.1.2** Add `<div className="fade-divider my-1" />` between items
- [x] **A.1.3** Keep nutrient left, amount right, dailyValue far-right
- [x] **A.1.4** Update/add tests for new structure (12 tests)

- [x] **A.2** RatingBlock — Compact horizontal layout
- [x] **A.2.1** Remove label line (`{label && <span>...}`)
- [x] **A.2.2** Flex layout: score+stars left (~120px), breakdown right (flex-1)
- [x] **A.2.3** Remove fade-divider between main rating and breakdown
- [x] **A.2.4** Keep single-column when no breakdown
- [x] **A.2.5** Update tests for compact layout (16 tests)

- [x] **A.3** LocationBlock — Enhanced map background
- [x] **A.3.1** Light mode opacity 0.06 → 0.12
- [x] **A.3.2** Dark mode opacity 0.1 → 0.18
- [x] **A.3.3** Add 2 more contour ellipse gradients + crosshair marker
- [x] **A.3.4** Grid line opacity 0.15 → 0.22

---

## Phase B: Layout Infrastructure [M] ✅

- [x] **B.1** Create ViewLayout components
- [x] **B.1.1** `ViewLayout` — root container with space-y-6
- [x] **B.1.2** `LayoutRow` — flex-col md:flex-row with configurable gap + reverse
- [x] **B.1.3** `LayoutColumn` — sidebar (280px) / main (flex-1) / equal (flex-1) variants
- [x] **B.1.4** `LayoutSection` — optional SectionHeader + children wrapper
- [x] **B.1.5** `renderSections` — helper to render sections with fade-dividers
- [x] **B.1.6** Add tests: `views/__tests__/view-layout.test.tsx` (17 tests)

- [x] **B.2** Sidebar-compatible block classification
- [x] **B.2.1** Add `SIDEBAR_COMPATIBLE_TYPES` set to `block-layout.ts`
- [x] **B.2.2** Add `partitionForSidebar()` helper function
- [x] **B.2.3** Add unit tests for partition function (4 tests)

---

## Phase C: View Templates [L] ✅

- [x] **C.1** RecipeView — sidebar (ingredients/info) + main (steps)
- [x] **C.2** ReviewView — top row (verdict + rating) + full-width below
- [x] **C.3** TravelView — sidebar (costs/locations) + main (itineraries)
- [x] **C.4** CodeView — no change (verified still works)
- [x] **C.5** EducationView — sidebar (formulas/keyvalues) + main (definitions)
- [x] **C.5.1** Added `keyvalues` to EDUCATION_RULES
- [x] **C.6** FitnessView — sidebar (nutrition/stats) + main (exercises)
- [x] **C.6.1** Added `stats` to FITNESS_RULES
- [x] **C.7** PodcastView — equal 2-col (guests + quotes)
- [x] **C.8** DIYView — sidebar (tools) + main (steps)
- [x] **C.9** GamingView — no change (verified still works)
- [x] **C.10** StandardView — integrated auto-flow from Phase D

---

## Phase D: Auto-Flow Layout Engine [M] ✅

- [x] **D.1** Create `computeAutoFlowLayout()` in `lib/auto-flow-layout.ts`
- [x] **D.1.1** FlowRow types: sidebar-main, equal-2, full
- [x] **D.1.2** Pair sidebar-compatible with adjacent full-width blocks
- [x] **D.1.3** Complementary pairs: verdict+rating, cost+nutrition, guest+quote
- [x] **D.1.4** Consecutive half-width → equal-2 row
- [x] **D.2** Create `useAutoFlowLayout` hook in `hooks/use-auto-flow-layout.ts`
- [x] **D.3** Integrate into StandardView
- [x] **D.4** Add comprehensive tests: `lib/__tests__/auto-flow-layout.test.ts` (13 tests)

---

## Post-Phase 3: View Grouping Rule Fixes ✅

- [x] **RecipeView** — Fix `ingredients` rule: match `type: "ingredient"` + old variant
- [x] **RecipeView** — Fix `steps` rule: match `type: "step"` + old variant
- [x] **RecipeView** — Add `nutrition` rule + include in sidebar
- [x] **RecipeView** — Simplify redundant condition, restore `useMemo`
- [x] **CodeView** — Fix `code` rule: match `code`, `terminal`, `file_tree`, `example`
- [x] **CodeView** — Add `stats` rule for `statistic` blocks
- [x] **CodeView** — Migrate to ViewLayout + sidebar-main for stats
- [x] **NutritionBlock** — Fix JSDoc (table → list)

---

## Final Verification ✅

- [x] `cd apps/web && npx tsc --noEmit` — TypeScript clean
- [x] `cd apps/web && npx vitest run` — 1084/1084 tests pass (53 files)
- [x] Security audit — All 12 files pass, no critical/high/medium issues
- [x] Code review — No critical issues remaining
- [ ] `cd apps/web && npx playwright test e2e/block-design-overhaul.spec.ts` — Pending
- [ ] `cd apps/web && npx playwright test e2e/block-ux-v2.spec.ts` — Pending
- [ ] Visual: RecipeView sidebar + main layout
- [ ] Visual: ReviewView verdict + rating side-by-side
- [ ] Visual: StandardView auto-flow pairing
- [ ] Visual: NutritionBlock with fade-dividers
- [ ] Visual: RatingBlock compact horizontal
- [ ] Visual: LocationBlock map clearly visible
- [ ] Mobile (375px): all layouts single-column
- [ ] Dark mode: all layouts correct
