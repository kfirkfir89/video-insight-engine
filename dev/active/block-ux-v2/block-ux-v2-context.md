# Block UX V2 - Context

**Last Updated: 2026-02-11**
**Status: COMPLETE — All 34/34 tasks done, all tests passing. Ready to commit.**

---

## Implementation State

All 6 phases are fully implemented and verified:
- TypeScript: clean (`npx tsc --noEmit` passes)
- Unit tests: 982/982 pass (`cd apps/web && pnpm test -- --run`)
- Playwright E2E: 12/12 pass (`npx playwright test e2e/block-ux-v2.spec.ts`)
- **Changes are NOT yet committed** — all changes are unstaged

---

## Files Modified (21) + Created (3)

### CSS & Infrastructure
| File | Change |
|------|--------|
| `apps/web/src/index.css` | Removed card hover translateY, softened card header label, added `.block-label-minimal`, added `.table-fade-dividers` |
| `apps/web/vite.config.ts` | Added shiki/`@shikijs` to `manualChunks` as `vendor-shiki` |

### Blocks Switched to Transparent (12)
| File | Label Type | Icon |
|------|-----------|------|
| `blocks/ProConBlock.tsx` | No label (self-contained grid) | — |
| `blocks/DosDontsBlock.tsx` | No label (self-contained grid) | — |
| `blocks/ComparisonRenderer.tsx` | No label (self-contained grid) | — |
| `blocks/ExampleBlock.tsx` | No label (has code container) | — |
| `blocks/RatingBlock.tsx` | Minimal label | `Star` |
| `blocks/VerdictBlock.tsx` | Minimal label | `Award` (changed from `Scale`) |
| `blocks/LocationBlock.tsx` | Minimal label | `MapPin` |
| `blocks/NutritionBlock.tsx` | Minimal label | `Apple` |
| `blocks/GuestBlock.tsx` | Minimal label | `Users` (new import) |
| `blocks/ItineraryBlock.tsx` | Minimal label | `Route` (changed from `Calendar`) |
| `blocks/ExerciseBlock.tsx` | Minimal label | `Dumbbell` |
| `blocks/TableBlock.tsx` | No label (redesigned) | — |

### Quick Fixes
| File | Change |
|------|--------|
| `components/video-detail/ConceptHighlighter.tsx` | Lightbulb: `opacity-40` → `text-warning/60`, hover: `opacity-100` → `text-warning` |
| `blocks/ToolListBlock.tsx` | `Wrench` → `LayoutList` |
| `views/DIYView.tsx` | `Wrench` → `LayoutList`, `Hammer` → `ListOrdered` |

### Shiki Syntax Highlighting
| File | Change |
|------|--------|
| `apps/web/src/lib/syntax-highlighter.ts` | **NEW** — Shiki singleton, `getHighlighter()`, `highlightCode()` |
| `apps/web/src/hooks/use-syntax-highlight.ts` | **NEW** — React hook, returns `{ html, isLoading }`, uses `useTheme()` |
| `blocks/CodeBlock.tsx` | Integrated `useSyntaxHighlight`, renders Shiki HTML via `dangerouslySetInnerHTML` with `[&>pre]:!bg-transparent` |

### Tests
| File | Change |
|------|--------|
| `blocks/__tests__/code-block.test.tsx` | Added `vi.mock('@/hooks/use-syntax-highlight')` to avoid ThemeProvider dependency |
| `blocks/__tests__/table-block.test.tsx` | Updated icon test: expects 0 SVG icons (transparent variant has no header icon) |
| `apps/web/e2e/block-ux-v2.spec.ts` | **NEW** — 12 Playwright E2E tests for content-first flow |

---

## Key Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Card hover | Remove translateY, keep shadow only | Smooth flow without jumping |
| Display blocks | Switch to transparent | Merge with background for content-first reading |
| Interactive blocks | Keep card (7 blocks) | Cards bound interactive units (controls, checkboxes) |
| Concept tooltip color | `text-warning/60` → `text-warning` | Yellow/amber from design system, visible at rest |
| Tools icon | `LayoutList` | Generic structured-list icon works for all domains |
| Instructions icon | `ListOrdered` | Generic ordered-list icon, not DIY-specific |
| Syntax highlighting | Shiki (WASM) | VS Code-quality, Vite-native, lazy-loadable |
| Shiki themes | `github-dark` / `github-light` | Match light/dark mode via `useTheme()` |
| Table dividers | CSS `border-image` with gradient | Reuses fade-edge pattern from existing `fade-divider` |
| Minimal labels | New `.block-label-minimal` CSS class | Lightweight, disabled-looking, icon + text |
| VerdictBlock icon | `Scale` → `Award` | Award is more fitting for verdict context |
| ItineraryBlock icon | `Calendar` → `Route` | Route fits travel itinerary better |
| ExampleBlock copy button | Moved inline into code container | Copy button was in card header; transparent variant has no header, so moved it inline |

---

## Tricky Issues Solved

### 1. CodeBlock Test Failures (16 tests)
**Problem:** `useSyntaxHighlight` hook calls `useTheme()` which throws `useTheme must be used within ThemeProvider` in test environment.
**Solution:** Mock the hook at module level:
```tsx
vi.mock('@/hooks/use-syntax-highlight', () => ({
  useSyntaxHighlight: () => ({ html: null, isLoading: false }),
}));
```

### 2. TableBlock Test Update
**Problem:** Test "should have aria-hidden on header icon" expected SVG icons but we intentionally removed the Table2 header icon.
**Solution:** Changed test to "should render without header icons (transparent variant)" expecting `icons.length === 0`.

### 3. ExampleBlock Restructuring
**Problem:** After removing card header, `Code2` import and `defaultCopyButton` were unused. Copy button was rendered via `headerExtra` prop on BlockWrapper, but transparent variant doesn't render headers.
**Solution:** Removed `Code2` import, moved copy button inline into the code container's header bar (next to language/filename label).

### 4. Playwright E2E Timing
**Problem:** Initial E2E tests had 8/12 failures — `getByRole('heading', { name: 'Design System' })` timed out on design system page.
**Solution:** Used `waitUntil: 'networkidle'`, text-based locator (`text=Design System`), and 15000ms timeout. All 12 tests then passed.

### 5. Shiki Background Stripping
**Problem:** Shiki generates `<pre>` with its own background color, conflicting with existing code container styling.
**Solution:** Applied `[&>pre]:!bg-transparent` on the Shiki HTML container to strip Shiki's default background while keeping code container background.

---

## Blocks That Keep Card Variant (Interactive - DO NOT change)

| Block | Why |
|-------|-----|
| `IngredientBlock` | Servings +/- controls, ingredient checkboxes |
| `StepBlock` | Step completion checkboxes |
| `WorkoutTimerBlock` | Timer start/pause/reset controls |
| `QuizBlock` | Answer selection, reveal toggle |
| `FileTreeBlock` | Expandable/collapsible tree |
| `TranscriptBlock` | Clickable timestamps, expandable |
| `CostBlock` | Expandable cost notes |

---

## Next Steps (if continuing this work)

1. **Commit the changes** — all 21 modified + 3 new files
2. **Optional: Visual review** — run `cd apps/web && pnpm dev` and check design system page at `/dev/design-system`
3. **Optional: Consider more blocks** — if new block types are added, apply the same transparent/card decision criteria
4. **The plan file** at `~/.claude/plans/mossy-kindling-willow.md` is now outdated (was pre-implementation) — can be ignored

---

## Commands to Verify

```bash
# TypeScript
cd apps/web && npx tsc --noEmit

# Unit tests
cd apps/web && pnpm test -- --run

# E2E tests (requires dev server running or Playwright's webServer config)
cd apps/web && npx playwright test e2e/block-ux-v2.spec.ts

# Dev server for visual review
cd apps/web && pnpm dev
# Then visit http://localhost:5173/dev/design-system
```
