# Block Design System Overhaul — Context

**Last Updated: 2026-02-20**
**Status: ALL PHASES COMPLETE**

---

## Summary

All 7 phases of the block design overhaul are complete. All unit tests (1037/1037) and Playwright e2e tests (24/24 new + 12/12 existing block-ux-v2) pass. Build and TypeScript checks are clean.

---

## Critical Files Modified

### Core Infrastructure

| File | Path | Changes Made |
|------|------|-------------|
| BlockWrapper | `apps/web/src/components/video-detail/blocks/BlockWrapper.tsx` | Replaced `accentColorClasses` (border-l-*) with `accentColorStyles` (CSS custom property `--accent-line-color` via style objects) |
| index.css | `apps/web/src/index.css` | `.block-accent`: removed left border, added `position: relative` + `::before` gradient line. `.block-card::before`: subtle 1px top fade line. Callout gradient opacities reduced ~40%. Dark mode rules for fade-divider/fade-divider-vertical opacity 0.3→0.4 |

### Phase 1-2: Accent + Callouts

| File | Path | Changes |
|------|------|---------|
| CalloutBlock | `apps/web/src/components/video-detail/blocks/CalloutBlock.tsx` | Icons h-4→h-3.5, text-sm→text-xs, gap-2→gap-1.5, removed animate-breathe |

### Phase 3: Comparison Grid (Row-Aligned)

| File | Path | Changes |
|------|------|---------|
| ComparisonRenderer | `apps/web/src/components/video-detail/blocks/ComparisonRenderer.tsx` | Rewritten: row-by-row rendering with `maxRows = Math.max(left, right)`, vertical center divider, fade-dividers between rows |
| ProConBlock | `apps/web/src/components/video-detail/blocks/ProConBlock.tsx` | Rewritten: row-aligned grid when both exist, single-column `<ul>` fallback when only one side |
| DosDontsBlock | `apps/web/src/components/video-detail/blocks/DosDontsBlock.tsx` | Rewritten: row-aligned grid with responsive columns, single-column fallback |
| VerdictBlock | `apps/web/src/components/video-detail/blocks/VerdictBlock.tsx` | bestFor/notFor section uses row-aligned grid with vertical divider |

### Phase 4: Fade-Edge Design Language

| File | Path | Changes |
|------|------|---------|
| NumberedBlock | `apps/web/src/components/video-detail/blocks/NumberedBlock.tsx` | Added fade-dividers between items (space-y-2→space-y-0 + dividers) |
| RatingBlock | `apps/web/src/components/video-detail/blocks/RatingBlock.tsx` | Added fade-dividers between breakdown categories |
| BulletsBlock | Already had fade-dividers | No changes needed |
| KeyValueRenderer | Already had fade-dividers | No changes needed |
| GuestBlock | Already had fade-dividers | No changes needed |

### Phase 5: Block Polish

| File | Path | Changes |
|------|------|---------|
| QuoteRenderer | `apps/web/src/components/video-detail/blocks/QuoteRenderer.tsx` | `variant="accent"` → `variant="transparent"`, removed `accentColor="info"` |
| DefinitionBlock | `apps/web/src/components/video-detail/blocks/DefinitionBlock.tsx` | `variant="accent"` → `variant="card"`, removed `accentColor="primary"`, added `text-primary` to term |

### Phase 6: View Deduplication

| File | Path | Changes |
|------|------|---------|
| use-grouped-blocks | `apps/web/src/hooks/use-grouped-blocks.ts` | **NEW** — `useGroupedBlocks(blocks, rules)` hook with `BlockGroupRule` interface |
| 9 View files | `apps/web/src/components/video-detail/views/*.tsx` | CodeView, RecipeView, TravelView, ReviewView, FitnessView, EducationView, PodcastView, DIYView, GamingView — replaced inline useMemo with hook |

### Tests Modified

| File | Path | Changes |
|------|------|---------|
| pro-con-block.test.tsx | `apps/web/src/.../blocks/__tests__/pro-con-block.test.tsx` | Updated: grid structure tests replace old `<ul>` role=list assertions; single-column fallback keeps list semantics |
| dos-donts-block.test.tsx | `apps/web/src/.../blocks/__tests__/dos-donts-block.test.tsx` | Updated: grid structure tests replace old `<ul>` role=list assertions; fixed duplicate "Don't" header issue |
| block-design-overhaul.spec.ts | `apps/web/e2e/block-design-overhaul.spec.ts` | **NEW** — 24 Playwright tests covering all phases + layout/overflow/responsivity/dark mode |

---

## Key Design Decisions

### Decision 1: CSS Custom Property for Accent Color
**Chosen:** CSS custom property `--accent-line-color` set via `style` prop
**Reason:** Pseudo-elements can't read Tailwind classes; CSS variables work cleanly with `::before`

### Decision 2: Top Fade-Edge Instead of Left Border
**Chosen:** 2px gradient line at top of accent blocks via `::before`
**Reason:** Matches existing fade-divider language; top position doesn't compete with content reading flow

### Decision 3: Row-Aligned Comparison Grid
**Chosen:** `maxRows = Math.max(left, right)`, render empty cells for shorter column
**Reason:** Visual row alignment across columns creates a proper table-like reading experience

### Decision 4: Quote → Transparent, Definition → Card
**Reason:** Quote has `.quote-decorative-mark` (accent border was redundant). Definition is standalone knowledge unit (card gives containment).

### Decision 5: Dual-column grid loses `<ul>` semantics
**Chosen:** Row-aligned `<div>` grid in dual-column mode, `<ul>` preserved in single-column fallback
**Reason:** Interleaving left/right items per row makes it impossible to wrap in two separate `<ul>`. Accessibility is maintained via visible column headers and aria-hidden decorative elements. Tests updated to match.

### Decision 6: DosDontsBlock — Always-visible column headers
**Chosen:** Both "Do" and "Don't" headers always visible (removed `hidden sm:flex`)
**Reason:** Eliminates duplicate mobile-only header that caused test failures and simplified the DOM

---

## Test Results (Final)

| Suite | Result |
|-------|--------|
| TypeScript (`tsc --noEmit`) | Clean |
| Build (`vite build`) | Clean |
| Unit tests (Vitest) | 1037/1037 passed (49 files) |
| Playwright — block-design-overhaul.spec.ts | 24/24 passed |
| Playwright — block-ux-v2.spec.ts | 12/12 passed |
| Playwright — design-system-visual.spec.ts | 18/21 passed (3 pre-existing failures) |

### Pre-existing Playwright Failures (NOT caused by overhaul)
- `light mode has cool undertone (hue ~250)` — theme hue is 285, not 250
- `dark mode has warm undertone (hue ~55)` — theme hue is 280, not 55
- `responsive: block cards adapt to viewport width` — test uses `.rounded-lg.border.bg-card` selector instead of `.block-card`

---

## Uncommitted Changes

All changes are uncommitted. Files to commit:
- `apps/web/src/index.css`
- `apps/web/src/components/video-detail/blocks/BlockWrapper.tsx`
- `apps/web/src/components/video-detail/blocks/CalloutBlock.tsx`
- `apps/web/src/components/video-detail/blocks/ComparisonRenderer.tsx`
- `apps/web/src/components/video-detail/blocks/ProConBlock.tsx`
- `apps/web/src/components/video-detail/blocks/DosDontsBlock.tsx`
- `apps/web/src/components/video-detail/blocks/VerdictBlock.tsx`
- `apps/web/src/components/video-detail/blocks/NumberedBlock.tsx`
- `apps/web/src/components/video-detail/blocks/RatingBlock.tsx`
- `apps/web/src/components/video-detail/blocks/QuoteRenderer.tsx`
- `apps/web/src/components/video-detail/blocks/DefinitionBlock.tsx`
- `apps/web/src/hooks/use-grouped-blocks.ts` (NEW)
- `apps/web/src/components/video-detail/views/CodeView.tsx`
- `apps/web/src/components/video-detail/views/RecipeView.tsx`
- `apps/web/src/components/video-detail/views/TravelView.tsx`
- `apps/web/src/components/video-detail/views/ReviewView.tsx`
- `apps/web/src/components/video-detail/views/FitnessView.tsx`
- `apps/web/src/components/video-detail/views/EducationView.tsx`
- `apps/web/src/components/video-detail/views/PodcastView.tsx`
- `apps/web/src/components/video-detail/views/DIYView.tsx`
- `apps/web/src/components/video-detail/views/GamingView.tsx`
- `apps/web/src/components/video-detail/blocks/__tests__/pro-con-block.test.tsx`
- `apps/web/src/components/video-detail/blocks/__tests__/dos-donts-block.test.tsx`
- `apps/web/e2e/block-design-overhaul.spec.ts` (NEW)

Suggested commit: `feat(web): block design overhaul — accent gradient, compact callouts, row-aligned grids, fade-edge system, view deduplication`
