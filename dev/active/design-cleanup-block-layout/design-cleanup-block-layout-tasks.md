# Design Cleanup + Block Layout — Task Checklist

Last Updated: 2026-02-19

---

## Track A: Design System Cleanup

### Phase 1: Delete Unused UI Components [S] ✅
- [x] Verify zero imports for all 11 files (`grep -r` each filename)
- [x] Delete `progress-ring.tsx`
- [x] Delete `timer.tsx`
- [x] Delete `form.tsx`
- [x] Delete `resizable.tsx`
- [x] Delete `collapsible.tsx`
- [x] Delete `separator.tsx`
- [x] Delete `expandable-text.tsx`
- [x] ~~Delete `sonner.tsx`~~ — KEPT: actively used by 7 sidebar components
- [x] Delete `streaming-text.tsx`
- [x] Delete `tabs.tsx`
- [x] Delete `copy-button.tsx`
- [x] Check and remove orphaned deps: `sonner` KEPT, others removed
- [x] `npm run build` passes
- [x] Existing tests pass

### Phase 2: Remove Unused CSS Classes [S] ✅
- [x] Delete `.glass-panel` + dark mode
- [x] Delete `.glass-section-header` + dark mode + all pseudo-elements
- [x] Delete `.shimmer-bg`
- [x] Delete `@keyframes shimmer`
- [x] Delete `--animate-shimmer` in `@theme inline`
- [x] Delete `.animated-underline`
- [x] Delete `.block-progress-bar` + `.block-progress-fill`
- [x] Delete `.glow-primary`
- [x] Delete `.glow-warning`
- [x] Delete `.glow-destructive`
- [x] Verify `progress-fill` keyframe KEPT (used by RatingBlock)
- [x] Verify `glow-success` KEPT (used by QuizBlock, ExerciseBlock)
- [x] `npm run build` passes
- [x] Visual comparison — no visible changes

### Phase 3: Fix Zinc Palette Leaks [M] ✅
- [x] Add `--code-text`, `--code-muted`, `--code-dim` tokens to `.block-code-container`
- [x] Replace `BlockWrapper.tsx:112` — `text-zinc-400` → `text-[var(--code-muted)]`
- [x] Replace `TerminalBlock.tsx:39` — `text-zinc-400` → `text-[var(--code-muted)]`
- [x] Replace `TerminalBlock.tsx:64` — `text-zinc-100` → inherit
- [x] Replace `TerminalBlock.tsx:70` — `text-zinc-500` → `text-[var(--code-dim)]`
- [x] Replace `TerminalBlock.tsx:71` — `text-zinc-400` → `text-[var(--code-muted)]`
- [x] Replace `CodeBlock.tsx:50` — `text-zinc-400` → `text-[var(--code-muted)]`
- [x] Replace `CodeBlock.tsx:99` — `text-zinc-600` → `text-[var(--code-dim)]`
- [x] Replace `ExampleBlock.tsx:61` — zinc → code tokens
- [x] Replace `ExampleBlock.tsx:79` — `text-zinc-100` → inherit
- [x] Replace `ExampleBlock.tsx:85` — `text-zinc-500` → `text-[var(--code-dim)]`
- [x] Replace `checkbox.tsx:15` — `border-zinc-* bg-zinc-*` → `border-input bg-muted`
- [x] Visual check: CodeBlock, TerminalBlock, ExampleBlock in dark mode
- [x] Visual check: checkbox in forms

### Phase 4: Standardize Opacity Scale [L] ✅
- [x] Add opacity scale documentation comment to `index.css`
- [x] Remap `/15` → `/10` in AppHeader, SidebarTabs
- [x] Remap `/25` → `/20`
- [x] Remap `/30` → `/20` (bg) or `/40` (text) — per-instance judgment
- [x] Remap `/50` → `/40` (text)
- [x] Remap `/60` → `/70`
- [x] Remap `/80` → `/90`
- [x] DO NOT touch CSS-level `oklch(... / 0.xx)` in `index.css`
- [x] Side-by-side screenshots — changes imperceptible

### Phase 5: Documentation Sync [S] ✅
- [x] Update `tokens.md` — light mode hue ~250 → ~285/292
- [x] Update `tokens.md` — dark mode hue ~55 → ~280
- [x] Update `tokens.md` — `--primary` value
- [x] Update `tokens.md` — `--radius` value
- [x] Update all other drifted values (status/feedback colors)
- [x] Add comment to category accent section in `index.css`
- [x] Remove deleted utilities from tokens.md

---

## Track B: Block Layout Redesign

### Phase 6: Content Width + Spacing [S] ✅
- [x] `VideoDetailDesktop.tsx`: Add `max-w-[820px] mx-auto` to chapters wrapper
- [x] `ContentBlocks.tsx`: `space-y-4` → `space-y-3`
- [x] `StandardView.tsx`: `space-y-3` (match ContentBlocks)
- [x] Wide screen test — content constrained to ~820px
- [x] `npm run build` passes

### Phase 7: Chapter Title Strengthening [S] ✅
- [x] `ArticleSection.tsx`: `text-xs font-normal text-muted-foreground/40` → `text-sm font-semibold text-foreground/70`
- [x] `ArticleSection.tsx`: `items-center` → `items-baseline`
- [x] `ArticleSection.tsx`: `mb-2` → `mb-4 pt-1`
- [x] `ArticleSection.tsx`: Secondary title opacity `/30` → `/40`
- [x] Multi-chapter video — titles visible as landmarks

### Phase 8: Smart Block Grid Layout [L] ✅
- [x] Create `apps/web/src/lib/block-layout.ts`
  - [x] Define `BlockSize` type: `'full' | 'half' | 'compact'`
  - [x] Define `BlockGroup` interface
  - [x] Create `BLOCK_SIZE_MAP` — static type → size mapping (31 types)
  - [x] Implement `getBlockSize(type)` function
  - [x] Implement `groupBlocksBySize(blocks)` — O(n) grouping algorithm
- [x] Create `apps/web/src/lib/__tests__/block-layout.test.ts`
  - [x] Test mixed block types grouping
  - [x] Test single block graceful degradation
  - [x] Test empty array
  - [x] Test all-same-size arrays
  - [x] Test streaming scenario (progressively growing array)
  - [x] Test alternating sizes
  - [x] All 14 tests passing
- [x] Modify `ContentBlocks.tsx` — use grouped rendering
  - [x] Full groups: vertical stack (current behavior)
  - [x] Half groups: `grid-cols-1 md:grid-cols-2 gap-3`
  - [x] Compact groups: `grid-cols-2 md:grid-cols-3 gap-3`
- [x] Verify: Statistics blocks rendered inline with gradient text
- [x] Verify: Code blocks full-width
- [x] Verify: Half blocks (quote + callout) side-by-side on desktop
- [x] Tests pass

### Phase 9: Paragraph Refinement + Chapter Dividers [S] ✅
- [x] `ContentBlockRenderer.tsx`: Add `max-w-prose` to paragraph blocks
- [x] `ContentBlockRenderer.tsx`: `leading-[1.75]` → `leading-relaxed`
- [x] `ContentBlockRenderer.tsx`: `border-border/50` → `border-border/40`
- [x] `VideoDetailDesktop.tsx`: Add `fade-divider` between chapters
- [x] Multi-chapter text reads comfortably

### Phase 10: Block Header Polish [S] ✅
- [x] `index.css`: `.block-card-header` border opacity `0.4` → `0.20`
- [x] `index.css`: `.block-card-header-label` color opacity `0.7` → `0.5`
- [x] Visual check: blocks with headers

---

## Final Verification ✅
- [x] TypeScript check passes (`npx tsc --noEmit`)
- [x] `npm run build` passes (Vite production build)
- [x] `npm test` passes in `apps/web` — 49 files, 1012 tests
- [x] Wide screen (1920px) — content constrained to max-w-[820px]
- [x] Mobile (375px) — layout properly responsive, no overflow
- [x] Light mode — semantic tokens resolve correctly
- [x] Dark mode — all tokens resolve, no zinc leaks
- [x] Overflow audit — no real horizontal overflow issues
- [x] Test coding video: `/video/6992fb549431316d4a59d1ed` ✅
- [x] Test cooking video: `/video/69930f3c57188dc8205e1581` ✅
