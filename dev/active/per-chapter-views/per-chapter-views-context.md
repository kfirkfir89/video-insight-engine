# Per-Chapter Views + Concept Tooltips — Context

**Last Updated**: 2026-02-10
**Status**: COMPLETE — All 4 phases implemented, all tests passing

---

## Implementation Summary

All 4 phases completed in a single session:
- **Phase A**: Backend dual-persona system with per-chapter view detection
- **Phase B**: Types + frontend effectiveCategory resolution
- **Phase C**: Inline concept tooltips with Radix Popover
- **Phase D**: Full Playwright E2E testing (11 new tests) + regression verification (103 existing tests)

---

## Key Files

### Phase A: Backend

| File | Path | Status |
|------|------|--------|
| **persona_system.txt** | `services/summarizer/src/prompts/persona_system.txt` | NEW — Author + 10 Domain Experts |
| **chapter_summary.txt** | `services/summarizer/src/prompts/chapter_summary.txt` | MODIFIED — `{persona_system}` + `"view"` field in JSON |
| **llm.py** | `services/summarizer/src/services/llm.py` | MODIFIED — constants, `load_persona_system()`, `_infer_view_from_blocks()`, view extraction in `summarize_chapter()` + `stream_summarize_chapter()` |
| **stream.py** | `services/summarizer/src/routes/stream.py` | MODIFIED — `build_chapter_dict()` includes `"view"` field |

### Phase B: Types + Frontend

| File | Path | Status |
|------|------|--------|
| **index.ts** | `packages/types/src/index.ts` | MODIFIED — `view?: VideoCategory` on `SummaryChapter` |
| **ArticleSection.tsx** | `apps/web/src/components/video-detail/ArticleSection.tsx` | MODIFIED — `effectiveCategory` + `ConceptsProvider` wrapper |

### Phase C: Concept Tooltips

| File | Path | Status |
|------|------|--------|
| **ConceptsContext.tsx** | `apps/web/src/components/video-detail/ConceptsContext.tsx` | NEW — React Context + Provider + hook |
| **ConceptHighlighter.tsx** | `apps/web/src/components/video-detail/ConceptHighlighter.tsx` | NEW — regex matching + Radix Popover |
| **ContentBlockRenderer.tsx** | `apps/web/src/components/video-detail/ContentBlockRenderer.tsx` | MODIFIED — paragraph uses ConceptHighlighter |
| **CalloutBlock.tsx** | `apps/web/src/components/video-detail/blocks/CalloutBlock.tsx` | MODIFIED — text uses ConceptHighlighter |
| **QuoteRenderer.tsx** | `apps/web/src/components/video-detail/blocks/QuoteRenderer.tsx` | MODIFIED — block.text uses ConceptHighlighter |
| **DefinitionBlock.tsx** | `apps/web/src/components/video-detail/blocks/DefinitionBlock.tsx` | MODIFIED — block.meaning uses ConceptHighlighter |

### Phase D: Testing

| File | Path | Status |
|------|------|--------|
| **per-chapter-views.spec.ts** | `apps/web/e2e/per-chapter-views.spec.ts` | NEW — 11 Playwright E2E tests |

---

## Key Decisions

### 1. Soft Correction vs Hard Override for View Inference

**Decision**: Soft correction (2+ signature blocks to override LLM).

**Why**: A cooking chapter about "the history of mole" has zero ingredient/step blocks but still belongs in cooking view. Hard override would force it to `standard`. The LLM has semantic understanding; block inference is just a safety net.

### 2. Keep `{variant_examples}` in Prompt

**Decision**: Keep per-persona example files; only replace `{persona_guidelines}`.

**Why**: The persona_system tells the LLM *who to be*. The examples show it *what good output looks like*. Removing examples caused quality regression in testing.

### 3. DIY/Gaming Examples Fallback

**Decision**: Fall back to `examples/standard.txt` for DIY and Gaming (no dedicated example files yet).

**Why**: The persona_system.txt already lists preferred blocks for Maker/Gamer. Standard examples cover JSON formatting patterns. Add dedicated example files later if output quality is weak.

### 4. `PERSONA_TO_VIEW` Mapping

**Decision**: Bridge old persona names to new view names via constant mapping.

**Why**: Existing `load_examples()`, `_log_block_metrics()`, and `generate_master_summary()` use old persona names (`recipe`, `code`, `interview`). The mapping keeps them working while the view system uses new names (`cooking`, `coding`, `podcast`).

### 5. Word Boundary Strategy for Concept Regex

**Decision**: Use lookahead/lookbehind for whitespace/punctuation instead of `\b`.

**Why**: `\b` doesn't work reliably with accented characters ("Cafe", "Pao de Queijo"). Pattern: `(?<=^|[\s.,;:!?])` and `(?=[\s.,;:!?]|$)`.

### 6. One Popover at a Time

**Decision**: Track `openConceptId` state in ConceptHighlighter.

**Why**: Multiple adjacent concept triggers could open overlapping popovers. Single-open prevents visual congestion.

### 7. Tailwind v4 Border Dotted Fix

**Decision**: Use inline `style={{ borderBottomStyle: 'dotted' }}` instead of Tailwind's `border-dotted` class.

**Why**: In Tailwind v4, `border-b` sets `--tw-border-style: solid` which overrides `border-dotted`'s `--tw-border-style: dotted` due to CSS cascade ordering. The inline style ensures the bottom border is always dotted.

---

## Bugs Found and Fixed During Testing

### Bug 1: Wrong URL Path in E2E Test
- **Symptom**: All 11 Playwright tests failed with timeout on `waitForSelector('[data-slot="article-chapter"]')`
- **Root Cause**: Used `/videos/video-1` instead of `/video/video-1` in test navigation
- **Fix**: Changed to `/video/video-1` (matching the app's actual route pattern)

### Bug 2: Strict Mode Violations in Selectors
- **Symptom**: Playwright found 2 buttons matching "Penca de Maguey" — sidebar concept button + inline ConceptHighlighter button
- **Root Cause**: Both the sidebar concept list and inline highlighter render buttons with the same text
- **Fix**: Used `getByRole('button', { name: 'Definition: Penca de Maguey' })` to target inline triggers (which have `aria-label="Definition: ..."`)

### Bug 3: Duplicate Definition Text
- **Symptom**: `getByText('The thick leaf of the maguey')` resolved to 2-3 elements
- **Root Cause**: Definition text appears in sidebar concept accordion AND inline popover
- **Fix**: Scoped assertions to `page.locator('[data-radix-popper-content-wrapper]')` for popover-specific assertions

### Bug 4: Tailwind v4 `border-dotted` Override
- **Symptom**: `borderBottomStyle` computed as "solid" instead of "dotted"
- **Root Cause**: Tailwind v4's `border-b` utility sets `--tw-border-style: solid`, overriding `border-dotted`
- **Fix**: Added inline `style={{ borderBottomStyle: 'dotted' }}` to the concept trigger button

---

## Test Results

| Suite | Result |
|-------|--------|
| TypeScript `tsc --noEmit` | Clean (zero errors) |
| Vite production build | Success |
| Unit tests (954 across 47 files) | All passing |
| New Playwright tests (11) | All passing |
| Existing Playwright tests (103) | All passing (0 regressions) |

---

## Remaining Work (Optional Enhancements)

1. **A5.1** — Remove hardcoded `persona` pass-through in `process_video()` (currently uses defaults, not breaking)
2. **A7.2-A7.4** — Remove explicit `persona=persona` from stream.py calls (currently works because param has default)
3. **DIY/Gaming example files** — Create dedicated `examples/diy.txt` and `examples/gaming.txt` if output quality is weak
4. **Unit tests for ConceptHighlighter** — Component renders correctly with Vitest + Testing Library
5. **Unit tests for `_infer_view_from_blocks`** — Python pytest (standalone logic test passed but not in pytest suite)
6. **Git commit** — Changes are uncommitted; user should review and commit

---

## Backward Compatibility

- `view` field is `optional` (`view?: VideoCategory`) — old summaries without it fall back to global `category`
- Old persona files and example files are NOT deleted — still used by `generate_master_summary()`
- `persona` parameter in `summarize_chapter()` kept as optional for backward compat during transition
- Frontend `ArticleSection` already handles all 10 categories in switch statement
- No database migration needed
