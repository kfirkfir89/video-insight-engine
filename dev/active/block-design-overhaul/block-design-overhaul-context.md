# Block Design Overhaul — Context

**Last Updated: 2026-02-22**
**Status: COMPLETE — All phases + view grouping rule fixes**

---

## Summary

All phases complete. Phase 3 added multi-column view layouts, block-level fixes, and auto-flow layout engine. Post-phase fix addressed two compounding bugs: (1) view grouping rules didn't match actual V2.1 block types, and (2) CodeView was single-column despite having sidebar-compatible stats. 1084 tests pass. TypeScript clean. Security audit: clean. Code review: no critical issues.

---

## Completed Work (All Phases)

### Phase 3: Block Fixes + Multi-Column + Auto-Flow

#### Phase A: Block-Level Fixes
| File | Changes |
|------|---------|
| `NutritionBlock.tsx` | Table → div-based list with fade-dividers, role="list" a11y |
| `RatingBlock.tsx` | Removed label line, compact horizontal layout (score+stars left, breakdown right on md+) |
| `index.css` | Location map: opacity 0.12/0.18, 2 extra contour ellipses, crosshair marker, grid 0.22 |

#### Phase B: Layout Infrastructure
| File | Changes |
|------|---------|
| `views/ViewLayout.tsx` | **NEW** — ViewLayout, LayoutRow, LayoutColumn, LayoutSection, renderSections |
| `lib/block-layout.ts` | Added SIDEBAR_COMPATIBLE_TYPES (10 types), partitionForSidebar() |

#### Phase C: View Templates (Multi-Column)
| View | Layout Pattern |
|------|---------------|
| RecipeView | Sidebar (ingredients) + Main (steps) |
| ReviewView | Top row (verdict + rating) + full-width below |
| TravelView | Sidebar (costs/locations) + Main (itineraries) |
| EducationView | Sidebar (formulas/keyvalues) + Main (definitions) |
| FitnessView | Sidebar (nutrition/stats) + Main (exercises) |
| PodcastView | Equal 2-col (guests + quotes) |
| DIYView | Sidebar (tools) + Main (steps) |
| StandardView | Auto-flow layout engine |
| CodeView | No change (single-column) |
| GamingView | No change (single-column) |

#### Phase D: Auto-Flow Engine
| File | Changes |
|------|---------|
| `lib/auto-flow-layout.ts` | **NEW** — computeAutoFlowLayout with complementary pairs |
| `hooks/use-auto-flow-layout.ts` | **NEW** — Memoized hook wrapper |

### Phases 1-7 + Phase 2 Visual Polish (Previously Completed)

#### Core Infrastructure
| File | Changes |
|------|---------|
| `BlockWrapper.tsx` | CSS custom property `--accent-line-color` via style objects |
| `index.css` | `.block-accent::before` gradient line, `.block-card::before` top fade, callout opacities, dark mode tuning, `.table-fade-dividers`, `.location-map-bg`, `.step-connector` |

#### Blocks Modified
| Block | Key Change |
|-------|-----------|
| CalloutBlock | Compact sizing (h-3.5 icons, text-xs, gap-1.5) |
| ComparisonRenderer | Row-by-row rendering, vertical center divider |
| ProConBlock | Row-aligned grid, single-column fallback |
| DosDontsBlock | Row-aligned grid, responsive columns |
| VerdictBlock | bestFor/notFor row-aligned grid |
| NumberedBlock | Fade-dividers between items |
| QuoteRenderer | `variant="transparent"`, removed accentColor |
| DefinitionBlock | `variant="card"`, `text-primary` on term |
| StepBlock | Fade-dividers between steps, `.step-connector` inner div |
| ToolListBlock | Changed to list layout with fade-dividers |
| TableBlock | `variant="card"`, Table2 icon header, bold headers |

#### Views Modified
| View | Key Change |
|------|-----------|
| All 10 views | Refactored to sections array + Fragment + fade-divider pattern |
| All 10 views | Added SectionHeader with contextual icons |
| StandardView | Added timestamp extraction via useGroupedBlocks |

#### Files Created (Previous Phases)
| File | Purpose |
|------|---------|
| `views/SectionHeader.tsx` | Reusable section header (LucideIcon + uppercase label) |
| `views/__tests__/section-header.test.tsx` | 4 unit tests |
| `hooks/use-grouped-blocks.ts` | Block grouping hook with BlockGroupRule interface |
| `e2e/block-design-overhaul.spec.ts` | 24 Playwright tests |

---

## Key Design Decisions

### Decision 1: Frontend-Only Layouts
**Chosen:** All layout decisions happen in the frontend
**Reason:** Summarizer already provides `category` + per-chapter `view`. Block types already classified by size. Layout is purely presentational.

### Decision 2: Sidebar Width = 280px
**Chosen:** Fixed 280px sidebar on md+ screens
**Reason:** Content area is 640-760px. 280px fits data-dense blocks comfortably. Main column gets 360-480px.

### Decision 3: ViewLayout Components (Not CSS Grid)
**Chosen:** Flexbox-based composition components
**Reason:** Simpler mental model (sidebar+main, equal-2, full). CSS grid would require track definitions.

### Decision 4: Auto-Flow for StandardView Only
**Chosen:** Only StandardView uses the auto-flow engine; specialized views use manual templates
**Reason:** Manual templates give precise control. Auto-flow is a smart fallback for generic/mixed content.

### Decision 5: Mobile Collapse Strategy
**Chosen:** `flex-col` on mobile, `md:flex-row` on desktop
**Reason:** Sidebar content stacks vertically on mobile as safe default.

### Decision 6: Graceful Degradation
**Chosen:** Views fall back to single-column when sidebar+main doesn't make sense
**Reason:** If only sidebar OR main content exists, multi-column adds no value.

---

## Test Results

| Suite | Result |
|-------|--------|
| TypeScript (`tsc --noEmit`) | Clean |
| Unit tests (Vitest) | 1085/1085 passed (+44 from Phase 3) |
| Playwright — block-design-overhaul.spec.ts | Pending visual verification |
| Playwright — block-ux-v2.spec.ts | Pending visual verification |

---

## New Files Created (Phase 3)

| File | Purpose |
|------|---------|
| `views/ViewLayout.tsx` | Layout primitives (ViewLayout, LayoutRow, LayoutColumn, LayoutSection, renderSections) |
| `views/__tests__/view-layout.test.tsx` | 17 unit tests for layout components |
| `lib/auto-flow-layout.ts` | Auto-flow layout algorithm with complementary pairs |
| `lib/__tests__/auto-flow-layout.test.ts` | 13 unit tests for auto-flow algorithm |
| `hooks/use-auto-flow-layout.ts` | Memoized hook wrapper |

## Existing Patterns Reused

- **`useGroupedBlocks(blocks, rules)`** — all views still use this
- **`ContentBlocks`** — renders blocks within each column/section
- **`SectionHeader`** — used inside LayoutSection
- **`groupBlocksBySize` / `getBlockSize`** — reused for auto-flow decisions
- **`.fade-divider` CSS** — no new CSS needed
- **`BLOCK_SIZE_MAP`** — half-width types already classified
