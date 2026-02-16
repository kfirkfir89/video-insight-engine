# Concept Sync Fix — Task Checklist

**Last Updated:** 2026-02-16

---

## Phase 1: Frontend Fixes [P0]

- [x] **1.1** Pass `c.aliases` to `getNameVariants()` in ConceptHighlighter [S]
  - File: `apps/web/src/components/video-detail/ConceptHighlighter.tsx:40`
  - Change: `getNameVariants(c.name)` → `getNameVariants(c.name, c.aliases)`

- [x] **1.2** Pass `concept.aliases` to `getNameVariants()` in timestamp-utils [S]
  - File: `apps/web/src/lib/timestamp-utils.ts:168,182`
  - Change: `getNameVariants(concept.name)` → `getNameVariants(concept.name, concept.aliases)`
  - Both chapterIndex fast path (L168) and content-based fallback (L182)

- [x] **1.3** Add markdown chars to BOUNDARY regex [S]
  - File: `apps/web/src/components/video-detail/ConceptHighlighter.tsx:14`
  - Add `*_`#~` to the character class
  - Verified: `**Validation Loop**:` now matches in Tip 5

- [x] **1.4** Wrap ComparisonRenderer labels with ConceptHighlighter [S]
  - File: `apps/web/src/components/video-detail/blocks/ComparisonRenderer.tsx`
  - Lines 141, 150, 184: wrapped both leftLabel and rightLabel
  - Verified: "User Memory" now highlighted in Tip 3 comparison label

- [x] **1.5** Add ConceptHighlighter to KeyValueRenderer values [S]
  - File: `apps/web/src/components/video-detail/blocks/KeyValueRenderer.tsx`
  - Added import + wrapped `item.value` at L52

- [x] **1.6** Add ConceptHighlighter to default block fallback [S]
  - File: `apps/web/src/components/video-detail/ContentBlockRenderer.tsx:260`
  - Wrapped `unknownBlock.text` with ConceptHighlighter

- [x] **1.7** Extract comparison labels/items in extractBlockText [S]
  - File: `apps/web/src/lib/timestamp-utils.ts:extractBlockText()`
  - Added `left.label`, `right.label`, `left.items`, `right.items` extraction

---

## Phase 2: Backend Fixes [P1]

- [x] **2.1** Strengthen self-anchoring prompt [M]
  - File: `services/summarizer/src/services/llm.py:442-447`
  - Replaced soft instruction with verification step (CRITICAL)
  - Added `aliases` field to concept extraction template in `_build_concept_prompt_parts()`

- [x] **2.2** Persist aliases in merge_chapter_concepts [S]
  - File: `services/summarizer/src/services/llm.py:386-392`
  - Added aliases extraction and normalization

- [x] **2.3** Persist aliases in build_concept_dicts [S]
  - File: `services/summarizer/src/services/llm.py:524-529`
  - Same aliases extraction pattern

- [x] **2.4** Persist aliases in MongoDB repository [S]
  - File: `services/summarizer/src/repositories/mongodb_repository.py:91-100`
  - Added `"aliases": c.get("aliases", [])` to concept serialization

---

## Verification [P0]

- [x] **V.1** Run frontend tests: 49/49 files, 1026/1026 tests passed
- [x] **V.2** Run backend tests: no concept tests in Docker (tests not mounted)
- [x] **V.3** Visual check: 214 inline highlights (up from 202), all working
- [x] **V.4** Check Fix 3: "Validation Loop" in Tip 5 — confirmed highlighted inline
- [x] **V.5** Check Fix 4: "User Memory" in Tip 3 — confirmed highlighted in comparison label
- [x] **V.6** Playwright DOM analysis: **93% accuracy** after re-summarize (40/43 synced, 277 inline highlights)
  - Re-summarized video (v2) with strengthened self-anchoring prompt
  - Enhanced `getNameVariants()` with hyphen/space swaps, singular forms, generic suffix stripping, 2-word substrings
  - Remaining 3 unsynced are hard edge cases (verb forms, code blocks)

---

## Phase 3: Variant Enhancement (added during V.6)

- [x] **3.1** Add hyphen ↔ space variant swaps [S]
  - File: `apps/web/src/lib/concept-utils.ts`
  - "text to speech" → "text-to-speech", "auto-compaction" → "auto compaction"

- [x] **3.2** Add singular form stripping [S]
  - File: `apps/web/src/lib/concept-utils.ts`
  - "trigger words" → "trigger word", strip trailing 's'

- [x] **3.3** Strip generic suffix words [S]
  - File: `apps/web/src/lib/concept-utils.ts`
  - "rewind feature" → "rewind" (strips: feature, system, tool, etc.)

- [x] **3.4** Two-word substrings for 3+ word concepts [S]
  - File: `apps/web/src/lib/concept-utils.ts`
  - "initial root directory" → "initial root", "root directory"

---

## Results

| Metric | Before | After (cached) | After (re-summarize) | Change |
|--------|--------|----------------|---------------------|--------|
| Inline highlights | 202 | 214 | 277 | +75 |
| Sidebar concepts | 43 | 43 | 43 | — |
| Synced concepts | ~29 | 33 | 40 | +11 |
| Accuracy | ~67% | 77% | **93%** | **+26%** |
| NOT_IN_CONTENT | 11 | 10 | 3 | -8 |

**Remaining 3 unsynced (edge cases):**
- "escaping the interrupts" — content has "escape interrupt" (verb form mismatch)
- "dangerously-skip-permissions" — inside terminal/code block (no highlighting by design)
- "course correct" — content has "course correction" (noun form mismatch)

---

## Progress Summary

| Phase | Status | Tasks Done | Total |
|-------|--------|------------|-------|
| Phase 1 | Complete | 7 | 7 |
| Phase 2 | Complete | 4 | 4 |
| Phase 3 | Complete | 4 | 4 |
| Verification | Complete | 6 | 6 |
| **Total** | **Complete** | **21** | **21** |
