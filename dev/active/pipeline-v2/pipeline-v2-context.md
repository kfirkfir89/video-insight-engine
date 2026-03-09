# Pipeline v2: Context & Key Files

> Last Updated: 2026-03-05 (Session 8 — All 10 output types validated live)

---

## Current State

Pipeline v2 is **fully functional end-to-end with all 10 output types validated**. Successfully tested with 11 real YouTube videos across all 10 output types. All rendering correctly in the frontend with proper tabs, structured content, and interactive features.

Key fixes this session: (1) Added Pydantic null-coercion field_validators for VerdictRating (score/maxScore), VerdictDecision (badge), TripBudget (total/currency), TripPlannerOutput (totalDays), (2) Added yt-dlp-ejs to requirements.txt for persistent JS challenge support, (3) Fixed intent_detector type annotation for unknown output type fallback.

Remaining work: Integration tests with fixtures, edge cases, performance benchmarks. enrich_code cheat sheet validation deferred.

---

## Key Decisions

### 1. ONE System (no V1/V2)
- **Decision:** UOS deleted all V1 code. There is no version branching anywhere.
- **Impact:** No `pipelineVersion` field, no V1/V2 routing, no backward compat.
- **Rule:** UOS decisions always win over original pipeline-v2 plan.

### 2. Canonical Type Names (no V2 prefix)
- **Decision:** Types use canonical names: `OutputType` (not `OutputTypeV2`), `explanation` (not `smart_summary`)
- **Location:** `packages/types/src/output-types.ts` (canonical TS), `services/summarizer/src/models/output_types.py` (canonical Python)
- **Status:** DONE — no V2 aliases remain

### 3. Adaptive Extraction (NOT Single Call)
- **Decision:** Use 1-3 extraction calls based on transcript length
- **Thresholds:** <4K words = 1 call, 4-15K = 1+overflow, 15K+ = segmented by time
- **Implementation:** DONE — `extractor.py` (228 lines)

### 4. Standard Section IDs (CRITICAL)
- **Decision:** Always use standard section IDs from `_TYPE_SECTIONS` dict, never LLM-provided IDs
- **Reason:** LLM returns creative section names (e.g., `dish_inspiration`, `method`) that don't match frontend tab switch cases (expects `overview`, `ingredients`, `steps`, `tips`)
- **Implementation:** `intent_detector.py` line ~166: `result.sections = list(_TYPE_SECTIONS.get(result.output_type, _DEFAULT_SECTIONS))`

### 5. Gemini Thinking Model Token Budget
- **Decision:** Gemini 2.5 Flash uses ~900 tokens from max_tokens budget for reasoning
- **Impact:** All max_tokens increased: intent=4096, extractor=16384, synthesis=8192
- **Implementation:** Set in respective service files

### 6. Glass Card Design System
- **Decision:** Glass morphism cards as atomic content unit
- **Implementation:** DONE — `GlassCard.tsx` in `output/`

---

## Key Files — Python Backend (DONE)

### Services (fully implemented + live-tested)
| File | Lines | Status |
|------|-------|--------|
| `services/summarizer/src/services/intent_detector.py` | 174 | DONE — standard sections, category fallback, confidence threshold |
| `services/summarizer/src/services/extractor.py` | 229 | DONE — 3 adaptive strategies, max_tokens=16384 |
| `services/summarizer/src/services/enrichment.py` | 64 | DONE — study_kit + code_walkthrough |
| `services/summarizer/src/services/synthesis.py` | 41 | DONE — max_tokens=8192 |
| `services/summarizer/src/utils/json_parsing.py` | 364 | DONE — JSON repair pipeline, comment stripping, truncation repair |

### Models (clean)
| File | Lines | Status |
|------|-------|--------|
| `services/summarizer/src/models/output_types.py` | 578 | DONE — canonical names, 10 types, validate_output() |

### Pipeline Orchestration (DONE)
| File | Status |
|------|--------|
| `services/summarizer/src/routes/stream.py` | DONE — V1 removed, uses save_structured_result() |
| `services/summarizer/src/repositories/mongodb_repository.py` | DONE — added save_structured_result() |

### Frontend Config
| File | Status |
|------|--------|
| `apps/web/src/lib/output-type-config.ts` | DONE — canonical output type names |

---

## Live Test Results (Sessions 6-7)

### Successfully Processed Videos (8 total)
| Video | Type Detected | Tabs | Content Quality |
|-------|--------------|------|-----------------|
| "Pasta Aglio e Olio" (Babish) | recipe | overview/ingredients/steps/tips | Excellent |
| "Svelte in 100 Seconds" (Fireship) | code_walkthrough | overview/code/concepts/takeaways | Excellent |
| "What Are You?" (Kurzgesagt) | study_kit | overview/concepts/quiz/takeaways | Excellent |
| "20 MIN WORKOUT" (Pamela Reif) | workout | overview/exercises/timer/takeaways | Fair (sparse speech) |
| "Steve Jobs Stanford" | study_kit | overview/concepts/quiz/takeaways | Excellent |
| "Neural Network" (3Blue1Brown) | study_kit | overview/concepts/quiz/takeaways | Excellent |
| "Power of Vulnerability" (Brene Brown) | code_walkthrough (misclassified) | overview/code/concepts/takeaways | Good (wrong type) |
| "Bohemian Rhapsody" (Queen) | music_guide | overview/analysis/takeaways | Good |

| "MKBHD Camera Test" | verdict | overview/pros_cons/ratings/verdict | Excellent |
| "Japan Travel Guide" (Island Hopper TV) | trip_planner | overview/itinerary/locations/tips | Excellent |
| "3 Levels End Tables" (John Malecki) | project_guide | overview/materials/steps/tips | Excellent |

### All 10 Types Validated
All output types tested and rendering correctly in frontend.

---

## SSE Event Protocol

```
metadata           -> { title, channel, thumbnailUrl, duration }
transcript_ready   -> { duration: number }
intent_detected    -> { outputType, confidence, userGoal, sections: [...] }
extraction_progress -> { section: "ingredients", percent: 30 }
extraction_complete -> { outputType: "recipe", data: {...full output...} }
enrichment_complete -> { quiz?: [...], flashcards?: [...] }
synthesis_complete  -> { tldr, keyTakeaways, masterSummary, seoDescription }
done               -> { videoSummaryId, processingTimeMs }
```

---

## Dependencies Between Phases

```
Phase A (Python Stubs) -- DONE
|-- Phase B (Prompt Validation) -- 3/11 types validated
|-- Phase C (Pipeline Cleanup) -- DONE
|   |-- Phase D (Dependent Services) -- DONE
|-- Phase E (Testing) -- partially done
```
