# Block Design System Overhaul — Tasks

**Last Updated: 2026-02-20**
**Status: ALL COMPLETE**

---

## Phase 1: Accent Variant Redesign — Kill the Left Border [M]

- [x] **1.1** Redesign `.block-accent` in `index.css`
- [x] **1.2** Add `.block-accent::before` pseudo-element in `index.css`
- [x] **1.3** Add dark mode rule for `.block-accent::before`
- [x] **1.4** Replace `accentColorClasses` → `accentColorStyles` in `BlockWrapper.tsx`
- [x] **1.5** Verify accent consumers render correctly
- [x] **1.6** TypeScript check passes

---

## Phase 2: Compact Callouts [S]

- [x] **2.1** Reduce CalloutBlock sizing (icons h-3.5, text-xs, gap-1.5, no animate-breathe)
- [x] **2.2** Reduce callout gradient opacity ~40% in index.css
- [x] **2.3** Visual verify: callouts are smaller, less attention-grabbing

---

## Phase 3: Comparison Grid System [L]

- [x] **3.1** CSS grid approach (inline, no separate utility class needed)
- [x] **3.2** Refactor `ComparisonRenderer.tsx` to row-aligned grid
- [x] **3.3** Refactor `ProConBlock.tsx` to row-aligned grid
- [x] **3.4** Refactor `DosDontsBlock.tsx` to row-aligned grid
- [x] **3.5** Update `VerdictBlock.tsx` bestFor/notFor
- [x] **3.6** TypeScript check + visual verify

---

## Phase 4: Fade-Edge Design Language [M]

- [x] **4.1** BulletsBlock — already had fade-dividers (no change needed)
- [x] **4.2** NumberedBlock — added fade-dividers between items
- [x] **4.3** KeyValueRenderer — already had fade-dividers (no change needed)
- [x] **4.4** RatingBlock — added fade-dividers between categories
- [x] **4.5** GuestBlock — already had fade-dividers (no change needed)
- [x] **4.6** `.block-card::before` — 1px subtle top fade line at 15%-85% width
- [x] **4.7** Dark mode opacity: `.fade-divider` and `.fade-divider-vertical` → 0.4

---

## Phase 5: Block-by-Block Polish [M]

- [x] **5.1** QuoteRenderer → `variant="transparent"`, removed accentColor
- [x] **5.2** DefinitionBlock → `variant="card"`, added `text-primary` to term
- [x] **5.3** ExampleBlock — verified (already uses card, no changes needed)
- [x] **5.4** RatingBlock — fade dividers done in 4.4
- [x] **5.5** GuestBlock — already had dividers (no change needed)
- [x] **5.6** StatisticRenderer — verified, no changes needed
- [x] **5.7** TimestampRenderer — verified, no changes needed

---

## Phase 6: View System Deduplication [S]

- [x] **6.1** Created `useGroupedBlocks` hook in `apps/web/src/hooks/use-grouped-blocks.ts`
- [x] **6.2** Updated 9 views: CodeView, RecipeView, TravelView, ReviewView, FitnessView, EducationView, PodcastView, DIYView, GamingView
- [x] **6.3** All views render correctly (verified via tests)

---

## Phase 7: Summarizer Assessment [S]

- [x] **7.1** Confirmed: 33 block types map to visual system — no new types needed
- [x] **7.2** Confirmed: Changes are frontend-only — no summarizer modifications
- [x] **7.3** Confirmed: Comparison variants unchanged
- [x] **7.4** Confirmed: Callout styles unchanged

---

## Final Verification

- [x] `cd apps/web && npx tsc --noEmit` passes
- [x] `cd apps/web && npm run build` succeeds
- [x] `cd apps/web && npm test` — 1037/1037 tests pass (49 files)
- [x] Playwright e2e — 24/24 new block-design-overhaul tests pass
- [x] Playwright e2e — 12/12 existing block-ux-v2 tests pass
- [x] Visual: No left borders anywhere (accent uses top gradient)
- [x] Visual: Callouts are compact
- [x] Visual: Comparison blocks align rows (row-aligned grid)
- [x] Visual: Fade-edge lines consistent across all blocks
- [x] Visual: Dark mode correct
- [x] Visual: Mobile responsive correct (375px, 768px, 1280px)
- [x] Visual: No horizontal overflow at any viewport

---

## Remaining: Commit Changes

All changes are uncommitted. Ready for `git commit`.
