# Summarizer Pipeline V2 — Comprehensive Plan

**Last Updated:** 2026-03-02
**Depends on:** Plan 0 (OutputType mapping, SSE event format)
**Produces:** SSE events consumed by Plans 1+2, outputType written to DB

---

## Executive Summary

Transform the summarizer from a "chapter summary" generator into an **actionable output** generator. A cooking video should produce a complete recipe, a coding video should produce a tutorial, a fitness video should produce a workout plan. This involves:

1. **Output type determination** — Map category → outputType
2. **Prompt reframing** — Shift from "summarize" to "create actionable output"
3. **Cross-chapter consolidation** — Merge scattered data (ingredients, steps) into coherent outputs
4. **Detection override SSE** — Let users override detected category mid-pipeline
5. **OutputType in DB** — Persist outputType + totalTokens
6. **Validation + tests** — Ensure correctness

---

## Current State Analysis

### What Exists

| Component | File | Status |
|-----------|------|--------|
| Category detection | `youtube.py` (weighted scoring + LLM fallback) | Working, 11 categories |
| Category → Persona mapping | `youtube.py:CATEGORY_TO_PERSONA` | Working, 10 entries |
| Persona prompt files | `prompts/personas/*.txt` (9 files) | Working but "summary" framing |
| Chapter summarization | `llm.py` + `prompt_builders.py` | Working, block-based output |
| SSE streaming | `routes/stream.py` (4-phase pipeline) | Working, ~10 event types |
| Block post-processing | `block_postprocessing.py` | Working, view detection |
| MongoDB storage | `mongodb_repository.py` | Working, no `outputType` field |
| Prompt templates | `prompts/chapter_summary.txt` (45KB) | Working, "summary" framing |

### What's Missing

| Component | Status |
|-----------|--------|
| OutputType enum/mapping | Not created |
| Prompt reframing ("create X" vs "summarize") | Not done |
| Cross-chapter consolidation (merge ingredients, steps) | Not created |
| Detection override endpoint | Not created |
| `detection_result` SSE event | Not emitted |
| `outputType` in metadata SSE event | Not included |
| `outputType` + `totalTokens` in DB | Not stored |

### Architectural Constraints

- SSE pipeline is **4 phases** — detection override must happen between Phase 1 (metadata) and Phase 3 (chapter processing)
- `CATEGORY_TO_PERSONA` in `youtube.py` is the **single source of truth** for category→persona
- Block types (32 total) already support category-specific content (ingredient, step, exercise, etc.)
- Prompt builders already inject persona context — need to shift the framing, not the plumbing
- `block_postprocessing.py` already detects "view" from block signatures — consolidation should happen after this

---

## Proposed Future State

### OutputType Flow

```
Category Detection (youtube.py)
        │
        ▼
CATEGORY_TO_OUTPUT_TYPE mapping (new)
        │
        ├──▶ SSE: detection_result event (category + outputType + confidence)
        │
        ├──▶ SSE: metadata event (includes outputType)
        │
        ├──▶ Prompt builders (reframed: "create a {outputType}")
        │
        ├──▶ Cross-chapter consolidation (merge scattered blocks)
        │
        └──▶ MongoDB (save outputType + totalTokens)
```

### OutputType Mapping (from Plan 0)

```
cooking   → recipe         coding    → tutorial
fitness   → workout         education → study_guide
travel    → travel_plan     reviews   → review
podcast   → podcast_notes   diy       → diy_guide
gaming    → game_guide      music     → music_guide
standard  → summary
```

### Detection Override Flow

```
Client ◀── SSE: detection_result {category, outputType, confidence}
  │
  │  User sees: "Detected: Cooking Video → Recipe"
  │  User clicks: "Actually this is a Fitness Video"
  │
  ▼
Client ──▶ POST /override/:videoSummaryId {category: "fitness"}
  │
  ▼
Server:
  1. Update persona for remaining chapters
  2. Update outputType
  3. Continue processing with new persona
```

---

## Implementation Phases

### Phase 1: Output Type Determination (Day 1) — Effort: S

**Goal:** Create the mapping from category → outputType and integrate it into the pipeline context.

**Tasks:**

1.1 **Create `output_type.py` service**
- File: `services/summarizer/src/services/output_type.py`
- Add `CATEGORY_TO_OUTPUT_TYPE` mapping (11 entries + default)
- Add `determine_output_type(category: str) -> str` function
- Add `OutputType` literal type
- ~30 lines

1.2 **Add OutputType to schemas**
- File: `services/summarizer/src/models/schemas.py`
- Add `OutputType = Literal['recipe', 'tutorial', 'workout', ...]`
- Add `outputType` field to relevant models

1.3 **Wire into pipeline context**
- File: `services/summarizer/src/services/pipeline_helpers.py`
- Call `determine_output_type()` after category detection
- Include `outputType` in `PipelineContext` dataclass
- Include `outputType` in SSE metadata event

**Acceptance Criteria:**
- [ ] `determine_output_type("cooking")` returns `"recipe"`
- [ ] `determine_output_type("unknown")` returns `"summary"`
- [ ] `outputType` appears in SSE `metadata` event
- [ ] Unit tests for all 11 category mappings

---

### Phase 2: Prompt Reframing (Days 2-3) — Effort: L

**Goal:** Shift all prompts from "summarize this video" to "create actionable output".

**Tasks:**

2.1 **Update `chapter_summary.txt` prompt**
- File: `services/summarizer/src/prompts/chapter_summary.txt`
- Add `{output_type_framing}` placeholder
- Change framing: "Your task is to create a {output_type}" instead of "summarize"
- Add completeness rules per output type

2.2 **Update `global_synthesis.txt` prompt**
- File: `services/summarizer/src/prompts/global_synthesis.txt`
- Add output type context: "This video produces a {output_type}"
- Adjust TLDR framing: "This {output_type} covers..." not "This video covers..."

2.3 **Update `master_summary.txt` prompt**
- File: `services/summarizer/src/prompts/master_summary.txt`
- Adapt synthesis to output type context

2.4 **Reframe persona files** (9 files)
- `prompts/personas/recipe.txt` — "Create a complete recipe" with completeness rules
- `prompts/personas/code.txt` — "Create a step-by-step tutorial"
- `prompts/personas/fitness.txt` — "Create a complete workout plan"
- `prompts/personas/education.txt` — "Create a study guide"
- `prompts/personas/travel.txt` — "Create a travel plan"
- `prompts/personas/review.txt` — "Create a product review"
- `prompts/personas/interview.txt` — "Create podcast/interview notes"
- `prompts/personas/music.txt` — "Create a music guide"
- `prompts/personas/standard.txt` — "Create a comprehensive summary"

2.5 **Add completeness rules**
- Recipe: "MUST include ALL ingredients and ALL steps"
- Tutorial: "MUST include ALL code snippets and ALL commands"
- Workout: "MUST include ALL exercises with sets/reps"
- Study guide: "MUST include ALL key concepts and definitions"

2.6 **Update prompt builders**
- File: `services/summarizer/src/services/prompt_builders.py`
- Pass `outputType` to `build_chapter_prompt()`
- Add `build_output_type_framing(output_type: str) -> str` helper
- Inject framing into the prompt template

**Acceptance Criteria:**
- [ ] `build_chapter_prompt()` includes output type framing
- [ ] Each persona file has "create a {X}" framing
- [ ] Completeness rules present for recipe, tutorial, workout, study_guide
- [ ] Existing prompt format variables still work (no regressions)
- [ ] All 9 persona files updated

---

### Phase 3: Cross-Chapter Consolidation (Days 3-5) — Effort: L

**Goal:** After all chapters are processed, consolidate scattered data into coherent outputs (e.g., merge all ingredient blocks into a single ingredients list).

**Tasks:**

3.1 **Create `cross_chapter_consolidation.py`**
- File: `services/summarizer/src/services/cross_chapter_consolidation.py`
- Main function: `consolidate_chapters(chapters: list[dict], output_type: str) -> list[dict]`
- Strategy per output type:

```python
# Recipe: merge ingredients → single list, steps → single sequence
# Tutorial: merge code blocks → ordered sequence
# Workout: merge exercises → single workout plan
# Travel: merge timeline/itinerary → single timeline
# Review: aggregate cost/specs → combined budget
```

3.2 **Implement consolidation strategies**
- `consolidate_recipe(chapters)` — Merge ingredient blocks, cooking step blocks
- `consolidate_tutorial(chapters)` — Merge code/terminal blocks into sequence
- `consolidate_workout(chapters)` — Merge exercise blocks into workout
- `consolidate_travel(chapters)` — Merge itinerary/cost blocks
- Default: no consolidation (keep chapter structure)
- ~100-150 lines total

3.3 **Wire into streaming pipeline**
- File: `services/summarizer/src/routes/stream.py`
- Call `consolidate_chapters()` after all chapters processed, before `complete` event
- Emit consolidated data as part of the final result
- Ensure consolidated blocks get `blockId` injected

3.4 **Update result building**
- File: `services/summarizer/src/services/pipeline_helpers.py`
- Include consolidated data in `build_result()`

**Acceptance Criteria:**
- [ ] Recipe with 3 chapters → single ingredients list + single steps sequence
- [ ] Tutorial with 4 chapters → ordered code snippets
- [ ] Non-applicable output types return chapters unchanged
- [ ] Consolidated blocks have valid `blockId`
- [ ] Unit tests for each consolidation strategy
- [ ] Integration: consolidation runs in pipeline without errors

---

### Phase 4: Detection Override SSE (Days 5-6) — Effort: M

**Goal:** Allow users to override the detected category during processing.

**Tasks:**

4.1 **Emit `detection_result` SSE event**
- File: `services/summarizer/src/routes/stream.py`
- After category detection runs, emit:
  ```json
  {"event": "detection_result", "category": "cooking", "outputType": "recipe", "confidence": 0.85}
  ```
- Emit before chapter processing begins

4.2 **Create override endpoint**
- File: `services/summarizer/src/routes/override.py`
- `POST /override/{video_summary_id}` with body: `{"category": "fitness"}`
- Validate category is in valid set
- Store override in shared state (in-memory dict keyed by videoSummaryId)
- Return 200 with new outputType

4.3 **Check override during chapter processing**
- File: `services/summarizer/src/routes/stream.py`
- Before each chapter batch, check for override
- If override found: switch persona, update outputType, update pipeline context
- Apply new persona to remaining chapters (already-processed chapters keep their output)

4.4 **Register override router**
- File: `services/summarizer/src/main.py`
- Import and register the override router

**Acceptance Criteria:**
- [ ] `detection_result` SSE event emitted with category, outputType, confidence
- [ ] POST `/override/{id}` changes persona for remaining chapters
- [ ] Already-processed chapters are not re-processed
- [ ] Invalid category returns 422
- [ ] Override state cleaned up after pipeline completes
- [ ] Concurrent pipeline safety (each pipeline gets own override slot)

---

### Phase 5: OutputType in DB (Day 6) — Effort: S

**Goal:** Persist outputType and totalTokens in MongoDB.

**Tasks:**

5.1 **Include `outputType` in SSE metadata event**
- File: `services/summarizer/src/routes/stream.py`
- Add `outputType` field to the metadata SSE event payload
- Already partially wired in Phase 1, ensure it propagates

5.2 **Save `outputType` + `totalTokens` to DB**
- File: `services/summarizer/src/repositories/mongodb_repository.py`
- Add `outputType` to `save_result()` method
- Add `totalTokens` (sum of input + output tokens) to storage
- Ensure existing `tokenUsage` field is preserved

5.3 **Update result builder**
- File: `services/summarizer/src/services/pipeline_helpers.py`
- Include `outputType` in the result dict from `build_result()`

**Acceptance Criteria:**
- [ ] `outputType` stored in `videoSummaryCache` document
- [ ] `totalTokens` stored as integer (input + output sum)
- [ ] Cached results include `outputType` when served
- [ ] Backfill script from Plan 0 handles existing documents

---

### Phase 6: Validation + Tests (Day 7) — Effort: M

**Goal:** Ensure correctness and prevent regressions.

**Tasks:**

6.1 **Strengthen Pydantic validation for blocks**
- File: `services/summarizer/src/models/schemas.py`
- Add validators for block content (e.g., ingredient blocks must have items)
- Add OutputType enum validation

6.2 **Unit tests for output_type.py**
- All 11 category → outputType mappings
- Unknown category → "summary" default
- Edge cases (empty string, None)

6.3 **Unit tests for consolidation logic**
- Test each consolidation strategy
- Test with empty chapters, single chapter, many chapters
- Test that blockIds are preserved/injected
- Test non-applicable output types pass through unchanged

6.4 **Unit tests for override behavior**
- Test override state management
- Test persona switch mid-pipeline
- Test cleanup after pipeline completes
- Test concurrent override safety

6.5 **Integration tests**
- Full pipeline with outputType flowing through
- Override during active pipeline
- Cached result includes outputType

**Acceptance Criteria:**
- [ ] All unit tests pass
- [ ] >80% coverage on new code
- [ ] No regressions in existing pipeline
- [ ] Pydantic validation catches malformed blocks

---

## Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Prompt changes degrade output quality | High | Medium | A/B test with sample videos before deploying; keep old prompts as fallback |
| Override race condition (concurrent requests) | Medium | Low | Use dict keyed by videoSummaryId with asyncio lock |
| Consolidation produces duplicates | Medium | Medium | Dedup by content hash before merging |
| Large prompt changes break JSON parsing | High | Low | Keep same JSON output format; only change framing text |
| OutputType not matching frontend expectations | Medium | Medium | Use Plan 0 contracts as source of truth |

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Recipe outputs include ALL ingredients | 95%+ completeness |
| Tutorial outputs include ALL code snippets | 90%+ completeness |
| Override response time | < 200ms |
| No regression in pipeline processing time | < 5% increase |
| Test coverage on new code | > 80% |

---

## Dependencies

### Upstream (must exist before this work)
- Plan 0: `OutputType` type definition in `packages/types`
- Plan 0: `CATEGORY_TO_OUTPUT_TYPE` mapping agreement
- Plan 0: SSE event format for `detection_result`

### Downstream (this work unblocks)
- Plan 1 (Frontend): Render outputType-aware UI
- Plan 2 (API): Route override requests from frontend to summarizer
- Plan 4 (Explainer/Admin): Display outputType in admin panel

---

## Files Modified/Created

### New Files
| File | Phase | Lines (est.) |
|------|-------|-------------|
| `services/summarizer/src/services/output_type.py` | 1 | ~40 |
| `services/summarizer/src/services/cross_chapter_consolidation.py` | 3 | ~150 |
| `services/summarizer/src/routes/override.py` | 4 | ~60 |
| `services/summarizer/tests/test_output_type.py` | 6 | ~50 |
| `services/summarizer/tests/test_consolidation.py` | 6 | ~120 |
| `services/summarizer/tests/test_override.py` | 6 | ~80 |

### Modified Files
| File | Phase | Changes |
|------|-------|---------|
| `models/schemas.py` | 1 | Add OutputType literal |
| `services/pipeline_helpers.py` | 1, 5 | Add outputType to context + result |
| `routes/stream.py` | 1, 3, 4 | Emit detection_result, wire consolidation, check override |
| `prompts/chapter_summary.txt` | 2 | Add output_type_framing placeholder |
| `prompts/global_synthesis.txt` | 2 | Add output type context |
| `prompts/master_summary.txt` | 2 | Adapt to output type |
| `prompts/personas/*.txt` (9 files) | 2 | Reframe all personas |
| `services/prompt_builders.py` | 2 | Pass outputType, add framing helper |
| `repositories/mongodb_repository.py` | 5 | Save outputType + totalTokens |
| `main.py` | 4 | Register override router |
