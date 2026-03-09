# Per-Chapter Views + Concept Tooltips — Tasks

**Last Updated**: 2026-02-10
**Status**: COMPLETE — All phases implemented and tested

---

## Phase A: Backend Per-Chapter View ✅

### A1: Create Persona System Prompt

- [x] **A1.1** Create `services/summarizer/src/prompts/persona_system.txt` with Author + 10 Expert Consultants

### A2: Add Constants and Helpers to llm.py

- [x] **A2.1** Add `PERSONA_TO_VIEW` mapping constant
- [x] **A2.2** Add `VIEW_SIGNATURE_BLOCKS` constant
- [x] **A2.3** Add `VALID_VIEWS` frozenset
- [x] **A2.4** Add `load_persona_system()` function with `@lru_cache`
- [x] **A2.5** Implement `_infer_view_from_blocks()` with soft correction logic

### A3: Modify summarize_chapter()

- [x] **A3.1** Replace `load_persona()` with `load_persona_system()` for `{persona_system}` template variable
- [x] **A3.2** Make `persona` parameter optional (default `'standard'`)
- [x] **A3.3** Extract `"view"` from LLM JSON response
- [x] **A3.4** Apply `_infer_view_from_blocks()` soft correction
- [x] **A3.5** Include `"view"` field in return dict

### A4: Modify stream_summarize_chapter()

- [x] **A4.1** Same persona_system changes as A3.1-A3.2
- [x] **A4.2** Extract view + apply soft correction in `("complete", ...)` event

### A5: Modify process_video()

- [ ] **A5.1** Remove hardcoded `persona` pass-through *(deferred — uses defaults, not breaking)*

### A6: Modify chapter_summary.txt Prompt

- [x] **A6.1** Replace `{persona_guidelines}` with `{persona_system}`
- [x] **A6.2** Add `"view"` to expected JSON output format

### A7: Modify stream.py Route

- [x] **A7.1** Update `build_chapter_dict()` to include `"view"` from `summary_data`
- [ ] **A7.2** Remove `persona=persona` from `process_creator_chapters()` calls *(deferred — defaults work)*
- [ ] **A7.3** Remove `persona=persona` from `process_ai_chapters()` calls *(deferred — defaults work)*
- [ ] **A7.4** Remove `persona=persona` from `run_parallel_analysis()` call *(deferred — defaults work)*
- [x] **A7.5** Verify `generate_master_summary()` still receives global persona

### A8: Update Block Metrics

- [x] **A8.1** Update `_log_block_metrics()` to accept and log view alongside persona

---

## Phase B: Types + Frontend Per-Chapter View ✅

### B1: Type Changes

- [x] **B1.1** Add `view?: VideoCategory` to `SummaryChapter` interface in `packages/types/src/index.ts`

### B2: Frontend View Selection

- [x] **B2.1** Compute `effectiveCategory = chapter.view ?? category ?? "standard"` in `ArticleSection.tsx`
- [x] **B2.2** Verify backward compat: old summaries without `view` field render with global `category`

---

## Phase C: Inline Concept Tooltips ✅

### C1: ConceptsContext

- [x] **C1.1** Create `ConceptsContext.tsx` with `ConceptsProvider` and `useConcepts()` hook

### C2: ConceptHighlighter Component

- [x] **C2.1** Create `escapeRegex()` helper function
- [x] **C2.2** Create `ConceptHighlighter` component with `text: string` prop
- [x] **C2.3** Implement memoized regex compilation with `useMemo`
- [x] **C2.4** Implement text splitting into plain + matched segments
- [x] **C2.5** Implement Radix Popover for matched concept triggers
- [x] **C2.6** Implement single-popover-open state via `openConceptId`
- [x] **C2.7** Verify Radix Popover dependency is installed

### C3: Block Integration

- [x] **C3.1** Integrate ConceptHighlighter into `ContentBlockRenderer.tsx` for `paragraph` blocks
- [x] **C3.2** Integrate ConceptHighlighter into `CalloutBlock.tsx`
- [x] **C3.3** Integrate ConceptHighlighter into `QuoteRenderer.tsx`
- [x] **C3.4** Integrate ConceptHighlighter into `DefinitionBlock.tsx`
- [x] **C3.5** Verify NO integration in excluded blocks (code, terminal, formula, etc.)

### C4: Provider Integration

- [x] **C4.1** Wrap `categoryView` in `ArticleSection.tsx` with `<ConceptsProvider concepts={concepts}>`

---

## Phase D: Verification & Testing ✅

### D1: End-to-End Verification

- [x] **D1.1** TypeScript type-check (`tsc --noEmit`) — clean
- [x] **D1.2** Vite production build — success
- [x] **D1.3** Unit tests (954) — all passing
- [x] **D1.4** New Playwright E2E tests (11) — all passing
- [x] **D1.5** Existing Playwright E2E tests (103) — all passing, zero regressions
- [x] **D1.6** Python `_infer_view_from_blocks` standalone logic test — passed

### D1 (Playwright) Test Coverage:

| Test | Status |
|------|--------|
| Renders chapters with per-chapter view data | ✅ |
| Cooking chapter renders ingredient/step blocks | ✅ |
| Review chapter renders pro_con block | ✅ |
| Concept names highlighted with dotted underline | ✅ |
| Clicking concept shows definition popover | ✅ |
| Only one concept popover open at a time | ✅ |
| No horizontal overflow on video detail page | ✅ |
| Concept popovers do not overflow viewport | ✅ |
| Responsive: chapters readable at 375px mobile | ✅ |
| Responsive: concept popover works on mobile | ✅ |
| Backward compat: chapters without view field | ✅ |

---

## Summary

| Phase | Tasks | Completed | Status |
|-------|-------|-----------|--------|
| A: Backend per-chapter view | 21 | 17 ✅ / 4 deferred | ✅ Complete (deferred items are non-breaking cleanup) |
| B: Types + frontend view | 3 | 3 ✅ | ✅ Complete |
| C: Concept tooltips | 13 | 13 ✅ | ✅ Complete |
| D: Verification | 6 | 6 ✅ | ✅ Complete |
| **Total** | **43** | **39 ✅ / 4 deferred** | **✅ COMPLETE** |

### Deferred Items (Non-Breaking)

These are cleanup tasks that can be done later without any functional impact:
- A5.1: Remove `persona` pass-through in `process_video()` — uses defaults
- A7.2-A7.4: Remove explicit `persona=persona` from stream.py — params have defaults

### Uncommitted Changes

All changes are on the `dev-0` branch and have NOT been committed yet. To commit:
```bash
git add -A && git status  # Review changes first
# Then commit with appropriate message
```
