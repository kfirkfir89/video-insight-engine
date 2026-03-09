# Block Output Quality — Task Checklist

> Last Updated: 2026-02-24

## Phase 1: Prompt Quality (No Code Changes) — COMPLETE

- [x] **1.1** Add ACCURACY & FIDELITY RULES section to `chapter_summary.txt`
  - Added at lines 340-346: PRESERVE ORIGINAL TERMS, COMPLETE LISTS, ANALOGIES, SPECIFIC DETAILS, QUOTES, NO RENAMING
- [x] **1.2** Replace WRITING QUALITY with expanded TONE MATCHING + ANTI-FLUFF
  - Lines 348-354: energy matching, fluff-detection rules
- [x] **1.3** Add CALLOUT QUALITY GATE to callout block definition (item 6)
  - Lines 61-72: 4 quality criteria + style variety guidance
- [x] **1.4** Replace "Use 1-4 content blocks" with dynamic BLOCK COUNT GUIDELINES
  - Lines 324-328: Short (2-3), Medium (3-5), Long (4-7)
- [x] **1.5** Add STRUCTURED BLOCK ACCURACY rules
  - Lines 356-361: comparison specificity, list completeness, code accuracy, keyvalue precision, ingredient exactness
- [x] **1.6** Add SELF-CHECK section at end of prompt
  - Lines 437-447: 8-point checklist (items, terms, timestamps, callouts, code, analogies, orphans, attribution)
- [x] **1.7** Add `problem_solution` and `visual` block definitions
  - Lines 225-233: full type/field definitions with examples
- [x] **1.8** Add new blocks to BLOCK SELECTION PRIORITY table
  - Lines 259-260: both blocks with "NOT" alternatives

---

## Phase 2: Timestamp Fix + Persona Expansion + New Block Types — COMPLETE

### Timestamp Validation
- [x] **2.1** Add `start_seconds`/`end_seconds` params to `summarize_chapter()` (llm.py:1108-1109)
- [x] **2.2** Add `{chapter_time_range}` placeholder + TIMESTAMP VALIDATION rules (chapter_summary.txt:338, llm.py:1153-1161)
- [x] **2.3** Build time range string with duration in `summarize_chapter()` (llm.py:1154-1161)
- [x] **2.4** Pass `start_seconds`/`end_seconds` from all 3 call sites in stream.py (~548, ~836, ~1000)
- [x] **2.5** Same changes for `stream_summarize_chapter()` (llm.py:1566-1567)

### Title & Token Budget
- [x] **2.6** Improve `generatedTitle` instruction for creator titles (llm.py:1147)
- [x] **2.7** Increase `max_tokens` in `_build_concept_prompt_parts()` (2000->3000, 1500->2500; llm.py:580-581)

### Persona Expansion (Category Accuracy Rules)
- [x] **2.8a** Expand `education.txt` — teaching progression, analogies, term completeness
- [x] **2.8b** Expand `code.txt` — code blocks for all demos, variable names, output
- [x] **2.8c** Expand `recipe.txt` — every ingredient, all temps/times, step order
- [x] **2.8d** Expand `review.txt` — all specs with numbers, pros AND cons, prices
- [x] **2.8e** Expand `travel.txt` — location names, all prices, logistics, safety
- [x] **2.8f** Expand `fitness.txt` — exercise names exact, sets/reps/rest, form cues
- [x] **2.8g** Expand `interview.txt` — WHO said WHAT, verbatim quotes, guest info
- [x] **2.8h** Expand `music.txt` — lyrics, credits, genre specificity, production
- [x] **2.8i** Expand `standard.txt` — key arguments, main points, examples, takeaways
- All persona files have PREFERRED V2.1 BLOCKS + ACCURACY RULES sections

### New Block Types (Frontend)
- [x] **2.9** Add `ProblemSolutionBlock` and `VisualBlock` interfaces to `packages/types/src/index.ts` (lines 426-441, union at 488-489)
- [x] **2.10** Create `ProblemSolutionBlock.tsx` renderer (problem red + solution green sections)
- [x] **2.11** Create `VisualBlock.tsx` renderer (variant icons, optional image, timestamp link)
- [x] **2.12** Add routing cases in `ContentBlockRenderer.tsx` (lines 247-251)
- [x] **2.13** Export new components from `blocks/index.ts`

---

## Phase 3: Multi-Pass Accuracy Pipeline — COMPLETE

### Pre-Extraction (Fact Sheet)
- [x] **3.1** Create `chapter_facts.txt` prompt with universal + category-specific fields
- [x] **3.2** Add `CATEGORY_FACT_FIELDS` and `CATEGORY_FACT_RULES` dictionaries to llm.py (line 95+)
- [x] **3.3** Implement `extract_chapter_facts()` method using `complete_fast()` (llm.py:1281-1320)
- [x] **3.4** Add `{fact_sheet}` placeholder + instructions to chapter_summary.txt (line 446)
- [x] **3.5** Add `facts` parameter to `summarize_chapter()` and `stream_summarize_chapter()` (llm.py:1110, 1567)

### Integration
- [x] **3.6** Integrate fact extraction in stream.py batch processing (parallel per batch, then summarize)
- [x] **3.10** Add fact extraction as 4th parallel task for first chapter processing (stream.py:531)

### Post-Validation
- [x] **3.7** Create `chapter_validate.txt` prompt
- [x] **3.8** Implement `validate_chapter_blocks()` method using `complete_fast()` (llm.py:1322-1360+)
- [x] **3.9** Add non-blocking validation after summarization in stream.py (asyncio.create_task, line ~589-595)

---

## Phase 4: Testing & Verification — PARTIAL

### Unit Tests
- [ ] **4.1** Test `extract_chapter_facts()` — returns correct structure per category
  - **Status:** Not explicitly tested. `test_block_quality_v3.py` exists but covers diversity enforcement not extraction
- [ ] **4.2** Test `validate_chapter_blocks()` — catches missing items, renamed terms, timestamp violations
  - **Status:** Not explicitly tested
- [ ] **4.3** Test `CATEGORY_FACT_FIELDS` — each persona gets correct extraction fields
  - **Status:** Not tested

### Frontend Tests
- [x] **4.4** Test `ProblemSolutionBlock` — renders problem/solution sections, handles optional context
  - File: `blocks/__tests__/problem-solution-block.test.tsx`
- [x] **4.5** Test `VisualBlock` — renders variants, handles imageUrl presence/absence, timestamp click
  - File: `blocks/__tests__/visual-block.test.tsx`

### Type Safety
- [ ] **4.6** TypeScript compilation check: `cd apps/web && npx tsc --noEmit`
  - **Status:** Not verified this session

### Integration Verification
- [ ] **4.7** Test with education video (ID: 699c5b9fbceeb26e66e3cb14)
- [ ] **4.8** Cross-category verification

---

## Progress Summary

| Phase | Status | Tasks | Completed |
|-------|--------|-------|-----------|
| Phase 1: Prompt Quality | COMPLETE | 8 | 8 |
| Phase 2: Timestamps + Personas + Blocks | COMPLETE | 17 | 17 |
| Phase 3: Multi-Pass Pipeline | COMPLETE | 10 | 10 |
| Phase 4: Testing | PARTIAL | 8 | 2 |
| **Total** | **~86%** | **43** | **37** |

## Remaining Work

1. Write backend unit tests for `extract_chapter_facts()` and `validate_chapter_blocks()` (tasks 4.1-4.3)
2. Run TypeScript compilation check (task 4.6)
3. Manual integration test with education video + cross-category (tasks 4.7-4.8)
