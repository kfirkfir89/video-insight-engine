# Block Simplification — Tasks

Last Updated: 2026-03-09

## Phase 1: Remove FormulaBlock [S] ✅

- [x] 1.1 Delete `FormulaBlock.tsx`
- [x] 1.2 Remove `FormulaBlock` interface from `packages/types/src/index.ts`
- [x] 1.3 Remove formula from `block-schemas.ts`
- [x] 1.4 Remove formula from `block-labels.ts`
- [x] 1.5 Remove formula export from `blocks/index.ts`
- [x] 1.6 Remove `case 'formula':` from `ContentBlockRenderer.tsx`
- [x] 1.7 Remove formula factory + sample from `mock-blocks.ts`
- [x] 1.8 Remove formula from `BlockShowcase.tsx` groups
- [x] 1.9 Remove formula from backend prompts (chapter_summary, education persona, persona_system, education examples)
- [x] 1.10 Remove formula from `block_postprocessing.py` and `accuracy.py`
- [x] 1.11 Run tests: `cd apps/web && npm test` + `cd services/summarizer && pytest`

## Phase 2: Simplify Code Display [M] ✅

- [x] 2.1 Simplify `ExampleBlock.tsx` — remove variants, single dark bg design
- [x] 2.2 Remove `variant` pass-through in ContentBlockRenderer `case 'example':`
- [x] 2.3 Simplify `CodeBlock.tsx` — remove Shiki, plain monochrome with line numbers
- [x] 2.4 Delete `apps/web/src/hooks/use-syntax-highlight.ts`
- [x] 2.5 Delete `apps/web/src/lib/syntax-highlighter.ts`
- [x] 2.6 Remove `shiki` from `apps/web/package.json`, run `pnpm install`
- [x] 2.7 Update mock-blocks if needed
- [x] 2.8 Run tests + type check

## Phase 3A: Merge Exercise + WorkoutTimer → FitnessBlock [M] ✅

- [x] 3A.1 Create `FitnessBlock.tsx` with exercises + timer sections
- [x] 3A.2 Update ContentBlockRenderer: route `exercise` and `workout_timer` to FitnessBlock
- [x] 3A.3 Delete `ExerciseBlock.tsx` and `WorkoutTimerBlock.tsx`
- [x] 3A.4 Update `blocks/index.ts` exports
- [x] 3A.5 Update tests for FitnessBlock (renamed imports in exercise-block.test + workout-timer-block.test)
- [x] 3A.6 Update `BlockShowcase.tsx` groups

## Phase 3B: Merge ToolList + Ingredient → ChecklistBlock [M] ✅

- [x] 3B.1 Create `ChecklistBlock.tsx` with shared checkbox logic + optional serving scaler
- [x] 3B.2 Update ContentBlockRenderer: route `tool_list` and `ingredient` to ChecklistBlock
- [x] 3B.3 Delete `ToolListBlock.tsx` and `IngredientBlock.tsx`
- [x] 3B.4 Update `blocks/index.ts` exports
- [x] 3B.5 Update tests for ChecklistBlock (renamed imports in ingredient-block.test)
- [x] 3B.6 Update `BlockShowcase.tsx` groups

## Phase 3C: Merge Numbered + Step → StepBlock [M] ✅

- [x] 3C.1 Add `simple?: boolean` prop to StepBlock (non-interactive circles, no duration/tips)
- [x] 3C.2 Update ContentBlockRenderer: `case 'numbered':` adapts strings to step format with `simple` flag
- [x] 3C.3 Remove `ordered` path from `ListBlock.tsx` (bullets-only)
- [x] 3C.4 Update tests for StepBlock (add simple mode tests)
- [x] 3C.5 Update tests for ListBlock (removed ordered tests)

## Phase 3 Completion ✅

- [x] 3.7 Run full test suite: `cd apps/web && npm test`
- [x] 3.8 Type check: `cd apps/web && npx tsc --noEmit`

## Phase 4: Redesign DesignSystemPage [M] ✅

- [x] 4.1 Convert `DesignSystemPage.tsx` to tab-based section switching (no scrolling)
- [x] 4.2 Remove scroll-to-section logic and back-to-top button
- [x] 4.3 Add variation tabs to `BlockShowcase.tsx` for blocks with variants (callout, comparison, quote)
- [x] 4.4 Update design system test if needed
- [x] 4.5 Visual verification via Playwright e2e tests

## Final Verification ✅

- [x] All unit tests pass — 1070/1070 (53 files)
- [x] All E2E tests pass — 136/136 (Playwright)
- [x] Output layout e2e tests pass — 19/19 (overflow, responsivity, accessibility)
- [x] Type check passes (`tsc --noEmit` clean)
- [x] `shiki` removed from dependencies (-15 packages)
