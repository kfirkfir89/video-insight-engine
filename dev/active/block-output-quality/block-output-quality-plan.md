# Block Output Quality — Accuracy & Value Improvement Plan

> Last Updated: 2026-02-23

## Executive Summary

The summarizer transforms video transcripts into structured content blocks. Analysis reveals **accuracy and value problems**: the LLM renames speaker terminology, drops key details, hallucinates timestamps, generates fluff callouts, and loses the author's voice/energy. This task implements a multi-phase accuracy pipeline — prompt improvements, timestamp validation, new block types, category-aware fact extraction, and post-validation — to ensure blocks deliver **more value than watching the video**.

---

## Current State Analysis

### What Works
- 31 block types across 11 categories with full TypeScript types and React components
- Persona-based prompt system (education, code, recipe, review, travel, fitness, interview, music, standard)
- `complete_fast()` available on LLMProvider (Haiku, ~1s, cheap)
- Batch processing with parallel chapter summarization
- View signature matching for category detection
- Quality metrics tracking (paragraph ratio, unique block types, category match ratio)

### What's Broken
| Problem | Impact | Root Cause |
|---------|--------|------------|
| Terms renamed ("terms" → "vocabulary") | Reader confusion cross-referencing video | No fidelity rules in prompt |
| Items dropped from lists (8 data types → 5) | Lost trust, incomplete reference | Hardcoded 1-4 block limit |
| Timestamps outside chapter range | Misleading video navigation | No time range validation in prompt |
| Fluff callouts ("keep this in mind") | Wasted space, no value | No callout quality gate |
| Speaker tone lost (casual → academic) | Feels like different author | No tone matching rules |
| Analogies/quotes dropped | Lost teaching effectiveness | No preservation rules |
| Structured blocks missing detail | "Integers: fundamental data type" vs actual info | No specificity rules |

---

## Proposed Future State

### Architecture: Category-Aware Accuracy Pipeline

```
TRANSCRIPT + PERSONA
       │
       ▼
┌──────────────────────────────┐
│ FACT EXTRACT (Haiku, ~1s)    │  Phase 3
│ Category-aware extraction    │
│ → recipe: ingredients, temps │
│ → code: code, commands       │
│ → universal: terms, quotes   │
└──────────┬───────────────────┘
           │ fact_sheet JSON
           ▼
┌──────────────────────────────┐
│ CHAPTER SUMMARY (Sonnet)     │  Phases 1-2
│ + ACCURACY & FIDELITY rules  │
│ + timestamp validation       │
│ + tone matching              │
│ + callout quality gate       │
│ + dynamic block count        │
│ + self-check                 │
│ + fact_sheet as checklist    │
└──────────┬───────────────────┘
           │ content blocks
           ▼
┌──────────────────────────────┐
│ VALIDATE (Haiku, ~0.5s)      │  Phase 3
│ Non-blocking metrics logging │
│ → missing items              │
│ → renamed terms              │
│ → timestamp range violations │
│ → accuracy score (0-10)      │
└──────────┬───────────────────┘
           ▼
        STORE / SSE
```

---

## Implementation Phases

### Phase 1: Prompt Quality (No Code Changes)
**Goal:** Fix accuracy, tone, and callout quality through prompt engineering alone.

**Why first:** Highest impact, zero risk, no code changes. Prompt-only modifications can be tested immediately.

| # | Task | Effort | Files |
|---|------|--------|-------|
| 1.1 | Add ACCURACY & FIDELITY RULES section to chapter_summary.txt | M | chapter_summary.txt |
| 1.2 | Replace WRITING QUALITY with expanded TONE MATCHING + ANTI-FLUFF | M | chapter_summary.txt |
| 1.3 | Add CALLOUT QUALITY GATE to callout block definition | S | chapter_summary.txt |
| 1.4 | Replace hardcoded "1-4 blocks" with dynamic BLOCK COUNT GUIDELINES | S | chapter_summary.txt |
| 1.5 | Add STRUCTURED BLOCK ACCURACY rules (comparison specificity, list completeness, code accuracy) | S | chapter_summary.txt |
| 1.6 | Add SELF-CHECK section at end of prompt | S | chapter_summary.txt |
| 1.7 | Add `problem_solution` and `visual` block definitions to prompt | M | chapter_summary.txt |
| 1.8 | Add blocks to BLOCK SELECTION PRIORITY table | S | chapter_summary.txt |

### Phase 2: Timestamp Fix + Persona Expansion + New Block Types
**Goal:** Fix timestamp validation, expand persona accuracy rules, add new frontend components.

**Dependencies:** Phase 1 (prompts must be updated first)

| # | Task | Effort | Files |
|---|------|--------|-------|
| 2.1 | Add `start_seconds`/`end_seconds` params to `summarize_chapter()` | M | llm.py |
| 2.2 | Add `{chapter_time_range}` placeholder + TIMESTAMP VALIDATION rules | M | chapter_summary.txt, llm.py |
| 2.3 | Add chapter duration to time range string | S | llm.py |
| 2.4 | Pass `start_seconds`/`end_seconds` from all call sites in stream.py | M | stream.py |
| 2.5 | Same for `stream_summarize_chapter()` | M | llm.py |
| 2.6 | Improve `generatedTitle` instruction for creator titles | S | llm.py |
| 2.7 | Increase `max_tokens` in `_build_concept_prompt_parts()` (2000→3000, 1500→2500) | S | llm.py |
| 2.8 | Expand all persona files with category-specific accuracy rules | L | 9 persona files |
| 2.9 | Add `ProblemSolutionBlock` and `VisualBlock` types to ContentBlock union | M | packages/types/src/index.ts |
| 2.10 | Create `ProblemSolutionBlock.tsx` component | M | blocks/ProblemSolutionBlock.tsx |
| 2.11 | Create `VisualBlock.tsx` component | M | blocks/VisualBlock.tsx |
| 2.12 | Add routing cases in ContentBlockRenderer.tsx | S | ContentBlockRenderer.tsx |
| 2.13 | Export new components from blocks/index.ts | S | blocks/index.ts |

### Phase 3: Multi-Pass Accuracy Pipeline
**Goal:** Add pre-extraction fact sheet and post-validation for systematic accuracy improvement.

**Dependencies:** Phase 2 (timestamp params and persona expansion must be in place)

| # | Task | Effort | Files |
|---|------|--------|-------|
| 3.1 | Create `chapter_facts.txt` prompt with category-aware fields | L | prompts/chapter_facts.txt |
| 3.2 | Add `CATEGORY_FACT_FIELDS` and `CATEGORY_FACT_RULES` dictionaries | M | llm.py |
| 3.3 | Implement `extract_chapter_facts()` method | M | llm.py |
| 3.4 | Add `{fact_sheet}` placeholder and instructions to chapter_summary.txt | M | chapter_summary.txt |
| 3.5 | Add `facts` parameter to `summarize_chapter()` signature | S | llm.py |
| 3.6 | Integrate fact extraction in stream.py (parallel per batch) | L | stream.py |
| 3.7 | Create `chapter_validate.txt` prompt | M | prompts/chapter_validate.txt |
| 3.8 | Implement `validate_chapter_blocks()` method | M | llm.py |
| 3.9 | Add non-blocking validation after summarization in stream.py | M | stream.py |
| 3.10 | Add fact extraction as parallel task for first chapter | M | stream.py |

### Phase 4: Testing & Verification
**Goal:** Ensure all changes work correctly and accuracy has improved.

| # | Task | Effort | Files |
|---|------|--------|-------|
| 4.1 | Add unit tests for `extract_chapter_facts()` | M | tests/ |
| 4.2 | Add unit tests for `validate_chapter_blocks()` | M | tests/ |
| 4.3 | Add unit tests for category fact field selection | S | tests/ |
| 4.4 | Add frontend tests for ProblemSolutionBlock | M | blocks/__tests__/ |
| 4.5 | Add frontend tests for VisualBlock | M | blocks/__tests__/ |
| 4.6 | TypeScript compilation check for new types | S | — |
| 4.7 | Integration test with real video (education category) | L | manual |
| 4.8 | Integration test across all categories | XL | manual |

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Prompt changes cause regression in other categories | Medium | High | Test across all personas before merging |
| Fact extraction adds too much latency | Low | Medium | Haiku is ~1s; runs in parallel with batches |
| Increased max_tokens raises cost | Low | Low | Monitor token usage; 3000 vs 2000 is modest |
| Dynamic block count leads to too many blocks | Medium | Medium | Guidelines not hard limits; LLM self-regulates |
| `complete_fast()` timeout on long chapters | Low | Low | Default 10s timeout with graceful fallback |
| New block types not handled by all consumers | Low | High | ContentBlockRenderer has fallback for unknown types |

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Term fidelity (terms match video) | ~60% | >95% |
| List completeness (items not dropped) | ~70% | >95% |
| Timestamp accuracy (within chapter range) | ~80% | >99% |
| Callout value (actionable, not fluff) | ~50% | >85% |
| Tone matching (casual speaker = casual prose) | ~40% | >80% |
| Validation score (post-validation average) | N/A | >7/10 |
| Block count per chapter (dynamic) | 1-4 fixed | 2-7 adaptive |

---

## Files Modified (Complete List)

### Prompt Files
| File | Action |
|------|--------|
| `services/summarizer/src/prompts/chapter_summary.txt` | Modify (accuracy, tone, callouts, block count, timestamps, fact sheet, self-check, new blocks) |
| `services/summarizer/src/prompts/chapter_facts.txt` | **NEW** (fact extraction prompt) |
| `services/summarizer/src/prompts/chapter_validate.txt` | **NEW** (post-validation prompt) |
| `services/summarizer/src/prompts/personas/education.txt` | Modify (accuracy rules) |
| `services/summarizer/src/prompts/personas/code.txt` | Modify (accuracy rules) |
| `services/summarizer/src/prompts/personas/recipe.txt` | Modify (accuracy rules) |
| `services/summarizer/src/prompts/personas/review.txt` | Modify (accuracy rules) |
| `services/summarizer/src/prompts/personas/travel.txt` | Modify (accuracy rules) |
| `services/summarizer/src/prompts/personas/fitness.txt` | Modify (accuracy rules) |
| `services/summarizer/src/prompts/personas/interview.txt` | Modify (accuracy rules) |
| `services/summarizer/src/prompts/personas/music.txt` | Modify (accuracy rules) |
| `services/summarizer/src/prompts/personas/standard.txt` | Modify (accuracy rules) |

### Backend
| File | Action |
|------|--------|
| `services/summarizer/src/services/llm.py` | Modify (new methods, params, max_tokens) |
| `services/summarizer/src/routes/stream.py` | Modify (pass time range, integrate fact extraction, add validation) |

### Frontend
| File | Action |
|------|--------|
| `packages/types/src/index.ts` | Modify (add ProblemSolutionBlock, VisualBlock) |
| `apps/web/src/components/video-detail/blocks/ProblemSolutionBlock.tsx` | **NEW** |
| `apps/web/src/components/video-detail/blocks/VisualBlock.tsx` | **NEW** |
| `apps/web/src/components/video-detail/ContentBlockRenderer.tsx` | Modify (add cases) |
| `apps/web/src/components/video-detail/blocks/index.ts` | Modify (add exports) |

---

## What NOT to Change

- Block type system (existing 31 types stay as-is)
- Chapter title flow (already correct: creator first, LLM as subtitle)
- View resolution system
- Persona selection/detection logic
- Frontend layout engine
- LLMProvider implementation (complete_fast already exists)
