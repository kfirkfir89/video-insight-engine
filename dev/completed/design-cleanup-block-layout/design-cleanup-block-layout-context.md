# Design Cleanup + Block Layout — Context

Last Updated: 2026-02-19
Status: **COMPLETE** — All 10 phases done, verified with Playwright

---

## Key Files

### Track A: Design System Cleanup

| File | Purpose | Notes |
|------|---------|-------|
| `apps/web/src/components/ui/` | UI component library | 11 files to delete |
| `apps/web/src/index.css` | Global styles, tokens, CSS classes | Main edit target for phases 2-5, 10 |
| `apps/web/src/components/video-detail/blocks/TerminalBlock.tsx` | Terminal code block | 4 zinc refs to replace |
| `apps/web/src/components/video-detail/blocks/CodeBlock.tsx` | Code block | 2 zinc refs to replace |
| `apps/web/src/components/video-detail/blocks/ExampleBlock.tsx` | Example block | 4 zinc refs to replace |
| `apps/web/src/components/video-detail/blocks/BlockWrapper.tsx` | Block wrapper component | 1 zinc ref to replace |
| `apps/web/src/components/ui/checkbox.tsx` | Checkbox component | zinc border/bg refs |
| `.claude/skills/design-system/resources/tokens.md` | Design token documentation | Drifted from reality |
| `apps/web/package.json` | Frontend deps | Orphaned Radix deps to remove |

### Track B: Block Layout Redesign

| File | Purpose | Notes |
|------|---------|-------|
| `apps/web/src/components/video-detail/VideoDetailDesktop.tsx` | Desktop detail layout | Add max-w, chapter dividers |
| `apps/web/src/components/video-detail/ContentBlocks.tsx` | Block list renderer | Grid layout integration point |
| `apps/web/src/components/video-detail/ArticleSection.tsx` | Chapter/article section | Chapter title styling |
| `apps/web/src/components/video-detail/ContentBlockRenderer.tsx` | Block type switch | Paragraph refinement |
| `apps/web/src/components/video-detail/views/StandardView.tsx` | Standard category view | Spacing update |
| `apps/web/src/lib/block-layout.ts` | **NEW** — Block size classification & grouping | Core layout logic |
| `apps/web/src/lib/__tests__/block-layout.test.ts` | **NEW** — Tests for block layout | Unit tests |

---

## Key Decisions

### Track A Decisions
1. **Delete vs deprecate components**: Delete. Zero imports confirmed. No deprecation path needed.
2. **Zinc replacement strategy**: Semantic CSS custom properties (`--code-text`, `--code-muted`, `--code-dim`) scoped to `.block-code-container`. Avoids polluting global token namespace.
3. **Opacity scale**: 6 standard values (`/5`, `/10`, `/20`, `/40`, `/70`, `/90`). Not touching CSS-level `oklch()` values — only Tailwind utility opacities in `.tsx`.
4. **Category accent CSS**: Keep (60 lines, low cost) but add documentation comment.

### Track B Decisions
1. **Max width**: `820px` = ~75 chars/line at 16px. Centered with `mx-auto`.
2. **Grid classification**: Static map, not heuristic. Easy to adjust per-type.
3. **Grouping algorithm**: O(n) linear scan, buffers consecutive same-size blocks, streaming-safe.
4. **Single orphan handling**: Lone half/compact block renders full-width (graceful degradation).
5. **Category view compatibility**: Views already pre-filter blocks before passing to `ContentBlocks`. Grid operates on whatever array it receives — zero changes to view files.

---

## Dependencies

### External
- None. All changes are frontend-only within `apps/web/`.

### Internal
- Track A phases are fully independent (can run in any order)
- Track B Phase 6 must come first (establishes container constraints)
- Track B Phases 7, 10 are independent
- Track B Phases 8, 9 depend on Phase 6

### Related Tasks
- `design-system-ux-overhaul` — Completed. Created the current design tokens.
- `block-ux-v2` — Completed. Created the 31 block types.
- `frontend-refactor` — Completed. Component restructuring.
- `button-consistency` — Completed. Button standardization.

---

## Verification Strategy

### Per-Phase
1. `npm run build` passes
2. `npm test` in `apps/web` passes
3. Visual check on test videos

### Test URLs
- Coding video: `http://localhost:5173/video/6992fb549431316d4a59d1ed`
- Cooking video: `http://localhost:5173/video/69930f3c57188dc8205e1581`

### Visual Checks
- Wide screen (1920px): content constrained, not edge-to-edge
- Statistics blocks: 2-3 columns on desktop
- Code blocks: full-width
- Streaming: blocks progressively appear with correct grid
- Mobile (<768px): layout unchanged
- Dark mode: all tokens resolve correctly
- Chapter titles: visible as navigation landmarks

---

## Rollback Plan

Each phase is independently revertible via `git revert`. No phase depends on data migration or API changes. All changes are CSS/component-level in `apps/web/`.
