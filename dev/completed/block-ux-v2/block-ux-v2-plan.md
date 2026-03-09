# Block UX V2 - Content-First Flow Design

**Last Updated: 2026-02-11**

---

## Executive Summary

Evolve the block component system from its current card-heavy layout to a content-first reading experience. Most blocks should merge seamlessly with the background - only interactive blocks (ingredients, steps, quizzes) retain card wrapping. Additionally: make concept tooltips visible (yellow), fix domain-specific icons, add real syntax highlighting to code blocks, and redesign tables with fade-edge dividers.

**Predecessor:** `design-system-ux-overhaul` (100% complete) established the foundation. This task refines the visual flow.

---

## Current State Analysis

### Problems
1. **Card hover jump** - `.block-card:hover` applies `translateY(-1px)` to ALL card blocks, breaking reading flow
2. **Too many cards** - 19 blocks use `variant="card"`, creating a wall of boxes instead of flowing content
3. **Invisible concept tooltips** - Lightbulb icon uses `opacity-40` (barely visible)
4. **Domain-specific icons** - `Wrench` for tools (too DIY), `Hammer` for instructions (too construction)
5. **No syntax highlighting** - CodeBlock renders monochrome plain text with line numbers
6. **Poor table design** - Solid faint borders, no vertical dividers, no fade-edge effect, card wrapping

### What Works Well
- BlockWrapper variant system (card/inline/accent/code/transparent)
- Semantic color tokens and OKLCH system
- Dark mode glow effects and premium CSS utilities
- Fade-divider pattern already exists for horizontal/vertical gradients

---

## Proposed Future State

- **Blocks flow with the page** - no jumpy hover, minimal wrapping
- **Cards only for interactive units** - servings control, checkboxes, timer, quiz
- **Display blocks merge with background** - transparent variant with minimal inline labels
- **Concept tooltips pop** - yellow/amber lightbulb visible at rest
- **Generic icons** - work across all video categories
- **Code blocks look like VS Code** - full Shiki syntax highlighting per language
- **Tables are clean data** - fade-edge dividers on inner lines only, no border box

---

## Implementation Phases

### Phase 1: CSS Foundation (Effort: S)
**File: `apps/web/src/index.css`**

1. Remove `transform: translateY(-1px)` from `.block-card:hover` (light + dark)
2. Remove `transform` from `.block-card` transition
3. Keep subtle shadow-only hover
4. Add `.block-label-minimal` utility class
5. Soften `.block-card-header-label` (font-medium, tracking-wider, 70% opacity)
6. Add `.table-fade-dividers` family of CSS rules

**Acceptance:** Card blocks no longer jump on hover. New CSS classes available.

### Phase 2: Block Variant Switches (Effort: L)
**12 blocks switch from card to transparent**

Switch to `variant="transparent"` and add minimal inline labels where needed:
- ProConBlock, DosDontsBlock, ComparisonRenderer (self-contained layouts, no label needed)
- RatingBlock, VerdictBlock, LocationBlock, NutritionBlock (add minimal label)
- GuestBlock, ItineraryBlock, ExerciseBlock (add minimal label)
- ExampleBlock (has inner code container)
- TableBlock (redesigned in Phase 6)

**Keep `variant="card"`:** IngredientBlock, StepBlock, WorkoutTimerBlock, QuizBlock, FileTreeBlock, TranscriptBlock, CostBlock

**Acceptance:** Display-only blocks merge with background. Interactive blocks retain cards.

### Phase 3: Quick Visual Fixes (Effort: S)
**3 independent changes**

1. **Concept tooltip** (`ConceptHighlighter.tsx` line 161): `opacity-40` → `text-warning/60`, hover → `text-warning`
2. **Tools icon** (`ToolListBlock.tsx`, `DIYView.tsx`): `Wrench` → `LayoutList`
3. **Instructions icon** (`DIYView.tsx` line 134): `Hammer` → `ListOrdered`

**Acceptance:** Yellow lightbulb visible at rest. Generic icons work for all video types.

### Phase 4: Shiki Syntax Highlighting (Effort: L)
**New dependency + 2 new files + 2 modified files**

1. Install `shiki` package
2. Create `apps/web/src/lib/syntax-highlighter.ts` - singleton highlighter
3. Create `apps/web/src/hooks/use-syntax-highlight.ts` - React hook
4. Update `apps/web/src/components/video-detail/blocks/CodeBlock.tsx` - integrate Shiki
5. Update `apps/web/vite.config.ts` - manual chunks for Shiki

**Acceptance:** Code blocks show per-language syntax colors. Falls back to plain text while loading.

### Phase 5: Table Redesign (Effort: M)
**File: `apps/web/src/components/video-detail/blocks/TableBlock.tsx`**

1. Switch to `variant="transparent"`
2. Remove card header, glass-surface, alternating rows
3. Apply `table-fade-dividers` class
4. Soften header styling to `font-medium text-muted-foreground/50`

**Acceptance:** Table has fade-edge dividers on inner lines only, no outer border, clean readable layout.

### Phase 6: Verification (Effort: S)

1. Visual check - dev server, diverse video types, light + dark mode
2. Run existing test suite
3. Check design system page showcase
4. Verify mobile/tablet responsiveness

---

## Execution Dependencies

```
Phase 1 (CSS) ──→ Phase 2 (Variant switches)
                 └──→ Phase 5 (Table uses CSS from Phase 1)
Phase 3 (Quick fixes) ── independent, can run in parallel
Phase 4 (Shiki) ── independent, can run in parallel
Phase 6 (Verification) ── runs after all phases complete
```

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Blocks lose visual structure when switching to transparent | Medium | Add `.block-label-minimal` inline labels; blocks with inner containers are self-sufficient |
| Shiki bundle size (~500KB) | Low | Lazy-loaded via manualChunks, async hook with fallback |
| `border-image` table dividers browser compat | Low | Well-supported in modern browsers; test in Chrome/Firefox/Safari |
| Tests fail after variant switches | Medium | Run test suite after Phase 2; fix any snapshot/class assertions |

---

## Success Metrics

1. **0 card hover jumps** - no translateY on any block hover
2. **7 card blocks** (interactive only), **12 blocks transparent** (merged with background)
3. **Yellow concept tooltips** visible without hovering
4. **Syntax-colored code** for JS, TS, Python, Bash, JSON, HTML, CSS
5. **Table fade dividers** on inner lines, no outer border
6. **All existing tests pass**

---

## Task Count

| Phase | Tasks | Effort |
|-------|-------|--------|
| Phase 1: CSS Foundation | 6 | S |
| Phase 2: Variant Switches | 12 | L |
| Phase 3: Quick Fixes | 3 | S |
| Phase 4: Shiki Highlighting | 5 | L |
| Phase 5: Table Redesign | 4 | M |
| Phase 6: Verification | 4 | S |
| **Total** | **34** | **~3-4 days** |
