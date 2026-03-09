# Layout Engine Overhaul — Context

**Last Updated: 2026-02-24**
**Status: COMPLETE — All 4 phases implemented and verified**

---

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Block order | Keep LLM source order | Preserves narrative flow the AI intended |
| Layout approach | Content-aware spatial arrangement | Blocks size based on content, not just type |
| Column strategy | CSS container queries | Adapts to content area width, not viewport |
| Auto-flow scope | Primary engine for all views | Currently only StandardView uses it |
| Backward compat | Type-based fallback when no measurements | Ensures no breaks during rollout |
| Scope | Full overhaul (4 phases) | User wants "NEXT LEVEL" quality |

---

## Architecture (Implemented)

```
measureBlock (runtime content → weight: micro/compact/standard/expanded)
  → computeAutoFlowLayout (content-aware greedy pairing)
    → FlowRow types (full/sidebar-main/equal-2/3/4/aside-stack)
      → FlowRowRenderer (shared component, CSS grid classes)
        → Container query CSS (adaptive column count based on content area)
          → Tighter spacing matrix (~40% reduction)
```

---

## Files Modified/Created

### New Files
| File | Role |
|------|------|
| `apps/web/src/lib/content-weight.ts` | Content weight measurement (micro/compact/standard/expanded) |
| `apps/web/src/lib/__tests__/content-weight.test.ts` | 36 tests for all block types |
| `apps/web/src/hooks/use-block-measurements.ts` | Memoized hook wrapping measureBlocks |
| `apps/web/src/components/video-detail/FlowRowRenderer.tsx` | Shared renderer for all 6 row types |

### Modified Files
| File | Changes |
|------|---------|
| `apps/web/src/lib/block-layout.ts` | Reclassified spacing categories, tightened spacing matrix |
| `apps/web/src/lib/auto-flow-layout.ts` | Full rewrite with content-aware algorithm, 6 row types |
| `apps/web/src/lib/__tests__/block-layout.test.ts` | Updated spacing assertions |
| `apps/web/src/lib/__tests__/auto-flow-layout.test.ts` | Full rewrite with backward compat + content-aware tests |
| `apps/web/src/index.css` | Tighter card padding, container query grid classes |
| `apps/web/src/hooks/use-auto-flow-layout.ts` | Accept optional measurements parameter |
| `apps/web/src/components/video-detail/views/ViewLayout.tsx` | Reduced spacing (space-y-6→space-y-4) |
| `apps/web/src/components/video-detail/views/__tests__/view-layout.test.tsx` | Updated assertions |
| `apps/web/src/components/video-detail/views/StandardView.tsx` | Use FlowRowRenderer + content-aware measurements |
| `apps/web/src/components/video-detail/VideoDetailDesktop.tsx` | Tighter dividers, content-container class |

---

## Spacing Values (Final)

| Context | Before | After |
|---------|--------|-------|
| Block gap max (prose→visual) | mt-5 (20px) | mt-3 (12px) |
| Block gap (visual→visual) | mt-4 (16px) | mt-2.5 (10px) |
| Block gap (dense→dense) | mt-2 (8px) | mt-1.5 (6px) |
| Card padding | p-5 (20px) | px-4 py-3.5 (16×14px) |
| Section spacing | space-y-6 (24px) | space-y-4 (16px) |
| Chapter divider | my-8 (32px) | my-6 (24px) |

---

## Content Weight Classification

| Weight | Grid Spans | Use For |
|--------|-----------|---------|
| `micro` | 1 | Single stat, short key-value, timestamp chip |
| `compact` | 2 | Short paragraph (<200 chars), callout, 1-2 item list, small code block |
| `standard` | 4 | Normal paragraph, 3-5 item list, code block, comparison |
| `expanded` | 4 | Long paragraph (500+ chars), 6+ item list, large code block |

---

## FlowRow Types

| Type | CSS Grid | When Used |
|------|----------|-----------|
| `full` | 1fr | Expanded blocks, standard blocks without neighbors |
| `sidebar-main` | 280px 1fr | Compact + standard adjacent blocks |
| `equal-2` | 1fr 1fr | Two compact blocks adjacent |
| `equal-3` | 1fr 1fr 1fr | Three compact blocks consecutive |
| `equal-4` | 1fr 1fr 1fr 1fr | Four+ micro blocks consecutive |
| `aside-stack` | 1fr 280px | Main block + 2+ stacked sidebar blocks |

---

## Verification Results

| Check | Result |
|-------|--------|
| TypeScript compilation | No errors |
| Unit tests | 1165 pass / 56 files |
| Desktop 1280px | No overflow, proper 2-col grids |
| Desktop 1440px | Proper layout, no overflow |
| Tablet 768px | Responsive stacking, no overflow |
| Mobile 375px | Single column fallback, no overflow |
| Dark mode | All blocks render correctly |
| Categories tested | Cooking, Coding, Reviews, Standard |

---

## Test Videos

| # | URL | Category | Key Blocks |
|---|-----|----------|------------|
| 1 | `/video/699caa5cbceeb26e66e3cb17` | Code | 12 chapters, heavy stats, code blocks, formulas |
| 2 | `/video/699cac64bceeb26e66e3cb19` | Recipe | Ingredients sidebar, steps, nutrition |
| 3 | `/video/699cad1ebceeb26e66e3cb1b` | Travel | Costs, locations, verdicts, comparisons |
| 4 | `/video/699cad4cbceeb26e66e3cb1d` | General | Comparisons, file trees, problem/solution |
