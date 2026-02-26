# Block Output Quality — Context

> Last Updated: 2026-02-24
> Status: Phases 1-3 COMPLETE, Phase 4 PARTIAL (backend tests + integration verification remaining)

## Key Files

### Prompt Files
| File | Purpose | Key Locations |
|------|---------|---------------|
| `services/summarizer/src/prompts/chapter_summary.txt` | Main chapter summarization prompt (~450 lines) | ACCURACY RULES: 340-346, TONE MATCHING: 348-354, CALLOUT GATE: 61-72, BLOCK COUNT: 324-328, SELF-CHECK: 437-447, problem_solution/visual defs: 225-233, fact_sheet placeholder: 446 |
| `services/summarizer/src/prompts/chapter_facts.txt` | **NEW** — Fact extraction prompt (Haiku pre-pass) | Universal + category-specific fields |
| `services/summarizer/src/prompts/chapter_validate.txt` | **NEW** — Post-validation prompt (Haiku non-blocking) | Missing items, renamed terms, accuracy scoring |
| `services/summarizer/src/prompts/personas/*.txt` | Category-specific block preferences | All 9 files expanded with PREFERRED V2.1 BLOCKS + ACCURACY RULES |

### Backend
| File | Purpose | Key Locations |
|------|---------|---------------|
| `services/summarizer/src/services/llm.py` | LLM service | `CATEGORY_FACT_FIELDS`: ~95, `_build_concept_prompt_parts()`: ~478 (max_tokens 3000/2500), `summarize_chapter()`: ~1108 (added start_seconds/end_seconds/facts params), `extract_chapter_facts()`: ~1281, `validate_chapter_blocks()`: ~1322, `stream_summarize_chapter()`: ~1566 |
| `services/summarizer/src/services/llm_provider.py` | LLM provider with complete_fast | `complete_fast()`: ~119-163 |
| `services/summarizer/src/routes/stream.py` | SSE streaming endpoint | First chapter + parallel facts: ~531-548, validation: ~589-595, batch chapters: ~836, AI chapters: ~1000 |

### Frontend
| File | Purpose |
|------|---------|
| `packages/types/src/index.ts` | ContentBlock union type — now includes ProblemSolutionBlock (426-431) and VisualBlock (433-441), union at 488-489 |
| `apps/web/src/components/video-detail/ContentBlockRenderer.tsx` | Block routing switch — cases for problem_solution (247) and visual (249-251) |
| `apps/web/src/components/video-detail/blocks/ProblemSolutionBlock.tsx` | **NEW** — Two-section card: problem (red) + solution (green) |
| `apps/web/src/components/video-detail/blocks/VisualBlock.tsx` | **NEW** — Variant icons, optional image, timestamp link |
| `apps/web/src/components/video-detail/blocks/index.ts` | Exports both new components |
| `apps/web/src/components/video-detail/blocks/__tests__/problem-solution-block.test.tsx` | Tests for ProblemSolutionBlock |
| `apps/web/src/components/video-detail/blocks/__tests__/visual-block.test.tsx` | Tests for VisualBlock |

## Key Decisions

### 1. Dynamic Block Count (1-4 -> 2-7)
**Decision:** Replace hardcoded "1-4 blocks" with content-aware guidelines based on chapter duration.
**Why:** Forcing 1-4 blocks causes the LLM to cram long chapters into too few blocks, dropping details and oversimplifying.

### 2. Pre-Extraction Pass with Haiku
**Decision:** Use `complete_fast()` (Haiku) to extract a structured fact sheet before main summarization.
**Why:** The fact sheet becomes a checklist the main model must satisfy — nothing gets dropped. Cost: ~$0.001/chapter, latency: ~1s.

### 3. Category-Aware Fact Extraction
**Decision:** Different content types need different facts extracted (recipe -> ingredients, code -> snippets, review -> specs).
**Why:** Generic extraction misses domain-critical details. A recipe missing one ingredient is useless.
**Implementation:** `CATEGORY_FACT_FIELDS` dictionary in llm.py maps persona to extraction fields.

### 4. Non-Blocking Post-Validation
**Decision:** Validate blocks against fact sheet asynchronously (don't block pipeline). Log metrics only for now.
**Why:** Adds observability without latency. Future: re-generate if score < 7.
**Implementation:** `asyncio.create_task()` in stream.py after summarization.

### 5. New Block Types: problem_solution + visual
**Decision:** Add two new block types to cover common content patterns currently forced into paragraphs.
**Why:** "Problem -> solution" is a natural teaching pattern. "Visual moment" captures what transcript alone misses.
**Implementation:** Types in packages/types, components in blocks/, routing in ContentBlockRenderer.

### 6. max_tokens Increase (2000->3000)
**Decision:** Increase token budget for chapter summaries.
**Why:** More blocks per chapter = each block more focused = better accuracy. With dynamic 2-7 blocks, need more token headroom.
**Implementation:** `_build_concept_prompt_parts()` in llm.py: 2000->3000 (with concepts), 1500->2500 (without).

## Dependencies

### External
- `complete_fast()` on LLMProvider — already exists, uses Haiku
- Block rendering system — mature, 33 types now (31 original + problem_solution + visual), has unknown-type fallback
- Persona detection — works, no changes needed

### Internal (between phases)
- Phase 2 depends on Phase 1 (prompt accuracy rules must be in place before timestamp work)
- Phase 3 depends on Phase 2 (fact extraction feeds into the updated prompt with fact_sheet placeholder)
- Phase 4 spans all phases (testing happens throughout)

## Current Method Signatures (Post-Implementation)

### `summarize_chapter()` (llm.py:~1108)
```python
async def summarize_chapter(
    self,
    chapter_text: str,
    title: str,
    has_creator_title: bool = False,
    persona: str = 'standard',
    concept_names: list[str] | None = None,
    extract_concepts: bool = False,
    total_chapters: int | None = None,
    already_extracted_names: list[str] | None = None,
    start_seconds: float | None = None,      # NEW
    end_seconds: float | None = None,         # NEW
    facts: str | None = None,                 # NEW
) -> dict:
```

### `stream_summarize_chapter()` (llm.py:~1566)
```python
async def stream_summarize_chapter(
    self,
    chapter_text: str,
    title: str,
    persona: str = 'standard',
    concept_names: list[str] | None = None,
    extract_concepts: bool = False,
    total_chapters: int | None = None,
    already_extracted_names: list[str] | None = None,
    start_seconds: float | None = None,      # NEW
    end_seconds: float | None = None,         # NEW
    facts: str | None = None,                 # NEW
) -> AsyncGenerator[StreamEvent, None]:
```

### `extract_chapter_facts()` (llm.py:~1281) — NEW
```python
async def extract_chapter_facts(
    self,
    chapter_text: str,
    persona: str = 'standard',
) -> str:
```

### `validate_chapter_blocks()` (llm.py:~1322) — NEW
```python
async def validate_chapter_blocks(
    self,
    chapter_text: str,
    blocks: list[dict],
    facts: str | None = None,
) -> dict:
```

### Call Sites in stream.py
- Line ~531: First chapter facts extraction (parallel with first_chapter and concepts)
- Line ~548: First chapter summarization (passes start_seconds, end_seconds, facts)
- Line ~589-595: Non-blocking validation (asyncio.create_task)
- Line ~836: Remaining chapters (batch processing with time range)
- Line ~1000: AI-generated chapters (batch processing with time range)

## Existing Test Infrastructure
- Backend: `services/summarizer/tests/` — pytest
  - `test_block_quality_v3.py` — diversity enforcement tests (NOT fact extraction/validation tests)
- Frontend: `apps/web/src/components/video-detail/blocks/__tests__/` — 23 test files, Vitest + Testing Library
  - `problem-solution-block.test.tsx` — renders problem/solution, labels, context handling
  - `visual-block.test.tsx` — renders description, variants, images, timestamps, seek callback
- TypeScript checks: `cd apps/web && npx tsc --noEmit`

## What's Left to Do (Phase 4 Remaining)

### Backend Tests (Priority: Medium)
1. **4.1** Unit test for `extract_chapter_facts()` — mock `complete_fast()`, verify correct prompt construction per persona, verify JSON parsing
2. **4.2** Unit test for `validate_chapter_blocks()` — mock `complete_fast()`, verify it catches missing items/renamed terms/timestamp violations
3. **4.3** Unit test for `CATEGORY_FACT_FIELDS` — verify each persona gets correct extraction fields

### Verification (Priority: Low — manual)
4. **4.6** TypeScript compilation: `cd apps/web && npx tsc --noEmit`
5. **4.7** Integration test with education video (ID: 699c5b9fbceeb26e66e3cb14)
6. **4.8** Cross-category verification (recipe, review, fitness, travel, code, interview)

## Notes
- `has_creator_title` is only passed as `True` at stream.py first chapter. The `generatedTitle` improvement only applies when `has_creator_title=True`.
- View signature matching requires 2+ blocks to override LLM view. Adding `problem_solution` and `visual` to personas won't affect this since they're not view-signature blocks.
- The prompt now uses `{content}`, `{title}`, `{chapter_time_range}`, and `{fact_sheet}` as format placeholders.
- Fact extraction runs in parallel with batch processing — adds ~1s latency (Haiku) but not on the critical path.
- Validation is fully non-blocking via `asyncio.create_task()` — logs metrics only, never blocks SSE stream.
