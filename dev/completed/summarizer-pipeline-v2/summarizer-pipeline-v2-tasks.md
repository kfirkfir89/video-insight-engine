# Summarizer Pipeline V2 — Task Checklist

**Last Updated:** 2026-03-02

---

## Phase 1: Output Type Determination (Day 1) — S

- [x] **1.1** Create `services/summarizer/src/services/output_type.py`
  - [x] Define `OutputType` literal type
  - [x] Define `CATEGORY_TO_OUTPUT_TYPE` mapping (10 entries + default)
  - [x] Implement `determine_output_type(category: str) -> str`
  - [x] Implement `get_output_type_label(output_type: str) -> str` for display names
- [x] **1.2** Add OutputType to `models/schemas.py`
  - [x] Add `OutputType` literal to schema enums
- [x] **1.3** Wire into pipeline context
  - [x] Add `output_type` field to `PipelineContext` dataclass in `pipeline_helpers.py`
  - [x] Call `determine_output_type()` in `extract_context()` / after category detection
  - [x] Include `outputType` in SSE `metadata` event payload

---

## Phase 2: Prompt Reframing (Days 2-3) — L

- [x] **2.1** Update `prompts/chapter_summary.txt`
  - [x] Add `{output_type_framing}` placeholder
  - [x] Ensure it integrates naturally with existing format variables
- [x] **2.2** Update `prompts/global_synthesis.txt`
  - [x] Prompt is output-type-agnostic by design (focuses on insight extraction)
- [x] **2.3** Update `prompts/master_summary.txt`
  - [x] Already has `Content Type: {persona}` for context
- [x] **2.4** Reframe persona files
  - [x] `prompts/personas/recipe.txt` — "Create a complete recipe"
  - [x] `prompts/personas/code.txt` — "Create a step-by-step tutorial"
  - [x] `prompts/personas/fitness.txt` — "Create a complete workout plan"
  - [x] `prompts/personas/education.txt` — "Create a study guide"
  - [x] `prompts/personas/travel.txt` — "Create a travel plan"
  - [x] `prompts/personas/review.txt` — "Create a product review"
  - [x] `prompts/personas/interview.txt` — "Create podcast notes"
  - [x] `prompts/personas/music.txt` — "Create a music guide"
  - [x] `prompts/personas/standard.txt` — "Create a comprehensive summary"
- [x] **2.5** Add completeness rules to persona files
  - [x] Recipe: "MUST include ALL ingredients and ALL steps"
  - [x] Tutorial: "MUST include ALL code snippets and ALL commands"
  - [x] Workout: "MUST include ALL exercises with sets/reps"
  - [x] Study guide: "MUST include ALL key concepts and definitions"
- [x] **2.6** Update `services/prompt_builders.py`
  - [x] Add `build_output_type_framing(output_type: str) -> str` helper
  - [x] Add `output_type` parameter to `build_chapter_prompt()` (via ChapterContext)
  - [x] Inject framing into prompt template via new placeholder
  - [x] Verify no regression in existing format variable handling

---

## Phase 3: Cross-Chapter Consolidation (Days 3-5) — L

- [x] **3.1** Create `services/summarizer/src/services/cross_chapter_consolidation.py`
  - [x] Define `consolidate_chapters(chapters: list[dict], output_type: str) -> dict | None`
  - [x] Returns consolidated data with merged blocks + blockIds
- [x] **3.2** Implement consolidation strategies
  - [x] `_consolidate_recipe(chapters)` — merge ingredient + step blocks (with dedup)
  - [x] `_consolidate_tutorial(chapters)` — merge code/terminal/file_tree blocks
  - [x] `_consolidate_workout(chapters)` — merge exercise + workout_timer blocks
  - [x] `_consolidate_travel(chapters)` — merge itinerary/location/cost blocks
  - [x] Default passthrough for non-consolidation output types (returns None)
- [x] **3.3** Wire into streaming pipeline
  - [x] Call `consolidate_chapters()` in `build_result()` in `pipeline_helpers.py`
  - [x] Include consolidated data in result dict
  - [x] Ensure `blockId` injected on consolidated blocks (uuid4)
- [x] **3.4** Update result building
  - [x] Include consolidated data in `build_result()` in `pipeline_helpers.py`
  - [x] Include in MongoDB storage via `save_result()`

---

## Phase 4: Detection Override SSE (Days 5-6) — M

- [x] **4.1** Emit `detection_result` SSE event
  - [x] Add event emission in `stream.py` after category detection, before chapter processing
  - [x] Include: category, outputType, confidence
- [x] **4.2** Create `services/summarizer/src/routes/override.py`
  - [x] Define `POST /override/{video_summary_id}` endpoint
  - [x] Validate category is in valid set (VALID_CATEGORIES)
  - [x] Module-level `_overrides: dict[str, dict[str, str]]` for state
  - [x] Return 200 with new outputType + persona + outputTypeLabel
  - [x] Return 422 for invalid category
- [x] **4.3** Check override during chapter processing
  - [x] Add `check_override(video_summary_id)` call before each chapter batch in `stream.py`
  - [x] If override found: use overridden persona/outputType for remaining chapters
  - [x] Log override event for debugging
  - [x] Clean up override state after pipeline completes (in finally block)
- [x] **4.4** Register override router in `main.py`
  - [x] Import `override_router`
  - [x] `app.include_router(override_router)`

---

## Phase 5: OutputType in DB (Day 6) — S

- [x] **5.1** Include `outputType` in SSE metadata
  - [x] `outputType` flows through detection_result SSE event
  - [x] `outputType` included in context_dict (metadata event)
- [x] **5.2** Save to MongoDB
  - [x] Add top-level `outputType` to `save_result()` in `mongodb_repository.py`
  - [x] Add `totalTokens` (int: sum of input + output) to `save_result()`
  - [x] Add `consolidated` data to `save_result()`
  - [x] Ensure existing `tokenUsage` dict is preserved alongside `totalTokens`
- [x] **5.3** Update result builder
  - [x] Include `output_type` in result dict from `build_result()` in `pipeline_helpers.py`

---

## Phase 6: Validation + Tests (Day 7) — M

- [x] **6.1** OutputType validation in `schemas.py`
  - [x] `OutputType` literal type defined in schemas.py
- [x] **6.2** Unit tests: `tests/test_output_type.py` (28 tests)
  - [x] Test all 10 category → outputType mappings
  - [x] Test unknown category → "summary" default
  - [x] Test edge cases (empty string, case sensitivity, whitespace)
  - [x] Test all output type labels
- [x] **6.3** Unit tests: `tests/test_consolidation.py` (30 tests)
  - [x] Test recipe consolidation (merge ingredients, steps, dedup)
  - [x] Test tutorial consolidation (merge code/terminal/file_tree blocks)
  - [x] Test workout consolidation (merge exercises + workout_timer)
  - [x] Test travel consolidation (merge itinerary/location/cost)
  - [x] Test default passthrough (no consolidation)
  - [x] Test empty chapters list
  - [x] Test single chapter (no merge needed)
  - [x] Test blockId injection on consolidated blocks
- [x] **6.4** Unit tests: `tests/test_override.py` (32 tests)
  - [x] Test override state set and get
  - [x] Test cleanup after use
  - [x] Test invalid category rejection (422)
  - [x] Test concurrent overrides (different videoSummaryIds)
  - [x] Test endpoint via minimal FastAPI test app
  - [x] Test case insensitivity and whitespace stripping
- [x] **6.5** Regression tests
  - [x] Ran full test suite: 786 passed, 25 pre-existing failures (none from pipeline v2)
  - [x] Core pipeline tests (pipeline_helpers, youtube_service, concept_processing): all pass

---

## Progress Summary

| Phase | Status | Completion |
|-------|--------|------------|
| Phase 1: Output Type Determination | Complete | 100% |
| Phase 2: Prompt Reframing | Complete | 100% |
| Phase 3: Cross-Chapter Consolidation | Complete | 100% |
| Phase 4: Detection Override SSE | Complete | 100% |
| Phase 5: OutputType in DB | Complete | 100% |
| Phase 6: Validation + Tests | Complete | 100% |
| **Overall** | **Complete** | **100%** |
