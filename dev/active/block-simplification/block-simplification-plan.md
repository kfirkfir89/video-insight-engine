# Block System Simplification & Design System Reorganization

Last Updated: 2026-03-09

## Executive Summary

Simplify the block component system by removing unused blocks (FormulaBlock), merging overlapping components (Exercise+Timer, ToolList+Ingredient, Numbered+Step), removing Shiki syntax highlighting in favor of simple monochrome code display, and reorganizing the design system dev page for better DX.

**Outcome:** Reduce from 32 to 27 block components, remove ~600 lines of redundant code, eliminate the shiki dependency (~2MB), and improve design system page usability.

---

## Current State

- 32 block component files in `apps/web/src/components/video-detail/blocks/`
- FormulaBlock renders raw LaTeX strings (no KaTeX) — effectively useless
- Exercise + WorkoutTimer are separate but both fitness-related
- ToolList + Ingredient are both checkbox lists with near-identical UX
- Numbered (ListBlock ordered) + Step are both step displays with different interactivity
- ExampleBlock has 2 variants (terminal_command + default) — unnecessary complexity
- CodeBlock uses Shiki (~2MB) for syntax highlighting — over-engineered for the use case
- Design system page scrolls through all sections — want tab-based switching

## Proposed Future State

- 27 block components (5 removed/merged)
- No Shiki dependency — code blocks use simple dark bg / light text
- FitnessBlock handles both exercises and workout timer
- ChecklistBlock handles both tool lists and ingredients
- StepBlock handles both numbered lists and interactive steps
- Design system page shows one section at a time with tab navigation
- Block variations shown via tab bar per block card

---

## Implementation Phases

### Phase 1: Remove FormulaBlock (Low risk, no dependencies)
- Delete component, remove from all registries (types, schemas, labels, renderer, mocks, showcase)
- Remove from backend prompts and services
- Cached data degrades gracefully (renderer returns null for unknown types)

### Phase 2: Simplify Code Display (Medium risk, self-contained)
- Simplify ExampleBlock to single variant (dark bg, white text)
- Simplify CodeBlock by removing Shiki, using plain monochrome display
- Delete Shiki infrastructure (hook, lib, package)

### Phase 3: Merge Components (Medium risk, 3 parallel tracks)
- **3A:** Exercise + WorkoutTimer → FitnessBlock
- **3B:** ToolList + Ingredient → ChecklistBlock
- **3C:** Numbered + Step → StepBlock (unified with `simple` mode)

### Phase 4: Redesign DesignSystemPage (Low risk, dev-only)
- Tab-based section switching instead of scrolling
- Variation tabs per block card

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Cached formula blocks in MongoDB | Low | ContentBlockRenderer default case returns null gracefully |
| Backend still generates removed block types | Medium | Update all prompts; block_postprocessing strips unknown types |
| Shiki removal affects code readability | Low | Line numbers + highlight lines preserved; monospace is sufficient |
| Merged component breaks existing rendering | Medium | Wire types unchanged; only component routing changes in ContentBlockRenderer |
| ListBlock ordered removal breaks cooking_steps variant | Low | Check if any prompt generates `numbered` with `cooking_steps`; route through StepBlock if needed |

## Success Metrics

- [ ] All unit tests pass (`apps/web`, `services/summarizer`)
- [ ] Type check passes (`npx tsc --noEmit`)
- [ ] All blocks render correctly in design system page
- [ ] E2E tests pass (`output-layout.spec.ts`)
- [ ] `shiki` removed from package.json
- [ ] Block component count reduced from 32 to 27

## Dependencies

- No external dependencies
- All changes are frontend + backend prompt changes
- Wire types (block `type` field values) remain unchanged — no migration needed
