# Concepts System Overhaul — Strategic Plan

**Last Updated:** 2026-02-15

---

## Executive Summary

The concepts system is a core feature — every video summary extracts 5-15 key concepts that appear as inline tooltips, sidebar references, and definition blocks. Three categories of problems exist:

1. **Backend data quality** — Streaming path bypasses validation, names aren't trimmed/deduped, timestamps aren't validated. Dirty data enters MongoDB.
2. **Frontend matching divergence** — Two independent systems generate name variants (sidebar `timestamp-utils.ts` vs inline `ConceptHighlighter.tsx`) with different strategies.
3. **Concept anchoring gap** — LLM told to use "EXACT concept names" but for names like `"Duration, Path, and Outcome (DPO)"` the LLM writes just `"DPO"` — backend doesn't inform about acceptable short forms.

---

## Current State Analysis

### Backend (Python Summarizer)

| Component | File | Issue |
|-----------|------|-------|
| Streaming concept extraction | `stream.py:651-659` | Inline list comprehension bypasses `build_concept_dicts()` validation |
| Concept dict builder | `llm.py:143-161` | No `.strip()`, whitespace-only names pass, no dedup |
| Concept anchoring | `llm.py:164-182` | Anchor text tells LLM to use exact names only |
| Concept schema | `schemas.py:89-94` | No `aliases` field, no validators |
| Extraction prompt | `concept_extract.txt` | No naming standardization guidance |

### Frontend (TypeScript Web App)

| Component | File | Issue |
|-----------|------|-------|
| Sidebar matching | `timestamp-utils.ts:27-38` | No plurals, no slash parts, abbr min length ≤6 |
| Inline highlighting | `ConceptHighlighter.tsx:40-76` | Has plurals, slash parts, abbr min length ≥2 |
| Sidebar display | `ArticleSection.tsx` | No display of orphaned concepts |
| Block coverage | `ItineraryBlock.tsx`, `QuizBlock.tsx` | No ConceptHighlighter wrapping |

### Shared Types

| Component | File | Issue |
|-----------|------|-------|
| Concept type | `packages/types/src/index.ts:494-499` | No `aliases` field |

---

## Proposed Future State

1. **Clean data pipeline** — All concept data normalized and validated before MongoDB insertion, regardless of streaming or parallel path.
2. **Single source of truth for matching** — One `getNameVariants()` function used by both sidebar and inline highlighting.
3. **Smart anchoring** — LLM receives acceptable short forms, dramatically increasing content matching success.
4. **Complete concept visibility** — Orphaned concepts shown in sidebar; all text-bearing blocks support highlighting.
5. **Future-proof schema** — Optional `aliases` field enables LLM-provided short forms.

---

## Implementation Phases

### Phase 1: Critical — Fix Data Quality (Backend Python)

**Priority:** P0 — Bad data entering production
**Effort:** M
**Dependencies:** None

| Task | Description | File(s) | Effort |
|------|-------------|---------|--------|
| 1.1 | Fix streaming path to use `build_concept_dicts()` | `stream.py` | S |
| 1.2 | Add name normalization + dedup to `build_concept_dicts()` | `llm.py` | S |
| 1.3 | Add timestamp validation helper | `llm.py` | S |
| 1.4 | Write tests for Tier 1 changes | `tests/` | M |

**Acceptance Criteria:**
- Streaming path produces identical output to parallel path
- Whitespace-only names rejected, leading/trailing whitespace stripped
- Case-insensitive dedup (first occurrence wins)
- Invalid timestamps → `None` (regex: `^\d{1,2}:\d{2}(?::\d{2})?$`)
- All tests pass

### Phase 2: High Value — Unify Matching + Improve Anchoring

**Priority:** P1 — User-visible inconsistency
**Effort:** L
**Dependencies:** Phase 1 (clean data makes matching reliable)

| Task | Description | File(s) | Effort |
|------|-------------|---------|--------|
| 2.1 | Create shared `getNameVariants()` | New: `concept-utils.ts` | M |
| 2.2 | Refactor `timestamp-utils.ts` to use shared variants | `timestamp-utils.ts` | S |
| 2.3 | Refactor `ConceptHighlighter.tsx` to use shared variants | `ConceptHighlighter.tsx` | S |
| 2.4 | Write tests for `getNameVariants()` | New: `concept-utils.test.ts` | M |
| 2.5 | Improve concept anchoring prompt with variant forms | `llm.py` | S |
| 2.6 | Display orphaned concepts in sidebar | `ArticleSection.tsx` | M |

**Acceptance Criteria:**
- Single `getNameVariants()` produces superset of all current variants
- Both sidebar and inline highlighting use same function
- Existing timestamp-utils tests still pass
- Anchoring prompt lists acceptable short forms for each concept
- Orphaned concepts visible under "Additional Concepts" heading

### Phase 3: Polish — Coverage & Prompt Improvements

**Priority:** P2 — Incremental improvement
**Effort:** M
**Dependencies:** Phase 2 (shared variant function needed)

| Task | Description | File(s) | Effort |
|------|-------------|---------|--------|
| 3.1 | Add ConceptHighlighter to ItineraryBlock + QuizBlock | `ItineraryBlock.tsx`, `QuizBlock.tsx` | S |
| 3.2 | Extend `extractBlockText()` for quiz/itinerary fields | `timestamp-utils.ts` | S |
| 3.3 | Standardize concept naming in extraction prompt | `concept_extract.txt` | S |
| 3.4 | Add `aliases` field to Concept type (future-proof) | `packages/types`, `schemas.py`, `concept_extract.txt` | M |

**Acceptance Criteria:**
- Concept tooltips appear in ItineraryBlock and QuizBlock text
- Quiz questions/explanations and itinerary activities included in chapter content scanning
- Extraction prompt includes naming guidance
- `aliases` field optional, backward-compatible, defaults to `[]`

---

## Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Regex changes break existing highlights | High | Medium | Test with real video data before/after |
| Dedup removes intentional duplicates | Low | Low | First-occurrence wins preserves primary |
| LLM anchoring prompt increases token usage | Low | Medium | Short-form list is compact, <50 tokens |
| `getNameVariants()` generates false positive matches | Medium | Low | Unit tests with edge cases, min length guards |
| Orphaned concepts section clutters sidebar | Low | Medium | Only show when `orphaned.length > 0`, collapsible |

---

## Success Metrics

1. **Zero dirty concepts** — All concepts in MongoDB have trimmed, non-empty names
2. **Matching consistency** — Same concept appears in both sidebar and inline (or neither), never one but not the other
3. **Anchoring hit rate** — ≥80% of concepts found in at least one chapter's content (up from ~80-90% current for simple names, ~50% for parenthetical names)
4. **Zero orphaned concepts invisible** — All concepts visible in at least sidebar or inline
5. **Test coverage** — All new functions have unit tests; existing tests still pass

---

## Required Resources

- **Backend:** Python, access to summarizer service
- **Frontend:** TypeScript/React, access to web app
- **Types:** Shared package modification
- **Testing:** Vitest (frontend), pytest (backend)
- **Manual testing:** Video with complex concept names (Huberman episode recommended: `6991cff35b8159d87edb17de`)

---

## Verification Commands

```bash
# Backend tests
cd services/summarizer && python -m pytest tests/ -k "concept"

# Frontend tests (specific)
cd apps/web && npx vitest run src/lib/__tests__/concept-utils.test.ts src/lib/__tests__/timestamp-utils.test.ts

# All frontend tests
cd apps/web && npx vitest run

# Manual verification
# Navigate to http://localhost:5173/video/6991cff35b8159d87edb17de
# Verify: DPO, Interoception, Dopamine, Physiological Sigh all show tooltips + sidebar
```
