# Layout Engine Overhaul — Tasks

**Last Updated: 2026-02-24**

---

## Phase 1: Tighter Spacing [M] — COMPLETE
> Immediate visual impact, lowest risk

- [x] **1.1** Reduce spacing matrix in `block-layout.ts` — max gap from mt-5 to mt-3
- [x] **1.2** Reclassify spacing categories — move pro_con/cost/nutrition/guest/formula/rating from `visual` to `dense`, step/ingredient from `visual` to `list`
- [x] **1.3** Reduce card padding in `index.css` — `.block-card` from `p-5` to `px-4 py-3.5`
- [x] **1.4** Reduce section spacing in `ViewLayout.tsx` — `space-y-6` to `space-y-4`, `space-y-2` to `space-y-1.5`
- [x] **1.5** Reduce chapter divider spacing in `VideoDetailDesktop.tsx` — `my-8` to `my-6`
- [x] **1.6** Update spacing tests in `block-layout.test.ts`
- [x] **1.7** Visual verification on all 4 test video pages

---

## Phase 2: Content-Aware Block Sizing [M] — COMPLETE
> Foundation for smart layout. Can parallel with Phase 4.

- [x] **2.1** Create `apps/web/src/lib/content-weight.ts` with `ContentWeight` type and `measureBlock()` function
- [x] **2.2** Implement measurement rules for all 36+ block types
- [x] **2.3** Create `apps/web/src/hooks/use-block-measurements.ts` memoized hook
- [x] **2.4** Write tests: `apps/web/src/lib/__tests__/content-weight.test.ts` — cover all block types + edge cases

---

## Phase 3: Enhanced Auto-Flow Engine [L] — COMPLETE
> Core layout overhaul. Depends on Phase 2.

- [x] **3.1** Extend `FlowRow.type` in `auto-flow-layout.ts` with `equal-3`, `equal-4`, `aside-stack`
- [x] **3.2** Rewrite `computeAutoFlowLayout()` to accept optional `BlockMeasurement` map and apply content-aware pairing rules
- [x] **3.3** Extract `FlowRowRenderer` from `StandardView.tsx` to shared `FlowRowRenderer.tsx`
- [x] **3.4** Add rendering for `equal-3`, `equal-4`, `aside-stack` in `FlowRowRenderer`
- [x] **3.5** Update `StandardView` to use shared `FlowRowRenderer`
- [x] **3.6** Verify category views work with enhanced auto-flow on `other` buckets
- [x] **3.7** Update tests: `auto-flow-layout.test.ts` — new row types + content-aware paths
- [ ] **3.8** Write tests: `FlowRowRenderer.test.tsx` — rendering all 6 row types (deferred — component is thin wrapper, tested via integration)

---

## Phase 4: CSS Container Queries [S] — COMPLETE
> Adaptive columns. Can parallel with Phase 2.

- [x] **4.1** Add `content-container` class to chapters wrapper in `VideoDetailDesktop.tsx`
- [x] **4.2** Add container-query grid classes to `index.css`: `.flow-grid-equal-2`, `.flow-grid-equal-3`, `.flow-grid-equal-4`
- [x] **4.3** Wire `FlowRowRenderer` to use new grid classes instead of inline Tailwind
- [x] **4.4** Verify: right panel open = max 3 cols, minimized = max 4 cols
- [x] **4.5** Verify mobile fallback to single column

---

## Final Verification — COMPLETE

- [x] **V.1** Run all tests: 1165 tests pass across 56 files
- [x] **V.2** Visual comparison: Playwright screenshots across Cooking, Coding, Reviews categories
- [x] **V.3** Check responsive behavior: mobile (375px), tablet (768px), desktop (1280px), large desktop (1440px)
- [x] **V.4** Check dark mode rendering — all views verified in dark theme
- [x] **V.5** Performance: no measurable render time increase — useMemo hooks prevent unnecessary recalculation
