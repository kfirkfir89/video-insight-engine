# Block UX V2 - Task Checklist

**Last Updated: 2026-02-11**
**Status: COMPLETE**

---

## Phase 1: CSS Foundation [6/6]

- [x] **1.1** Remove `transform: translateY(-1px)` from `.block-card:hover` in `index.css` (light mode)
  - *AC: Card blocks no longer translate on hover*
- [x] **1.2** Remove `transform` from `.block-card` transition property (keep `box-shadow` only)
  - *AC: `transition: box-shadow 0.2s ease` only*
- [x] **1.3** Update `.block-card:hover` dark mode to remove transform, keep shadow + subtle glow
  - *AC: Dark mode hover has no translateY*
- [x] **1.4** Add `.block-label-minimal` class: `flex items-center gap-1.5 text-[11px] text-muted-foreground/40 mb-2 font-medium tracking-[0.05em]` + child svg sizing
  - *AC: Class renders lightweight disabled-style label with small icon*
- [x] **1.5** Soften `.block-card-header-label`: `font-semibold tracking-widest` → `font-medium tracking-wider`, color at 70% opacity
  - *AC: Card headers look lighter, less dominant*
- [x] **1.6** Add `.table-fade-dividers` CSS rules: horizontal fade between rows, vertical fade between columns, header bottom separator
  - *AC: Table inner lines have gradient fade-from-edges effect*

## Phase 2: Block Variant Switches [12/12]

### No-Label Switches (self-contained layouts)
- [x] **2.1** `ProConBlock.tsx`: `variant="card"` → `variant="transparent"`, remove `headerIcon`/`headerLabel`
  - *AC: Block merges with background, inner grid layout provides structure*
- [x] **2.2** `DosDontsBlock.tsx`: `variant="card"` → `variant="transparent"`, remove header props
  - *AC: Block merges with background*
- [x] **2.3** `ComparisonRenderer.tsx`: `variant="card"` → `variant="transparent"`, remove header props
  - *AC: Block merges with background*
- [x] **2.4** `ExampleBlock.tsx`: `variant="card"` → `variant="transparent"` (default variant only, keep code variant)
  - *AC: Default example merges; code variant still uses code container*

### Minimal-Label Switches (add `.block-label-minimal`)
- [x] **2.5** `RatingBlock.tsx`: → `variant="transparent"`, add minimal label with `Star` icon + "Rating"
  - *AC: Rating merges with background, small muted label above*
- [x] **2.6** `VerdictBlock.tsx`: → `variant="transparent"`, add minimal label with `Award` icon + "Verdict"
  - *AC: Verdict merges with background, small muted label above*
- [x] **2.7** `LocationBlock.tsx`: → `variant="transparent"`, add minimal label with `MapPin` icon + "Location"
  - *AC: Location merges with background, small muted label above*
- [x] **2.8** `NutritionBlock.tsx`: → `variant="transparent"`, add minimal label with `Apple` icon + "Nutrition"
  - *AC: Nutrition merges with background, small muted label above*
- [x] **2.9** `GuestBlock.tsx`: → `variant="transparent"`, add minimal label with `Users` icon + "Guests"
  - *AC: Guest cards merge with background, small muted label above*
- [x] **2.10** `ItineraryBlock.tsx`: → `variant="transparent"`, add minimal label with `Route` icon + "Itinerary"
  - *AC: Itinerary merges with background, small muted label above*
- [x] **2.11** `ExerciseBlock.tsx`: → `variant="transparent"`, add minimal label with `Dumbbell` icon + "Exercises"
  - *AC: Exercise cards merge with background, small muted label above*
- [x] **2.12** `TableBlock.tsx`: → `variant="transparent"`, remove header (redesigned in Phase 5)
  - *AC: Table has no outer card border or card header*

## Phase 3: Quick Visual Fixes [3/3]

- [x] **3.1** `ConceptHighlighter.tsx` line 161: Change lightbulb from `opacity-40 group-hover/concept:opacity-100 transition-opacity` to `text-warning/60 group-hover/concept:text-warning transition-colors`
  - *AC: Lightbulb is yellow/amber visible at rest, full yellow on hover*
- [x] **3.2** `ToolListBlock.tsx`: Replace `Wrench` import → `LayoutList`, update icon usage (line 42)
  - *AC: Tools header shows generic LayoutList icon*
- [x] **3.3** `DIYView.tsx`: Replace `Wrench` → `LayoutList` (line 87), replace `Hammer` → `ListOrdered` (line 134)
  - *AC: DIY view uses generic icons for Tools and Instructions sections*

## Phase 4: Shiki Syntax Highlighting [5/5]

- [x] **4.1** Install `shiki` package: `cd apps/web && pnpm add shiki`
  - *AC: shiki appears in package.json dependencies*
- [x] **4.2** Create `apps/web/src/lib/syntax-highlighter.ts`: singleton highlighter, pre-load common langs (js, ts, python, bash, json, html, css), async `highlightCode()` function with `github-dark`/`github-light` themes
  - *AC: Module exports `getHighlighter()` and `highlightCode()` functions*
- [x] **4.3** Create `apps/web/src/hooks/use-syntax-highlight.ts`: React hook using `highlightCode()`, returns `{ html: string | null, isLoading: boolean }`, uses `useTheme()` for dark/light detection
  - *AC: Hook returns highlighted HTML async, null while loading*
- [x] **4.4** Update `CodeBlock.tsx`: Use `useSyntaxHighlight` hook, render Shiki HTML via `dangerouslySetInnerHTML` when available, keep existing plain-text as fallback, strip Shiki's default pre/code bg (use existing code container bg)
  - *AC: Code blocks show per-language syntax colors. Falls back to plain text while Shiki loads*
- [x] **4.5** Update `vite.config.ts`: Add shiki/`@shikijs` to `manualChunks` as `vendor-shiki`
  - *AC: Shiki is in separate lazy-loaded chunk, not in main bundle*

## Phase 5: Table Redesign [4/4]

- [x] **5.1** `TableBlock.tsx`: Remove `glass-surface` class from thead `<tr>`
  - *AC: Table header has no frosted glass background*
- [x] **5.2** `TableBlock.tsx`: Change `<th>` styling from `font-bold uppercase tracking-wider` to `font-medium text-muted-foreground/50`
  - *AC: Table headers are soft, muted, not dominant*
- [x] **5.3** `TableBlock.tsx`: Remove `divide-y divide-border/20` from `<tbody>`, remove `even:bg-muted/[0.08]` alternating rows
  - *AC: No solid dividers or zebra striping*
- [x] **5.4** `TableBlock.tsx`: Add `table-fade-dividers` class to `<table>` element
  - *AC: Fade-edge gradient dividers on inner horizontal and vertical lines*

## Phase 6: Verification [4/4]

- [x] **6.1** Visual check: Start dev server, open video detail page with diverse block types, verify content-first flow
  - *AC: Blocks flow smoothly, no card jumps, display blocks merge with background*
- [x] **6.2** Run test suite: `cd apps/web && pnpm test` — 982/982 tests pass
  - *AC: All existing tests pass (0 regressions)*
- [x] **6.3** Dark mode check: Verified via Playwright E2E tests
  - *AC: Yellow tooltips, syntax highlighting, table dividers all work in dark mode*
- [x] **6.4** Design system page: Verified via Playwright E2E tests (12/12 pass)
  - *AC: All blocks display properly in showcase*

---

## Progress Summary

| Phase | Done | Total | % |
|-------|------|-------|---|
| Phase 1: CSS Foundation | 6 | 6 | 100% |
| Phase 2: Variant Switches | 12 | 12 | 100% |
| Phase 3: Quick Fixes | 3 | 3 | 100% |
| Phase 4: Shiki Highlighting | 5 | 5 | 100% |
| Phase 5: Table Redesign | 4 | 4 | 100% |
| Phase 6: Verification | 4 | 4 | 100% |
| **Total** | **34** | **34** | **100%** |
