# Block Design System Overhaul — Plan

**Last Updated: 2026-02-20**

---

## Executive Summary

Redesign the visual system for 33 content block types across 10+ views to create a cohesive, editorial reading experience. The current design suffers from heavy left borders (`.block-accent` with `border-l-[3px]`), oversized callouts, misaligned comparison columns, and inconsistent use of the fade-divider design language. This overhaul replaces the dashboard aesthetic with a clean, magazine-inspired visual grammar built on fade-edge lines as the signature design element.

**Scope:** Pure frontend — CSS + component structure changes. No backend/summarizer changes required.

---

## Current State Analysis

### Problems

1. **Heavy left borders** — `.block-accent` uses `border-l-[3px]` on callouts, quotes, and definitions, creating visual clutter
2. **Oversized callouts** — Warning/info/tip blocks use large padding + thick borders + high-opacity gradients, competing with content for attention
3. **Comparison column misalignment** — Unequal item counts between left/right columns break visual row alignment
4. **Inconsistent design language** — `fade-divider` exists but usage is sporadic; blocks lack unified visual grammar
5. **Comparison component duplication** — `ComparisonRenderer`, `ProConBlock`, `DosDontsBlock` solve the same layout problem differently

### Current Block Variant System

| Variant | CSS Class | Current Style |
|---------|-----------|--------------|
| card | `.block-card` | Rounded-xl, border, shadow, hover elevation |
| accent | `.block-accent` | `border-l-[3px]`, muted bg, rounded-lg |
| code | `.block-code-container` | Dark IDE surface, traffic lights |
| inline | `.block-inline` | No border/bg, compact |
| transparent | (none) | No wrapper styling |

### Blocks Using Accent Variant (to be changed)

| Block | Component | Current Usage |
|-------|-----------|---------------|
| Callout | `CalloutBlock.tsx` | `variant="accent"` + `accentColor` based on style |
| Quote (speaker/testimonial) | `QuoteRenderer.tsx` | `variant="accent"` + `accentColor="info"` |
| Definition | `DefinitionBlock.tsx` | `variant="accent"` + `accentColor="primary"` |

---

## Proposed Future State

### New Accent Variant — Top Fade-Edge Line

Replace `border-l-[3px]` with a **2px horizontal gradient at the top** of the block, colored by a CSS custom property `--accent-line-color`. The pseudo-element fades at both edges, matching the fade-divider language.

```css
.block-accent {
  /* Remove: border-l-[3px] */
  /* Add: position relative for ::before */
  /* Reduce: py-3.5 pl-5 pr-4 → py-3 pl-4 pr-3 */
}
.block-accent::before {
  position: absolute; top: 0; left: 10%; right: 10%;
  height: 2px;
  background: linear-gradient(to right, transparent, var(--accent-line-color) 30%, var(--accent-line-color) 70%, transparent);
}
```

### Accent Color via CSS Custom Property

```tsx
// BlockWrapper.tsx — replace border-l-X classes with style prop
const accentColorStyles: Record<AccentColor, React.CSSProperties> = {
  primary:     { '--accent-line-color': 'var(--primary)' },
  destructive: { '--accent-line-color': 'var(--destructive)' },
  success:     { '--accent-line-color': 'var(--success)' },
  warning:     { '--accent-line-color': 'var(--warning)' },
  info:        { '--accent-line-color': 'var(--info)' },
};
```

### Compact Callouts

- Text: `text-sm` → `text-xs`
- Icon: `h-4 w-4` → `h-3.5 w-3.5`
- Gap: `gap-2` → `gap-1.5`
- Remove `animate-breathe` from icon
- Reduce gradient opacity ~40%

### Comparison Grid — Tic-Tac-Toe Layout

```
  Do                    |  Don't
 ───────fade────────────┼────────fade──────────
  Item 1                |  Item 1
 ───────fade────────────┼────────fade──────────
  Item 2                |  Item 2
 ───────fade────────────┼────────fade──────────
  Item 3                |  (empty)
```

Row-by-row rendering with `maxRows = Math.max(left.length, right.length)`. Horizontal `fade-divider` between rows. Vertical `fade-divider-vertical` at center column.

### Fade-Edge Design Language

All blocks adopt `fade-divider` as the primary visual separator:
- Between items in BulletsBlock, NumberedBlock, KeyValueRenderer
- Between rating categories in RatingBlock
- Between sections in GuestBlock
- Subtle 1px `.block-card::before` top fade line on card variant

### Block Migration Away From Accent

| Block | From | To | Rationale |
|-------|------|-----|-----------|
| Quote (speaker/testimonial) | `variant="accent"` | `variant="transparent"` | Blockquote has its own decorative mark |
| Definition | `variant="accent"` | `variant="card"` | Standalone knowledge unit, card is appropriate |

---

## Implementation Phases

### Phase 1: Accent Variant Redesign — Kill the Left Border [M]

**Goal:** Replace heavy `border-l-[3px]` with top-edge gradient indicator.

1. Redesign `.block-accent` in `index.css` — remove border-l, add `position: relative`, reduce padding
2. Add `.block-accent::before` pseudo-element with fade-gradient line at top
3. Replace `accentColorClasses` in `BlockWrapper.tsx` with CSS custom property approach via `style` prop
4. Verify all accent consumers render correctly (CalloutBlock, QuoteRenderer, DefinitionBlock)

### Phase 2: Compact Callouts [S]

**Goal:** Make callouts smaller, less visually dominant.

1. Reduce CalloutBlock text/icon sizing and gap
2. Remove `animate-breathe` from callout icon
3. Reduce callout gradient opacity ~40% in `index.css`

### Phase 3: Comparison Grid System [L]

**Goal:** Unify all two-column comparison blocks with row-aligned grid.

1. Create `.comparison-grid` CSS utility in `index.css`
2. Refactor `ComparisonRenderer.tsx` — row-aligned grid with maxRows, fade dividers
3. Refactor `ProConBlock.tsx` — same grid pattern, keep ratio bar above
4. Refactor `DosDontsBlock.tsx` — same grid pattern
5. Update `VerdictBlock.tsx` bestFor/notFor section to use comparison-grid

### Phase 4: Fade-Edge Design Language [M]

**Goal:** Establish fade-edge lines as THE signature design element.

1. Audit and apply `fade-divider` to: BulletsBlock, NumberedBlock, KeyValueRenderer, RatingBlock, GuestBlock
2. Add subtle `.block-card::before` top fade line (1px, very subtle)
3. Refine `fade-divider` / `fade-divider-vertical` opacity for dark mode (0.3 → 0.4)

### Phase 5: Block-by-Block Polish [M]

**Goal:** Migrate blocks away from accent variant, simplify styling.

1. QuoteRenderer — `variant="accent"` → `variant="transparent"`, rely on decorative quote mark
2. DefinitionBlock — `variant="accent"` → `variant="card"`, term gets `text-primary`
3. ExampleBlock — verify uses `card` variant correctly
4. RatingBlock — add fade dividers between categories
5. GuestBlock — add structural fade dividers

### Phase 6: View System Deduplication [S]

**Goal:** Extract shared block-grouping logic.

1. Create `useGroupedBlocks` hook in `apps/web/src/hooks/use-grouped-blocks.ts`
2. Update 10 view files to use the hook, removing ~20-30 lines boilerplate each

### Phase 7: Summarizer Assessment [S]

**Goal:** Confirm no backend changes needed.

1. Verify: 33 block types map correctly to new visual system
2. Confirm: No new block types required, changes are frontend-only

---

## Execution Order & Dependencies

```
Phase 1 (Accent) ──────┬──→ Phase 4 (Fade Language) ──→ Phase 5 (Polish)
                        │
Phase 2 (Callouts) ─────┘

Phase 3 (Comparison Grid) ──→ (independent, can parallel with 1-2)

Phase 6 (View Dedup) ──→ (independent)

Phase 7 (Assessment) ──→ (N/A, no changes)
```

| Priority | Phase | Effort | Depends On |
|----------|-------|--------|-----------|
| 1 | Phase 1: Accent Redesign | M | None |
| 2 | Phase 2: Compact Callouts | S | Phase 1 |
| 3 | Phase 3: Comparison Grid | L | None |
| 4 | Phase 4: Fade Language | M | Phase 1 |
| 5 | Phase 5: Block Polish | M | Phase 1, 4 |
| 6 | Phase 6: View Dedup | S | None |
| 7 | Phase 7: Assessment | S | N/A |

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Dark mode regressions | Medium | High | Test every change in both modes |
| Mobile responsive breakage | Low | Medium | Test at sm/md breakpoints after comparison grid |
| CSS specificity conflicts | Low | Medium | Use `@layer components` consistently |
| Comparison grid empty cell rendering | Medium | Low | Handle gracefully with min-height on empty cells |
| View dedup hook breaks view-specific logic | Low | High | Extract only common grouping logic, keep view-specific rendering |

---

## Success Metrics

- [ ] `cd apps/web && npx tsc --noEmit` passes
- [ ] `cd apps/web && npm run build` succeeds
- [ ] `cd apps/web && npm test` passes
- [ ] No left borders anywhere — accent blocks use top fade-edge line
- [ ] Callouts are compact — smaller text, muted gradients
- [ ] Comparison blocks align rows across columns (tic-tac-toe grid)
- [ ] Fade-edge lines used consistently across all blocks
- [ ] Dark mode renders correctly for all blocks
- [ ] Mobile responsive breakpoints work
- [ ] Light mode contrast and readability good
