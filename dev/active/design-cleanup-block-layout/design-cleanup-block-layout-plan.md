# Design System Cleanup + Block Layout Redesign

Last Updated: 2026-02-19

---

## Executive Summary

Two-track project to clean accumulated CSS/component debt from the design system (Track A) and redesign the flat block layout into a responsive grid system (Track B). Track A removes ~11 unused UI components, ~120 lines of dead CSS, standardizes hardcoded zinc palette references and opacity values, and syncs documentation. Track B introduces max-width constraints, chapter title strengthening, a smart block grid layout system, and paragraph refinement. Every phase is independently verifiable and revertible.

---

## Current State Analysis

After 4 completed task rounds (design-system-ux-overhaul, block-ux-v2, frontend-refactor, button-consistency), the codebase has accumulated:

### Design System Debt (Track A)
- **11 unused UI components** in `apps/web/src/components/ui/` with zero imports
- **~120 lines of dead CSS** across 9+ unused classes in `index.css`
- **11 hardcoded zinc palette references** in block components (should use semantic tokens)
- **13+ different opacity levels** with no standard scale
- **Documentation drift** — `tokens.md` no longer matches actual CSS variable values

### Layout Limitations (Track B)
- **31 content block types** all render in a flat `space-y-4` vertical stack
- **No max-width constraint** — text runs too wide on large screens
- **Small blocks waste full width** — statistics, timestamps, definitions don't need it
- **Chapter titles nearly invisible** — `text-xs font-normal text-muted-foreground/40`
- **No visual separation** between chapters

---

## Proposed Future State

### After Track A
- Zero unused UI component files
- Zero dead CSS classes
- All color references use semantic tokens or CSS custom properties
- Standardized 6-value opacity scale (`/5`, `/10`, `/20`, `/40`, `/70`, `/90`)
- Documentation matches reality

### After Track B
- Content constrained to `max-w-[820px]` (~75 chars/line)
- Smart grid layout: full-width, half-width (2-col), and compact (3-col) blocks
- Chapter titles are visible navigation landmarks
- Paragraph text at optimal `max-w-prose` (65ch) reading width
- Visual chapter dividers between sections
- Block headers recede, content speaks louder

---

## Implementation Phases

### Track A: Design System Cleanup (Phases 1-5)

All phases can run in parallel. No inter-dependencies.

#### Phase 1: Delete Unused UI Components
**Effort**: S | **Risk**: Very Low

Delete 11 files from `apps/web/src/components/ui/`:
- `progress-ring.tsx`, `timer.tsx`, `form.tsx`, `resizable.tsx`
- `collapsible.tsx`, `separator.tsx`, `expandable-text.tsx`
- `sonner.tsx`, `streaming-text.tsx`, `tabs.tsx`, `copy-button.tsx`

Check `package.json` for orphaned deps: `sonner`, `@radix-ui/react-collapsible`, `@radix-ui/react-separator`, `react-resizable-panels`.

**Acceptance**: `npm run build` passes. No import errors.

#### Phase 2: Remove Unused CSS Classes
**Effort**: S | **Risk**: Low

Delete from `apps/web/src/index.css` (~95 lines):
- `.glass-panel` + dark mode variants
- `.glass-section-header` + dark mode variants
- `.shimmer-bg`, `@keyframes shimmer`, `--animate-shimmer`
- `.animated-underline`
- `.block-progress-bar` + `.block-progress-fill`
- `.glow-primary`, `.glow-warning`, `.glow-destructive`

**Keep**: `progress-fill` keyframe, `glow-success`, category accent CSS.

**Acceptance**: Build passes. Visual comparison shows no changes.

#### Phase 3: Fix Zinc Palette Leaks
**Effort**: M | **Risk**: Low

Add 3 semantic code-surface tokens to `.block-code-container`:
```css
--code-text: oklch(90% 0.005 250);
--code-muted: oklch(65% 0.01 250);
--code-dim: oklch(45% 0.01 250);
```

Replace zinc references in:
- `BlockWrapper.tsx` (1 instance)
- `TerminalBlock.tsx` (4 instances)
- `CodeBlock.tsx` (2 instances)
- `ExampleBlock.tsx` (4 instances)
- `checkbox.tsx` (border/bg)

**Acceptance**: Code blocks render identically in light + dark mode.

#### Phase 4: Standardize Opacity Scale
**Effort**: L | **Risk**: Medium

Define standard 6-value scale: `/5`, `/10`, `/20`, `/40`, `/70`, `/90`.

Remap Tailwind utility opacities in ~25 `.tsx` files:
- `/6`, `/8` → `/5` (category CSS only — skip, already hex rgba)
- `/15` → `/10` (AppHeader, SidebarTabs, ~3 instances)
- `/25` → `/20` (~1 instance)
- `/30` → `/20` (bg) or `/40` (text) (~9 files)
- `/50` → `/40` (text) or remove (~5 files)
- `/60` → `/70` (~8 files)
- `/80` → `/90` (~4 files)

**DO NOT touch**: CSS-level `oklch(... / 0.xx)` in `index.css`.

**Acceptance**: Side-by-side screenshots show imperceptible changes.

#### Phase 5: Documentation Sync
**Effort**: S | **Risk**: Near Zero

Update `.claude/skills/design-system/resources/tokens.md`:
- Light mode hue: ~250 → ~285/292 (violet-indigo)
- Dark mode hue: ~55 → ~280 (deep indigo-purple)
- `--primary`: `oklch(55% 0.25 29)` → `oklch(58% 0.24 292)`
- `--radius`: `0.625rem` → `0.75rem`

Add comment to category accent section in `index.css`.

**Acceptance**: Docs match actual CSS values.

---

### Track B: Block Layout Redesign (Phases 6-10)

Sequential within track. Phase 6 establishes the container, others build on it.

#### Phase 6: Content Width + Spacing
**Effort**: S | **Risk**: Low | **Depends on**: Track A complete (recommended)

- `VideoDetailDesktop.tsx` ~line 143: Add `max-w-[820px] mx-auto` to chapters wrapper
- `ContentBlocks.tsx` line 29: `space-y-4` → `space-y-3`
- `StandardView.tsx` line 33: `space-y-3` (match ContentBlocks)

**Acceptance**: Wide screen — content doesn't stretch edge-to-edge. ~75 chars/line.

#### Phase 7: Chapter Title Strengthening
**Effort**: S | **Risk**: Low | **Independent**

In `ArticleSection.tsx` lines 180-189:
- `text-xs font-normal text-muted-foreground/40` → `text-sm font-semibold text-foreground/70`
- `items-center` → `items-baseline`
- `mb-2` → `mb-4 pt-1`
- Secondary title opacity: `/30` → `/40`

**Acceptance**: Multi-chapter video — titles are visible navigation landmarks.

#### Phase 8: Smart Block Grid Layout (Core Change)
**Effort**: L | **Risk**: Medium | **Depends on**: Phase 6

**New file**: `apps/web/src/lib/block-layout.ts`

Static size map — `ContentBlockType → 'full' | 'half' | 'compact'`:
- **full**: paragraph, bullets, numbered, comparison, do_dont, code, terminal, example, table, file_tree, transcript, timeline, itinerary, step, ingredient, exercise, workout_timer, tool_list, location, quiz
- **half**: callout, quote, definition, pro_con, verdict, cost, nutrition, guest, formula, rating
- **compact**: statistic, keyvalue, timestamp

`groupBlocksBySize(blocks)` algorithm — O(n), streaming-safe.

**New test file**: `apps/web/src/lib/__tests__/block-layout.test.ts`

Modify `ContentBlocks.tsx` to use grouped rendering with responsive grid.

**Acceptance**: Statistics blocks appear 2-3 across. Code blocks stay full-width. Streaming works.

#### Phase 9: Paragraph Refinement + Chapter Dividers
**Effort**: S | **Risk**: Low | **Depends on**: Phase 6

In `ContentBlockRenderer.tsx` (paragraph case):
- Add `max-w-prose` (65ch)
- `leading-[1.75]` → `leading-relaxed`
- `border-border/50` → `border-border/40`

In `VideoDetailDesktop.tsx` (chapter loop):
- Add `<div className="fade-divider" />` between chapters

**Acceptance**: Multi-chapter text reads comfortably.

#### Phase 10: Block Header Polish
**Effort**: S | **Risk**: Very Low | **Independent**

In `index.css`:
- `.block-card-header` border opacity: `0.4` → `0.20`
- `.block-card-header-label` color opacity: `0.7` → `0.5`

**Acceptance**: Card blocks (Quiz, Ingredient) — headers recede, content prominent.

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Unused component has hidden import | Low | Low | `grep -r` verify before delete |
| Opacity remapping visible change | Medium | Low | Small batches, side-by-side screenshots |
| Grid layout breaks streaming | Medium | Medium | Pure function re-runs on every render |
| Grid layout breaks category views | Low | Medium | Views call ContentBlocks with pre-filtered blocks, grid operates on any array |
| Mobile layout affected | Low | Medium | max-w only applies to desktop wrapper |

---

## Success Metrics

- [ ] Zero unused UI component files in `components/ui/`
- [ ] Zero dead CSS classes in `index.css`
- [ ] Zero hardcoded zinc references in block components
- [ ] Opacity scale standardized to 6 values
- [ ] Documentation matches CSS reality
- [ ] Content width ≤ 820px on wide screens
- [ ] Statistics/keyvalue blocks render in multi-column grid
- [ ] Chapter titles visible as navigation landmarks
- [ ] `npm run build` passes at every phase
- [ ] Existing tests pass at every phase
- [ ] Streaming summarization works with grid layout

---

## Dependencies

```
Track A (parallel):
  Phase 1: Delete UI components ──┐
  Phase 2: Delete CSS classes ─────┤
  Phase 3: Fix zinc leaks ────────┤── All independent
  Phase 4: Standardize opacity ───┤
  Phase 5: Sync docs ─────────────┘
                                   │
                                   ▼
Track B (sequential):
  Phase 6: Width + spacing ───── FIRST (establishes container)
  Phase 7: Chapter titles ────── Independent of Phase 6
  Phase 8: Grid layout ───────── After Phase 6
  Phase 9: Paragraphs ────────── After Phase 6
  Phase 10: Header polish ────── Independent
```

---

## Files Summary

| File | Phases | Action |
|------|--------|--------|
| `apps/web/src/components/ui/` (11 files) | 1 | Delete |
| `apps/web/src/index.css` | 2, 3, 4, 5, 10 | Edit |
| `blocks/TerminalBlock.tsx` | 3 | Edit (zinc) |
| `blocks/CodeBlock.tsx` | 3 | Edit (zinc) |
| `blocks/ExampleBlock.tsx` | 3 | Edit (zinc) |
| `blocks/BlockWrapper.tsx` | 3 | Edit (zinc) |
| `components/ui/checkbox.tsx` | 3 | Edit (zinc) |
| ~25 `.tsx` files | 4 | Edit (opacity) |
| `.claude/skills/design-system/resources/tokens.md` | 5 | Edit (docs) |
| `apps/web/src/lib/block-layout.ts` | 8 | **New** |
| `apps/web/src/lib/__tests__/block-layout.test.ts` | 8 | **New** |
| `video-detail/ContentBlocks.tsx` | 6, 8 | Edit |
| `video-detail/VideoDetailDesktop.tsx` | 6, 9 | Edit |
| `video-detail/ArticleSection.tsx` | 7 | Edit |
| `video-detail/ContentBlockRenderer.tsx` | 9 | Edit |
| `video-detail/views/StandardView.tsx` | 6 | Edit |

---

## What's NOT Changed

- All 31 block component internals (except zinc fixes in 3 files)
- All 10 category view files
- Mobile layout (`VideoDetailMobile.tsx`)
- Streaming/SSE pipeline
- Data models / types
- Animation system (stagger-children, block-entrance)
- Category accent color definitions (kept, documented)
