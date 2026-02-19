# Reading Flow & Visual Rhythm — Task Checklist

**Last Updated: 2026-02-20**
**Status: COMPLETE**

---

## Phase 1: Paragraph Prominence (HIGH IMPACT) [S]

- [x] 1.1 Update paragraph case in `ContentBlockRenderer.tsx` (line 91-98)
  - Remove `border-l-2 border-border/40` and `pl-3`
  - Change `text-muted-foreground` → `text-foreground/90`
  - Add `text-[15px] leading-[1.75]`
  - Use `block-paragraph` class on wrapper div
- [x] 1.2 Update unknown block fallback in `ContentBlockRenderer.tsx` (line 257-263)
  - Same paragraph style transformation
- [x] 1.3 Add `.block-paragraph` class in `index.css` (after `.block-inline`)

---

## Phase 2: Progressive Spacing (HIGH IMPACT) [M]

- [x] 2.1 Add spacing system to `block-layout.ts`
  - Add `SpacingCategory` type: `'prose' | 'list' | 'visual' | 'dense'`
  - Add `SPACING_CATEGORY_MAP` for all 33 block types
  - Add `getSpacingCategory()` function
  - Add `SPACING_MATRIX` with Tailwind margin-top classes
  - Add `getBlockSpacing()` function
- [x] 2.2 Update `ContentBlocks.tsx` for progressive spacing
  - Remove `<div className="space-y-3">` wrapper → `<div>`
  - Track `prevBlockType` across groups
  - Each block/group wrapper gets computed margin-top from `getBlockSpacing()`
  - First element gets no margin
  - Grid groups: margin-top on container, internal `gap-3` unchanged
  - Add `data-block-type` attribute on each block wrapper
- [x] 2.3 Update `StandardView.tsx`
  - Remove `<div className="space-y-3">` wrapper, render `<ContentBlocks>` directly

---

## Phase 3: Chapter Structure (MEDIUM IMPACT) [S]

- [x] 3.1 Update chapter title in `ArticleSection.tsx` (lines 180-190)
  - Title: `text-sm` → `text-base`, `text-foreground/70` → `text-foreground`, add `tracking-tight`
  - Move fade-divider below title (not inline)
  - Increase spacing: `mb-4 pt-1` → `mb-5 pt-2`
- [x] 3.2 Update chapter divider in `VideoDetailDesktop.tsx` (line 157)
  - `fade-divider my-6` → `chapter-divider my-8`
- [x] 3.3 Add chapter dividers in `VideoDetailMobile.tsx`
  - Add `{idx > 0 && <div className="chapter-divider my-8 mx-3" aria-hidden="true" />}` between chapters
- [x] 3.4 Add `.chapter-divider` class in `index.css`
  - Stronger gradient than `.fade-divider` (0.5 vs 0.3 opacity)

---

## Phase 4: Block Surface Differentiation (MEDIUM IMPACT) [S]

- [x] 4.1 Increase `.block-card` dark mode border visibility in `index.css`
  - Border: `oklch(from var(--border) l c h / 0.7)`
  - Stronger shadow
- [x] 4.2 Increase `.block-accent` background opacity in `index.css`
  - Light: 0.25 → 0.4
  - Dark: add dark variant at 0.35
- [x] 4.3 Add `pl-1` to `.block-inline` in `index.css`

---

## Phase 5: Half-Width Grid Tuning (POLISH) [S]

- [x] 5.1 Reclassify block sizes in `block-layout.ts` `BLOCK_SIZE_MAP`
  - callout: `half` → `full`
  - quote: `half` → `full`
  - definition: `half` → `full`
  - verdict: `half` → `full`
- [x] 5.2 Update tests in `block-layout.test.ts`
  - Update `getBlockSize('callout')` test: `'half'` → `'full'`
  - Update `getBlockSize('quote')` test: `'half'` → `'full'`
  - Update mixed blocks test: callout/quote/definition now group as `full`
  - Add tests for `getSpacingCategory()` and `getBlockSpacing()`

---

## Phase 6: View Section Spacing (POLISH) [S]

- [x] 6.1 Update all 9 custom views: `space-y-4` → `space-y-6`
  - CodeView.tsx
  - RecipeView.tsx
  - TravelView.tsx
  - ReviewView.tsx
  - FitnessView.tsx
  - EducationView.tsx
  - PodcastView.tsx
  - DIYView.tsx
  - GamingView.tsx

---

## Verification

- [x] V1. `cd apps/web && npx tsc --noEmit` passes
- [x] V2. `cd apps/web && npm run build` passes
- [x] V3. `cd apps/web && npm test` passes (29 block-layout tests, 1027 total)
- [x] V4. Visual check: paragraphs prominent (no left border, darker text, 15px)
- [x] V5. Visual check: spacing varies (tight prose, wide code gaps)
- [x] V6. Visual check: chapter titles pop, boundaries clear
- [x] V7. Visual check: dark mode card borders visible
- [x] V8. Visual check: mobile chapter dividers present (12 dividers for 13 chapters)
- [x] V9. Visual check: custom view section spacing looks right
- [x] V10. Visual check: light mode — accent blocks, paragraph contrast, dividers
- [x] V11. Visual check: mobile light mode — no horizontal overflow, proper rendering
