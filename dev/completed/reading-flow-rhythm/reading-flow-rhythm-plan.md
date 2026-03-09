# Reading Flow & Visual Rhythm Overhaul

**Last Updated: 2026-02-20**

---

## Executive Summary

The article reading experience — the most important UX surface in the system — feels disconnected. Blocks are uniformly spaced, paragraphs are styled as dim metadata, chapter boundaries blur together, and dark mode card borders are invisible. This task fixes the rendering layer (not taxonomy or architecture) across 6 phases to create a well-typeset reading experience.

**Impact**: Every video detail page benefits. Paragraphs appear in 100% of chapters.

---

## Current State Analysis

### Problems Identified (User Feedback)
1. **Paragraphs look like blockquotes** — `text-muted-foreground` + `border-l-2 border-border/40` makes primary reading content look like secondary metadata
2. **Flat spacing** — Every gap is `space-y-3` (12px). No rhythm between prose→code→dense blocks
3. **Chapter titles are invisible** — `text-sm text-foreground/70` is same size as block text, dimmed
4. **Dark mode cards invisible** — Border opacity too low, accent backgrounds ghostly
5. **Text-heavy blocks crammed side-by-side** — callout/quote/definition/verdict in `half` width interrupts reading flow
6. **Section-level spacing too tight** — `space-y-4` between major sections (ingredients→steps) needs more breathing room

### Key Files (Current State)
| File | Lines | Current Issue |
|------|-------|--------------|
| `ContentBlockRenderer.tsx` | 269 | Paragraph styled as `text-muted-foreground` with left border |
| `ContentBlocks.tsx` | 89 | Uniform `space-y-3` wrapper, no progressive spacing |
| `block-layout.ts` | 100 | Only size classification, no spacing system |
| `ArticleSection.tsx` | 223 | Chapter title `text-sm text-foreground/70`, fade-divider inline |
| `VideoDetailDesktop.tsx` | 207 | Chapter divider uses `fade-divider my-6` (too subtle) |
| `VideoDetailMobile.tsx` | 173 | No chapter dividers between chapters |
| `index.css` | ~1125 | Block styles exist but missing paragraph, chapter-divider classes |
| `StandardView.tsx` | 44 | Wraps ContentBlocks in redundant `space-y-3` |
| 9 custom views | ~80 each | All use `space-y-4` between sections |

---

## Proposed Future State

A reading experience with:
- **Prominent paragraphs**: Darker text (foreground/90), larger (15px), generous line-height (1.75), no decorative border
- **Progressive spacing**: Tight between paragraphs (8px), wide before/after code blocks (20px), compact between dense items (8px)
- **Clear chapter structure**: Larger title (text-base), full contrast, fade-divider below title, stronger chapter-divider between chapters
- **Visible dark mode surfaces**: Higher border opacity, stronger accent backgrounds, subtle shadow increase
- **Proper block widths**: callout/quote/definition/verdict promoted to full-width (text-heavy blocks shouldn't be side-by-side)
- **Section breathing room**: `space-y-6` between major view sections

---

## Implementation Phases

### Phase 1: Paragraph Prominence (HIGH IMPACT, Size: S)

**Rationale**: Single highest-impact change. Paragraphs appear in 100% of chapters but are styled as dim metadata.

**Changes**:
1. `ContentBlockRenderer.tsx` line 91-98 — Remove `border-l-2 border-border/40`, change `text-muted-foreground` to `text-foreground/90`, add `text-[15px] leading-[1.75]`, use `block-paragraph` class
2. `ContentBlockRenderer.tsx` line 257-263 — Same transformation for unknown block fallback
3. `index.css` — Add `.block-paragraph` class (minimal CSS hook)

**Acceptance Criteria**:
- Paragraphs render with darker text, no left border
- Unknown text blocks also get the new style
- No visual regression for other block types

---

### Phase 2: Progressive Spacing (HIGH IMPACT, Size: M)

**Rationale**: Most impactful structural change. Creates reading rhythm instead of flat uniform gaps.

**Changes**:
1. `block-layout.ts` — Add `SpacingCategory` type, `SPACING_CATEGORY_MAP`, `getSpacingCategory()`, `SPACING_MATRIX`, `getBlockSpacing()` exports
2. `ContentBlocks.tsx` — Remove `space-y-3` wrapper, track `prevBlockType`, compute margin-top per block/group from `getBlockSpacing()`, add `data-block-type` attribute
3. `StandardView.tsx` — Remove `<div className="space-y-3">` wrapper, render `<ContentBlocks>` directly

**Spacing Categories**:
- `prose`: paragraph
- `list`: bullets, numbered, do_dont, definition, tool_list
- `visual`: code, terminal, file_tree, comparison, example, table, timeline, itinerary, step, ingredient, exercise, workout_timer, location, quiz, transcript, pro_con, cost, nutrition, guest, formula
- `dense`: callout, quote, statistic, keyvalue, timestamp, rating, verdict

**Spacing Matrix** (Tailwind margin-top classes):
| prev\curr | prose | list | visual | dense |
|-----------|-------|------|--------|-------|
| prose     | mt-2  | mt-3 | mt-5   | mt-3  |
| list      | mt-3  | mt-3 | mt-5   | mt-3  |
| visual    | mt-5  | mt-5 | mt-4   | mt-4  |
| dense     | mt-3  | mt-3 | mt-4   | mt-2  |

**Acceptance Criteria**:
- Paragraph→paragraph gap is tight (~8px)
- Paragraph→code gap is wide (~20px)
- Dense→dense gap is compact (~8px)
- First block has no top margin
- Grid groups get margin on container, internal `gap-3` unchanged
- `data-block-type` attribute visible in DOM for debugging

---

### Phase 3: Chapter Structure (MEDIUM IMPACT, Size: S)

**Rationale**: Chapter boundaries are invisible — titles are too small and dividers too subtle.

**Changes**:
1. `ArticleSection.tsx` lines 180-190 — Title: `text-sm` → `text-base`, `text-foreground/70` → `text-foreground`, add `tracking-tight`. Move fade-divider below title (not inline). Increase spacing: `mb-5 pt-2`
2. `VideoDetailDesktop.tsx` line 157 — Change `fade-divider my-6` to `chapter-divider my-8`
3. `VideoDetailMobile.tsx` — Add `chapter-divider my-8 mx-3` between chapters (currently missing)
4. `index.css` — Add `.chapter-divider` class with stronger gradient (0.5 vs 0.3 opacity)

**Acceptance Criteria**:
- Chapter titles are clearly larger than body text
- Fade-divider appears below title, not inline
- Desktop: stronger chapter dividers with more breathing room
- Mobile: chapter dividers now present

---

### Phase 4: Block Surface Differentiation (MEDIUM IMPACT, Size: S)

**Rationale**: Dark mode blocks are nearly invisible.

**Changes**:
1. `index.css` — `.block-card` dark mode: increase border to `oklch(from var(--border) l c h / 0.7)`, stronger shadow
2. `index.css` — `.block-accent`: increase background opacity (0.4 light, 0.35 dark)
3. `index.css` — `.block-inline`: add `pl-1` for subtle hierarchy indent

**Acceptance Criteria**:
- Dark mode card borders clearly visible
- Accent blocks have visible background tint in both modes
- Inline blocks have subtle left padding for hierarchy

---

### Phase 5: Half-Width Grid Tuning (POLISH, Size: S)

**Rationale**: Text-heavy blocks crammed side-by-side interrupts reading.

**Changes**:
1. `block-layout.ts` — Move callout, quote, definition, verdict from `half` to `full` in `BLOCK_SIZE_MAP`
2. `block-layout.test.ts` — Update affected tests, add spacing system tests

**Keep as `half`**: pro_con, cost, nutrition, guest, formula, rating (data-dense, work well side-by-side)

**Acceptance Criteria**:
- callout/quote/definition/verdict render full-width
- Existing `half` blocks (pro_con, cost, etc.) unchanged
- All tests pass

---

### Phase 6: View Section Spacing (POLISH, Size: S)

**Rationale**: Section boundaries in custom views need more breathing room.

**Changes**:
1. All 9 custom views: Change outer `space-y-4` → `space-y-6`

**Acceptance Criteria**:
- More visible gap between major sections (e.g., ingredients → narrative → steps)
- No overflow or layout issues

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Spacing values don't feel right | Medium | Low | All values in Tailwind classes, easy to tune |
| Grid group spacing conflicts with new system | Low | Medium | Grid containers get margin-top, internal gap unchanged |
| Dark mode surface changes too strong | Low | Low | Use oklch relative colors, easy to dial back |
| Test failures from size reclassification | Expected | Low | Plan includes specific test updates |
| Streaming scenario breaks | Low | High | `data-block-type` and progressive spacing tested with streaming test case |

---

## Success Metrics

1. **Paragraphs are clearly dominant text** — darker, 15px, no decorative border
2. **Spacing varies by context** — tight prose, wide code gaps, compact dense blocks
3. **Chapter titles pop** — 16px, full contrast, clear boundaries
4. **Dark mode surfaces visible** — card borders, accent tints present
5. **Text-heavy blocks full-width** — callout/quote/definition/verdict not crammed
6. **TypeScript passes** — `npx tsc --noEmit`
7. **Build passes** — `npm run build`
8. **All tests pass** — `npm test`

---

## Dependencies

- No external dependencies
- No new packages
- No multi-service changes
- No LLM prompt changes
- All changes are in `apps/web/`
- Phases can be committed incrementally but should ship as one cohesive change

---

## Deferred Items

| Item | Reason |
|------|--------|
| Paragraph variants (lead/aside) | Needs LLM prompt changes, multi-service |
| Content-aware block sizing | Complexity; static reclassification covers 80% |
| View infrastructure extraction (useBlockPartition, ViewSection) | Code quality, not UX |
| Block consolidation (DosDonts/Comparison overlap) | Multi-service migration, zero UX impact |
| New block types | Not needed — 33 types sufficient |
