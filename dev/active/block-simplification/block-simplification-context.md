# Block Simplification — Context

Last Updated: 2026-03-09

## Status: COMPLETE — Ready to commit

All 4 phases are done. All tests pass. Ready for `/complete-task block-simplification`.

## Test Results

| Check | Result |
|-------|--------|
| TypeScript (`tsc --noEmit`) | Clean |
| Unit tests (Vitest) | 1070/1070 passed (53 files) |
| E2E output-layout tests | 19/19 passed |
| Full E2E suite (Playwright) | 136/136 passed |

## What Changed

### Files Deleted (Frontend)
- `FormulaBlock.tsx` — unused block
- `ExerciseBlock.tsx` — merged into FitnessBlock
- `WorkoutTimerBlock.tsx` — merged into FitnessBlock
- `ToolListBlock.tsx` — merged into ChecklistBlock
- `IngredientBlock.tsx` — merged into ChecklistBlock
- `use-syntax-highlight.ts` — Shiki hook
- `syntax-highlighter.ts` — Shiki singleton
- `formula-block.test.tsx` — test for removed component

### Files Created (Frontend)
- `FitnessBlock.tsx` — unified exercise + timer (dispatch by `block.type`)
- `ChecklistBlock.tsx` — unified tool list + ingredient (shared `useCheckedSet` hook)

### Files Modified (Frontend)
- `ContentBlockRenderer.tsx` — updated routing for all merges (27 block types, down from 29)
- `blocks/index.ts` — updated barrel exports
- `CodeBlock.tsx` — removed Shiki, plain monochrome rendering
- `ExampleBlock.tsx` — removed `terminal_command` variant, single dark design
- `StepBlock.tsx` — added `simple?: boolean` prop for numbered items
- `ListBlock.tsx` — removed `ordered` prop, bullets-only
- `DesignSystemPage.tsx` — rewritten to tab-based navigation
- `BlockShowcase.tsx` — removed formula from groups, updated descriptions
- `block-schemas.ts` — removed formula schema entry
- `block-labels.ts` — removed formula label
- `mock-blocks.ts` — removed formula factory + sample
- `mock-videos.ts` — replaced formula blocks with callout blocks
- `package.json` — removed `shiki` dependency

### Files Modified (Types)
- `packages/types/src/index.ts` — removed `FormulaBlock` interface from `ContentBlock` union

### Files Modified (Backend)
- `chapter_summary.txt` — removed formula block definition, mapping, decision tree
- `education.txt` (persona) — removed formula references
- `persona_system.txt` — removed formula from preferred blocks
- `education.txt` (examples) — removed formula JSON examples
- `block_postprocessing.py` — removed formula from VIEW_SIGNATURE_BLOCKS and CATEGORY_BLOCKS
- `accuracy.py` — changed formula reference to equations

### Tests Updated
- `exercise-block.test.tsx` — imports FitnessBlock instead of ExerciseBlock
- `workout-timer-block.test.tsx` — imports FitnessBlock instead of WorkoutTimerBlock
- `ingredient-block.test.tsx` — imports ChecklistBlock instead of IngredientBlock
- `code-block.test.tsx` — removed Shiki mock
- `list-block.test.tsx` — removed ordered tests
- `mock-blocks.test.ts` — removed formula from expected types

## Key Decisions

1. **Wire types unchanged** — `exercise`, `workout_timer`, `tool_list`, `ingredient`, `numbered`, `step` block types remain in API/SSE. Only frontend component routing changes.
2. **Data adaptation in ContentBlockRenderer** — Follow existing pattern (do_dont → ComparisonRenderer, pro_con → ComparisonRenderer).
3. **Shiki fully removed** — ~2MB dependency. Both `code` and `example` blocks use plain monochrome.
4. **Design system tab-based** — Section switching (not scrolling), variation tabs per block.
5. **Package manager** — Must use `pnpm install` from root (not npm) due to `workspace:^` protocol.

## Uncommitted Changes

All changes are unstaged. Run `git add` + `git commit` to persist. No temporary workarounds — all changes are permanent.
