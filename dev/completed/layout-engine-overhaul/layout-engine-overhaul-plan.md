# Block Layout Engine Overhaul — Reading Flow & Space Efficiency

**Last Updated: 2026-02-23**

---

## Executive Summary

Overhaul the block layout system from static type-based classification to content-aware intelligent layout. Four phases: (1) tighten spacing ~40%, (2) add content-weight measurement system, (3) enhance auto-flow engine with multi-column support, (4) add CSS container queries for adaptive columns. Blocks keep LLM source order — only spatial arrangement changes.

**Impact**: Every video detail page (all categories). 36+ block types, 10 category views.

**Related tasks**: Subsumes layout portions of `reading-flow-rhythm`, `block-ux-v2`, `design-cleanup-block-layout`.

---

## Current State Analysis

### Architecture
```
VideoDetailDesktop (max-w-[820px] | 960px when panel minimized)
  → ArticleSection (per chapter)
    → Category View (CodeView, RecipeView, StandardView, etc.)
      → ContentBlocks (groups by size → renders grid)
        → ContentBlockRenderer (switch → block component)
          → BlockWrapper (card/accent/code/inline/transparent)
```

### Problems
| # | Problem | Root Cause | File |
|---|---------|------------|------|
| 1 | Excessive whitespace (60px+ between adjacent cards) | `mt-5` gap + `p-5` padding + `space-y-6` sections | `block-layout.ts`, `index.css`, `ViewLayout.tsx` |
| 2 | Max 2 columns always | Hardcoded `grid-cols-2`/`grid-cols-3` | `ContentBlocks.tsx` line 20-24 |
| 3 | No content awareness | Static `BLOCK_SIZE_MAP` ignores content | `block-layout.ts` line 19-59 |
| 4 | Auto-flow underused | Only in `StandardView`, not category views | `StandardView.tsx`, `auto-flow-layout.ts` |
| 5 | Visual noise | Inconsistent density between card types | `BlockWrapper.tsx`, `index.css` |

### Key Metrics (Current)
- Spacing matrix max gap: `mt-5` (20px) — appears 6 times in matrix
- Card padding: `p-5` (20px all sides)
- Section spacing: `space-y-6` (24px)
- Chapter divider: `my-8` (32px each side)
- Grid columns: max 3 (compact only)
- Auto-flow row types: 3 (`full`, `sidebar-main`, `equal-2`)

---

## Proposed Future State

### Key Metrics (Target)
- Spacing matrix max gap: `mt-3` (12px) — 40% reduction
- Card padding: `px-4 py-3.5` (~16px×14px)
- Section spacing: `space-y-4` (16px)
- Chapter divider: `my-6` (24px each side)
- Grid columns: max 4 (via container queries)
- Auto-flow row types: 6 (`full`, `sidebar-main`, `equal-2`, `equal-3`, `equal-4`, `aside-stack`)
- Content weight system: 4 levels (`micro`, `compact`, `standard`, `expanded`)

---

## Implementation Phases

### Phase 1: Tighter Spacing (Immediate Visual Impact)
**Effort**: M | **Risk**: Low | **Dependencies**: None

Reduce all spacing by ~40%. Biggest visual improvement for smallest code change.

#### 1.1 Reduce Spacing Matrix
**File**: `apps/web/src/lib/block-layout.ts`

New matrix:
```
prose:  { prose: 'mt-1.5', list: 'mt-2',   visual: 'mt-3',   dense: 'mt-2' }
list:   { prose: 'mt-2',   list: 'mt-2',   visual: 'mt-3',   dense: 'mt-2' }
visual: { prose: 'mt-3',   list: 'mt-3',   visual: 'mt-2.5', dense: 'mt-2.5' }
dense:  { prose: 'mt-2',   list: 'mt-2',   visual: 'mt-2.5', dense: 'mt-1.5' }
```

#### 1.2 Reclassify Spacing Categories
**File**: `apps/web/src/lib/block-layout.ts`

Move from `visual` to `dense`: `pro_con`, `cost`, `nutrition`, `guest`, `formula`, `rating`
Move from `visual` to `list`: `step`, `ingredient`

#### 1.3 Reduce Card Padding
**File**: `apps/web/src/index.css`

`.block-card`: `p-5` → `px-4 py-3.5`

#### 1.4 Reduce Section Spacing
**File**: `apps/web/src/components/video-detail/views/ViewLayout.tsx`

- `ViewLayout`: `space-y-6` → `space-y-4`
- `LayoutSection`: `space-y-2` → `space-y-1.5`

#### 1.5 Reduce Chapter Divider Spacing
**File**: `apps/web/src/components/video-detail/VideoDetailDesktop.tsx`

Chapter divider: `my-8` → `my-6`

#### Acceptance Criteria
- [ ] Adjacent cards separated by ≤ 40px total (was 60px+)
- [ ] No visual regressions on 4 test video pages
- [ ] Existing spacing tests updated and passing

---

### Phase 2: Content-Aware Block Sizing
**Effort**: M | **Risk**: Low | **Dependencies**: None (parallel with Phase 4)

New system that measures block content at runtime.

#### 2.1 Content Weight System
**New file**: `apps/web/src/lib/content-weight.ts`

Types: `micro` (1 span), `compact` (2 spans), `standard` (4 spans), `expanded` (4 spans)

Measurement rules by block type:
- **paragraph**: <80 chars = micro, <200 = compact, <500 = standard, 500+ = expanded
- **bullets/numbered**: 1-2 items = compact, 3-5 = standard, 6+ = expanded
- **callout**: always compact
- **statistic**: 1 = micro, 2-3 = compact, 4+ = standard
- **keyvalue**: 1-3 items = compact, 4+ = standard
- **code/terminal**: <5 lines = compact, 5-15 = standard, 15+ = expanded
- **quote**: <100 chars = compact, 100+ = standard
- **comparison/table/timeline**: always standard or expanded based on item count

#### 2.2 Memoized Hook
**New file**: `apps/web/src/hooks/use-block-measurements.ts`

#### Acceptance Criteria
- [ ] `measureBlock()` covers all 36+ block types
- [ ] Unit tests for each block type with boundary conditions
- [ ] Measurement is O(1) per block (string length, array count)
- [ ] Hook memoizes correctly (referential equality)

---

### Phase 3: Enhanced Auto-Flow Engine
**Effort**: L | **Risk**: Medium | **Dependencies**: Phase 2

Extend the auto-flow engine with content-aware multi-column support.

#### 3.1 Extend FlowRow Types
**File**: `apps/web/src/lib/auto-flow-layout.ts`

New types: `equal-3`, `equal-4`, `aside-stack`

#### 3.2 Rewrite `computeAutoFlowLayout`
**File**: `apps/web/src/lib/auto-flow-layout.ts`

Algorithm rules:
1. `expanded` → always `full`
2. `standard` + adjacent `compact`/`micro` → `sidebar-main`
3. 3 consecutive `compact` → `equal-3`
4. 4+ consecutive `micro` → `equal-4`
5. 2 `compact` → `equal-2`
6. `micro` paragraphs can go in sidebar-main
7. Complementary pairs get priority
8. Backward compat: works without measurements (type-based fallback)

#### 3.3 Extract Shared FlowRowRenderer
**New file**: `apps/web/src/components/video-detail/FlowRowRenderer.tsx`

Extract from `StandardView.tsx` lines 31-68, extend with new row types.

#### 3.4 Wire Into Views
Update `StandardView` to use shared renderer. Verify category views work with auto-flow on their `other` buckets.

#### Acceptance Criteria
- [ ] 3-column layouts appear for 3+ consecutive compact blocks
- [ ] 4-column layouts appear for 4+ consecutive micro blocks
- [ ] Short callouts pair alongside data blocks in sidebar-main
- [ ] Backward compat: no measurements = same output as current
- [ ] All existing auto-flow tests pass (updated)
- [ ] New tests for equal-3, equal-4, aside-stack rows

---

### Phase 4: CSS Container Queries
**Effort**: S | **Risk**: Low | **Dependencies**: None (parallel with Phase 2)

Adaptive column count based on content area width.

#### 4.1 Container Query Wrapper
**File**: `apps/web/src/components/video-detail/VideoDetailDesktop.tsx`

Add `@container/content` to chapters wrapper.

#### 4.2 New Grid Classes
**File**: `apps/web/src/index.css`

```css
.flow-grid-equal-2   → 2 cols @ 500px container width
.flow-grid-equal-3   → 3 cols @ 600px container width
.flow-grid-equal-4   → 4 cols @ 600px container width
.flow-grid-sidebar-main → 280px + 1fr @ 600px container width
```

#### Acceptance Criteria
- [ ] Right panel open (820px content): max 3 columns
- [ ] Right panel minimized (960px content): max 4 columns
- [ ] Mobile: single column fallback
- [ ] Browser support: works in Chrome 105+, Firefox 110+, Safari 16+

---

## Risk Assessment

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Spacing changes break visual balance | Medium | Medium | Test on all 4 video types before/after screenshots |
| Content weight misclassifies blocks | Low | Medium | Fallback to type-based sizing; extensive unit tests |
| Auto-flow produces bad pairing | High | Low | Keep old algorithm as fallback path; feature flag |
| Container queries not supported | Medium | Very Low | 95%+ browser support; fallback to viewport media queries |
| Category views break with new engine | Medium | Low | Views still compose their own layout; auto-flow only affects `other` bucket |

---

## Success Metrics

1. **Space efficiency**: Average vertical height of video page reduced by 30%+
2. **Column utilization**: Videos with 3+ statistics show 3-column layout
3. **Content pairing**: Short callouts appear alongside data blocks, not full-width
4. **Visual consistency**: Uniform spacing rhythm across all video types
5. **Performance**: No measurable render time increase (<5ms per chapter)

---

## Dependencies & Resources

### Existing Code to Reuse
| Utility | File | Purpose |
|---------|------|---------|
| `SIDEBAR_COMPATIBLE_TYPES` | `apps/web/src/lib/block-layout.ts` | Base sidebar compatibility set |
| `COMPLEMENTARY_PAIRS` | `apps/web/src/lib/auto-flow-layout.ts` | Priority pairing rules |
| `useGroupedBlocks` | `apps/web/src/hooks/use-grouped-blocks.ts` | Block extraction for category views |
| `useAutoFlowLayout` | `apps/web/src/hooks/use-auto-flow-layout.ts` | Hook wrapper for auto-flow |
| `ViewLayout` + helpers | `apps/web/src/components/video-detail/views/ViewLayout.tsx` | Layout composition primitives |
| `BlockWrapper` | `apps/web/src/components/video-detail/blocks/BlockWrapper.tsx` | Block styling (no changes) |
| `ContentBlock` types | `packages/types/src/index.ts` | Type definitions (no changes) |

### Files to Modify
| File | Phase | Changes |
|------|-------|---------|
| `apps/web/src/lib/block-layout.ts` | 1 | Spacing matrix, category reclassification |
| `apps/web/src/index.css` | 1, 4 | Card padding, container query grid classes |
| `apps/web/src/components/video-detail/views/ViewLayout.tsx` | 1 | Section spacing |
| `apps/web/src/components/video-detail/VideoDetailDesktop.tsx` | 1, 4 | Chapter spacing, container wrapper |
| `apps/web/src/lib/auto-flow-layout.ts` | 3 | New row types, content-aware algorithm |
| `apps/web/src/components/video-detail/views/StandardView.tsx` | 3 | Use shared FlowRowRenderer |
| `apps/web/src/components/video-detail/ContentBlocks.tsx` | 3 | Updated grid references |

### New Files
| File | Phase | Purpose |
|------|-------|---------|
| `apps/web/src/lib/content-weight.ts` | 2 | Content measurement system |
| `apps/web/src/hooks/use-block-measurements.ts` | 2 | Memoized measurement hook |
| `apps/web/src/components/video-detail/FlowRowRenderer.tsx` | 3 | Shared flow row renderer |
| `apps/web/src/lib/__tests__/content-weight.test.ts` | 2 | Weight tests |
| `apps/web/src/components/video-detail/__tests__/FlowRowRenderer.test.tsx` | 3 | Renderer tests |

### Test Videos for Verification
1. http://localhost:5173/video/699caa5cbceeb26e66e3cb17 (Code — 12 chapters, heavy stats)
2. http://localhost:5173/video/699cac64bceeb26e66e3cb19 (Recipe — ingredients + steps sidebar)
3. http://localhost:5173/video/699cad1ebceeb26e66e3cb1b (Travel — costs, locations, verdicts)
4. http://localhost:5173/video/699cad4cbceeb26e66e3cb1d (General code — comparisons, file trees)
