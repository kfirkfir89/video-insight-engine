# Concepts System Overhaul — Task Checklist

**Last Updated:** 2026-02-15

---

## Phase 1: Critical — Fix Data Quality (Backend Python) [P0]

- [x] **1.1** Fix streaming path to use `build_concept_dicts()` [S]
  - File: `services/summarizer/src/routes/stream.py:651-659`
  - Replaced inline list comprehension with `concepts = build_concept_dicts(raw_concepts)`

- [x] **1.2** Add name normalization + dedup to `build_concept_dicts()` [S]
  - File: `services/summarizer/src/services/llm.py`
  - Strip whitespace, reject empty names, case-insensitive dedup (first wins)

- [x] **1.3** Add timestamp validation helper [S]
  - File: `services/summarizer/src/services/llm.py`
  - Added `_validate_timestamp()` with regex `^\d{1,2}:\d{2}(?::\d{2})?$`

- [x] **1.4** Write tests for Phase 1 changes [M]
  - File: `services/summarizer/tests/test_concept_processing.py`
  - 41 tests: TestValidateTimestamp (14), TestBuildConceptDicts (15), TestExtractConceptShortForm (6), TestBuildConceptsAnchor (6)
  - All passing in Docker container

---

## Phase 2: High Value — Unify Matching + Improve Anchoring [P1]

- [x] **2.1** Create shared `getNameVariants()` function [M]
  - File: NEW `apps/web/src/lib/concept-utils.ts`
  - Handles: full name, base name, abbreviation, reversed parens, slash parts, plurals, aliases

- [x] **2.2** Refactor `timestamp-utils.ts` to use shared variants [S]
  - File: `apps/web/src/lib/timestamp-utils.ts`
  - `getConceptSearchNeedles()` now delegates to `getNameVariants()`
  - Updated 3 tests to match broader variant output

- [x] **2.3** Refactor `ConceptHighlighter.tsx` to use shared variants [S]
  - File: `apps/web/src/components/video-detail/ConceptHighlighter.tsx`
  - Replaced inline variant generation with `getNameVariants()` call

- [x] **2.4** Write tests for `getNameVariants()` [M]
  - File: NEW `apps/web/src/lib/__tests__/concept-utils.test.ts`
  - 15 tests covering all patterns: standard/reversed parens, DPO, slashes, plurals, edges, aliases

- [x] **2.5** Improve concept anchoring prompt with variant forms [S]
  - File: `services/summarizer/src/services/llm.py`
  - Added `_extract_concept_short_form()` helper
  - `_build_concepts_anchor()` now lists `(also: SHORT)` for abbreviated concepts

- [x] **2.6** Display orphaned concepts in sidebar [M]
  - File: NEW `apps/web/src/components/video-detail/OrphanedConcepts.tsx`
  - Added to `VideoDetailDesktop.tsx` and `VideoDetailMobile.tsx`
  - Collapsible "Additional Concepts" section, only renders when orphaned.length > 0

---

## Phase 3: Polish — Coverage & Prompt Improvements [P2]

- [x] **3.1** Add ConceptHighlighter to ItineraryBlock + QuizBlock [S]
  - Files: `ItineraryBlock.tsx`, `QuizBlock.tsx`
  - Wrapped activity, notes, question, explanation fields

- [x] **3.2** Extend `extractBlockText()` for quiz/itinerary fields [S]
  - File: `apps/web/src/lib/timestamp-utils.ts`
  - Added quiz question/explanation and itinerary activity/notes extraction

- [x] **3.3** Standardize concept naming in extraction prompt [S]
  - File: `services/summarizer/src/prompts/concept_extract.txt`
  - Added NAMING RULES section

- [x] **3.4** Add `aliases` field to Concept type [M]
  - Files: `packages/types/src/index.ts`, `services/summarizer/src/models/schemas.py`
  - Added `aliases?: string[]` (TS) and `aliases: list[str] = []` (Pydantic)
  - `getNameVariants()` prepends aliases before computed variants

---

## Verification

- [x] Backend tests pass: 41/41 concept tests in Docker, 275/346 total (pre-existing failures unrelated)
- [x] Frontend tests pass: 49/49 test files, 1027/1027 tests all green
- [x] Playwright visual checks: Desktop (1440px), Tablet (768px, 1024px), Mobile (375px)
  - No horizontal overflow at any breakpoint
  - 37 concept tooltips rendering correctly on coding video
  - Concept expansion/definition display working
  - Layout hierarchy clean across all viewports
- [ ] Re-summarize test: New summary produces clean concepts (requires manual trigger)

---

## Progress Summary

| Phase | Status | Tasks Done | Total |
|-------|--------|------------|-------|
| Phase 1 | Complete | 4 | 4 |
| Phase 2 | Complete | 6 | 6 |
| Phase 3 | Complete | 4 | 4 |
| **Total** | **Complete** | **14** | **14** |
