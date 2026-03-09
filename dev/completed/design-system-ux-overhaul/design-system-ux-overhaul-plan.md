# Design System UX Overhaul - Full Visual Redesign

**Last Updated: 2026-02-05**

---

## Executive Summary

Unify the visual design language across all 31 content blocks and 10 category views. Currently each block was built independently, resulting in inconsistent spacing, colors, borders, typography, and interaction patterns. This overhaul establishes a cohesive, modern, matte aesthetic through new design tokens, an enhanced BlockWrapper variant system, and systematic block-by-block redesign.

---

## Current State Analysis

### Problems Identified
- **Spacing chaos**: Padding ranges from `p-0` to `p-6` randomly across blocks
- **Color anarchy**: ~60% hardcoded Tailwind colors (emerald, amber, rose, sky), ~40% semantic tokens
- **Border inconsistency**: 16 full borders, 5 left-only, 7 none
- **Typography disorder**: 7 different text sizes with no clear hierarchy
- **Missing structure**: 9/31 blocks don't use BlockWrapper
- **No interactions**: 59% of blocks lack hover states
- **Icon chaos**: Sizes from `h-3 w-3` to `h-8 w-8`, hardcoded colors
- **Views**: Hardcode Tailwind colors instead of category CSS variables
- **BlockWrapper**: Accessibility-only wrapper with no visual styling capability

### Inventory
- **34 block component files** (29 *Block + 5 *Renderer)
- **10 view files** (one per category)
- **1 BlockWrapper** (minimal, no variants)
- **31 mock block factories** (well-structured)
- **Showcase pages** exist but don't demonstrate theming

---

## Proposed Future State

**Modern, clean, matte** aesthetic with:
- Unified card system with consistent elevation and borders
- 3-tier visual hierarchy (header icon+label → main content → metadata)
- Semantic color tokens everywhere (no hardcoded colors)
- Standardized Lucide icons per `icons.md` conventions
- Micro-interactions on all interactive elements
- Warm dark mode / cool light mode (already in tokens)
- Every block wrapped in BlockWrapper with proper variant

---

## Implementation Phases

### Phase 1: Foundation - New Design Tokens & CSS Utilities
**Effort: M | Files: 1 (index.css)**

Add OKLCH semantic feedback colors (success, warning, info) to `:root`, `.dark`, and `@theme inline`. Add block layout CSS utility classes (`.block-card`, `.block-card-header`, `.block-accent`, `.block-code-container`, `.block-inline`, `.block-progress-bar`). Establish standardized design scales for spacing, borders, typography, and shadows.

**Acceptance Criteria:**
- Success/warning/info tokens with `-foreground` and `-soft` variants in light + dark
- All block CSS utilities available via class names
- Design scales documented in code comments

### Phase 2: BlockWrapper Visual Enhancement
**Effort: M | Files: 1 (BlockWrapper.tsx)**

Transform BlockWrapper from accessibility-only to a styled foundation with variant system: `card`, `inline`, `accent`, `code`, `transparent`. Add `accentColor`, `headerIcon`, `headerLabel`, `headerAction` props. Auto-render `.block-card-header` when header props provided.

**Acceptance Criteria:**
- 5 visual variants working with correct CSS utility mapping
- Header auto-renders with icon + label + optional action
- Backward compatible (existing blocks still work)
- All existing tests still pass

### Phase 3: Block Component Visual Redesign (31 blocks)
**Effort: XL | Files: 31 block component files**

Update all blocks in groups of similar visual treatment:
- **Group A** (3): Code blocks → `variant="code"`, dark themed containers
- **Group B** (3): Data tables → `variant="card"`, structured data with row hover
- **Group C** (2): Rating/verdict → `variant="card"`, semantic sentiment colors
- **Group D** (4): Accent-left → `variant="accent"`, callouts/quotes/definitions
- **Group E** (4): Lists → `variant="inline"`, consistent icon sizing
- **Group F** (4): Interactive → `variant="card"`, hover/focus states
- **Group G** (6): Info cards → `variant="card"`, structured content
- **Group H** (2): Dual-column → `variant="card"`, success/destructive accents
- **Group I** (3): Minimal/inline → `variant="transparent"`, compact layouts

**Acceptance Criteria per block:**
1. Proper BlockWrapper variant assigned
2. Standardized header with Lucide icon (where applicable)
3. ALL hardcoded Tailwind colors replaced with semantic tokens
4. Consistent spacing from Phase 1 scales
5. Hover/focus states on interactive elements
6. Transitions on color/shadow changes

### Phase 4: View Component Redesign (10 views)
**Effort: L | Files: 10 view files**

Replace ALL hardcoded colors with category CSS variables. Establish unified section component pattern (rounded-xl, border, icon+label header). Add distinct Lucide icons per category tip type. Standardize tips section styling across all views.

**Acceptance Criteria:**
- Zero hardcoded Tailwind colors in any view
- All sections use consistent layout pattern
- Category-specific tip icons (ChefHat, Compass, Dumbbell, etc.)
- Tips sections use `warning-soft` background uniformly

### Phase 5: Showcase Page Improvements
**Effort: M | Files: 4 (BlockShowcase, ViewShowcase, ColorPalette, mock-blocks)**

Upgrade BlockShowcase with variant indicator badges and group headers with icons. Add "Feedback" group to ColorPalette with success/warning/info/destructive tokens. Enrich ViewShowcase with 8-12 mock blocks per chapter. Add callout and comparison variant examples to mock data.

**Acceptance Criteria:**
- Each block preview shows variant badge
- ColorPalette displays all new semantic tokens with OKLCH values
- Mock data covers all callout styles and comparison variants

### Phase 6: Testing & Verification
**Effort: L | Files: test files**

Run all 942+ unit tests (no regressions). Run 49+ Playwright E2E tests. Visual verification on `/dev/design-system` in light+dark modes. Verify at 768px (tablet) and 1280px (desktop). Accessibility checks: all blocks wrapped, icons have `aria-hidden`, focus rings visible.

**Acceptance Criteria:**
- All existing tests pass
- Visual coherence in both themes
- No overflow at tablet width
- All 31 blocks wrapped in BlockWrapper
- All icons have `aria-hidden="true"` and `shrink-0`

---

## Execution Dependencies

```
Phase 1 (Tokens+CSS) ──→ Phase 2 (BlockWrapper) ──→ Phase 3 (All 31 Blocks)
                                                           │
                                                           ├──→ Phase 4 (10 Views)
                                                           │
                                                           └──→ Phase 5 (Showcase)
                                                                     │
                                                                     └──→ Phase 6 (Testing)
```

---

## Risk Assessment & Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Regression in existing tests | High | Medium | Run full test suite after each phase |
| Dark mode colors don't match vision | Medium | Medium | Visual verification after Phase 1 tokens |
| BlockWrapper changes break existing blocks | High | Low | Backward-compatible defaults, `card` as default variant |
| Scope creep from 31 blocks | High | High | Strict group-by-group execution, no refactors beyond scope |
| Category CSS variables missing in some contexts | Medium | Medium | Test each view independently |

---

## Success Metrics

1. **Zero hardcoded Tailwind colors** in any block or view component
2. **31/31 blocks** use BlockWrapper with appropriate variant
3. **10/10 views** use category CSS variables exclusively
4. **All existing tests pass** (942+ unit, 49+ E2E)
5. **Visual coherence** verified in light + dark mode screenshots
6. **No responsive overflow** at tablet (768px) width

---

## Task Count Summary

| Phase | Tasks | Files |
|-------|-------|-------|
| Phase 1: Foundation | 3 | 1 (index.css) |
| Phase 2: BlockWrapper | 2 | 1 (BlockWrapper.tsx) |
| Phase 3: 31 Block updates | 31 | 31 block files |
| Phase 4: 10 View updates | 10 | 10 view files |
| Phase 5: Showcase | 4 | 4 files |
| Phase 6: Testing | 3 | test files |
| **Total** | **~53** | **~47** |

---

## Design Principles (applied everywhere)

1. **Only Lucide icons** - Named imports, `h-4 w-4` headers, `h-3.5 w-3.5` inline, `shrink-0` always
2. **Semantic colors only** - `text-success` not `text-emerald-600`, `bg-warning-soft` not `bg-amber-50/50`
3. **Consistent card language** - `rounded-xl border-border/40 shadow-sm` on all card blocks
4. **Distinctive headers** - `text-xs font-semibold uppercase tracking-wider` with icon
5. **Micro-interactions** - `transition-all duration-200` on hover/focus for every interactive element
6. **Matte aesthetic** - OKLCH low chroma (0.03-0.14) for all semantic colors
7. **BlockWrapper on everything** - All 31 blocks get proper variant wrapper

---

## Key File References

| File | Purpose |
|------|---------|
| `apps/web/src/index.css` | Color tokens, CSS utilities |
| `apps/web/src/components/video-detail/blocks/BlockWrapper.tsx` | Wrapper component |
| `apps/web/src/components/video-detail/blocks/*.tsx` | 31 block components |
| `apps/web/src/components/video-detail/views/*.tsx` | 10 view components |
| `apps/web/src/components/dev/design-system/BlockShowcase.tsx` | Block showcase |
| `apps/web/src/components/dev/design-system/ViewShowcase.tsx` | View showcase |
| `apps/web/src/components/dev/design-system/ColorPalette.tsx` | Color palette display |
| `apps/web/src/lib/dev/mock-blocks.ts` | Mock block factories |

---

## Phase 7: Unified Design Language Polish (Completed)

**Date: 2026-02-06** | **Status: 100% Complete**

After Phases 1-6 established the foundation and structure, Phase 7 applied systematic visual polish across all block components to create a cohesive premium design language.

### What Was Done

Applied premium CSS utilities and dark mode enhancements across 15+ files in 8 sub-phases:

1. **Premium CSS Utilities** — Added to `index.css`:
   - `stagger-children` (cascading entrance animation, 50ms delays, up to 15 children)
   - `hover-lift` (translateY(-2px) + shadow on hover)
   - `hover-scale` (scale 1.02 on hover, 0.98 on active)
   - `glass-surface` (backdrop-blur + translucent bg)
   - `text-gradient-primary` / `text-gradient-warm` (gradient text effects)
   - `fade-divider` / `fade-divider-vertical` (gradient separators)
   - `glow-primary` / `glow-success` / `glow-warning` / `glow-destructive` (box-shadow glow)
   - Block-specific utilities: `pro-con-bar`, `timeline-line`, `definition-item`, `numbered-ghost`, `step-connector`, `location-map-bg`, `quote-decorative-mark`, `callout-gradient-*`

2. **Dark Mode Glow Classes** — 7 component-specific glow utilities:
   - `badge-glow-success/warning/destructive` (ExerciseBlock difficulty badges)
   - `amount-badge-glow` (IngredientBlock amounts)
   - `timer-glow` (WorkoutTimerBlock digits)
   - `day-number-glow` (ItineraryBlock day circles)
   - `avatar-glow` (GuestBlock avatars)

3. **Premium Effect Tokens** — `--glow-strength` (0.12 light / 0.3 dark) and `--glow-spread` (12px light / 20px dark) for theme-adaptive glow intensity.

4. **Automatic Dark Mode Enhancements** — `:is(.dark)` selectors for ambient bloom on card hover, glass panel glow, timeline line glow, definition border glow, quote mark glow, numbered ghost bloom, step connector glow, text gradient glow, and pro-con bar glow.

### Block-by-Block Changes Summary

| Block | Utilities Applied |
|-------|-------------------|
| BulletsBlock | `stagger-children`, `fade-divider` |
| NumberedBlock | `stagger-children`, `text-gradient-primary`, `numbered-ghost` |
| CalloutBlock | `callout-gradient-*`, accent-colored icons |
| DefinitionBlock | `definition-item`, `stagger-children` |
| ExampleBlock | `block-card`, `hover-lift` |
| IngredientBlock | `stagger-children`, `hover-lift`, `glass-surface`, `fade-divider`, `amount-badge-glow` |
| StepBlock | `stagger-children`, `step-connector`, `text-gradient-primary` |
| NutritionBlock | `glass-surface`, `fade-divider`, `text-gradient-warm` |
| CodeBlock | `block-code-container`, `block-code-header` |
| TerminalBlock | `block-code-container`, `stagger-children` |
| FileTreeBlock | `block-card`, `stagger-children` |
| ProConBlock | `stagger-children`, `pro-con-bar`, `hover-lift` |
| RatingBlock | `text-gradient-primary`/`text-gradient-warm`, `progress-bar-gradient` |
| VerdictBlock | `block-card`, `glow-*` |
| LocationBlock | `location-map-bg`, `location-compass`, `hover-lift` |
| ItineraryBlock | `stagger-children`, `timeline-line`, `day-number-glow`, `hover-lift` |
| CostBlock | `stagger-children`, `glass-surface`, `fade-divider`, `hover-lift` |
| ExerciseBlock | `stagger-children`, `hover-lift`, `badge-glow-*`, `fade-divider` |
| WorkoutTimerBlock | `glass-surface`, `timer-glow`, `hover-scale` |
| QuizBlock | `hover-scale`, `stagger-children` |
| FormulaBlock | `text-gradient-primary` |
| GuestBlock | `avatar-glow`, `hover-lift` |
| QuoteRenderer | `quote-decorative-mark` |
| StatisticRenderer | `text-gradient-primary`, `animate-counter-pop` |
| TimestampRenderer | `hover-scale` |
| ComparisonRenderer | `stagger-children` |
| KeyValueRenderer | `fade-divider` |
| TimelineBlock | `timeline-line`, `timeline-dot`, `stagger-children` |
| TranscriptBlock | `stagger-children`, `fade-divider` |
| ToolListBlock | `stagger-children`, `fade-divider`, `hover-lift` |
| DosDontsBlock | `stagger-children` |
| TableBlock | `block-card`, `hover-lift` (rows) |

### Test Verification

- **954 / 954 unit tests pass** (0 failures)
- **0 type errors** (`pnpm run typecheck` clean)
- Visual verification in light + dark mode on `/dev/design-system`
- All 32 block types render with premium polish

### Files Modified

**CSS (1):** `index.css` — 8 dark-mode glow classes, 12+ block utility classes, premium effect tokens

**Block Components (32):** All blocks in `apps/web/src/components/video-detail/blocks/`

**Views (8):** RecipeView, ReviewView, TravelView, FitnessView, EducationView, PodcastView, GamingView, DIYView

**Tests (9):** Updated test files for CostBlock, FormulaBlock, ProConBlock, QuizBlock, RatingBlock, TerminalBlock, TimelineBlock, TranscriptBlock, VerdictBlock

**Dev Pages (4):** DesignSystemPage, BlockShowcase, ColorPalette, design-system tests

**Types (1):** `packages/types/src/index.ts` — Added TableBlock type
