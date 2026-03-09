# Summarizer Pipeline V2 — Context

**Last Updated:** 2026-03-02
**Status:** COMPLETE — All 6 phases implemented and tested (90 new tests, 0 regressions)

---

## Key Files

### Core Pipeline
| File | Purpose | Relevance |
|------|---------|-----------|
| `services/summarizer/src/routes/stream.py` | SSE streaming endpoint (4-phase pipeline) | Primary modification target — emit detection_result, wire consolidation, check override |
| `services/summarizer/src/services/pipeline_helpers.py` | Pipeline context, result building, SSE helpers | Add outputType to PipelineContext, metadata event, build_result() |
| `services/summarizer/src/services/llm.py` | LLM orchestration (chapter summary, concepts) | Minimal changes — prompt building happens in prompt_builders.py |
| `services/summarizer/src/services/prompt_builders.py` | Prompt template loading + construction | Add outputType parameter, build_output_type_framing() helper |
| `services/summarizer/src/services/chapter_pipeline.py` | Cross-chapter state, post-processing | Reference for consolidation architecture |

### Detection + Category
| File | Purpose | Relevance |
|------|---------|-----------|
| `services/summarizer/src/services/youtube.py` | Category detection, CATEGORY_TO_PERSONA mapping | Source of truth for categories; new output_type.py mirrors this |
| `services/summarizer/src/services/block_postprocessing.py` | View detection from block signatures | Consolidation happens AFTER this step |
| `services/summarizer/src/prompts/detection/category_rules.json` | Category detection rules | Reference for valid categories |
| `services/summarizer/src/prompts/detection/persona_rules.json` | Persona detection rules | Reference for valid personas |

### Prompt Templates
| File | Purpose | Relevance |
|------|---------|-----------|
| `services/summarizer/src/prompts/chapter_summary.txt` | Main chapter prompt (45KB) | Add {output_type_framing} placeholder |
| `services/summarizer/src/prompts/global_synthesis.txt` | TLDR generation prompt | Add output type context |
| `services/summarizer/src/prompts/master_summary.txt` | Master summary prompt | Adapt to output type |
| `services/summarizer/src/prompts/personas/*.txt` (9) | Persona-specific guidelines | Reframe from "summarize" to "create" |

### Data Layer
| File | Purpose | Relevance |
|------|---------|-----------|
| `services/summarizer/src/models/schemas.py` | Pydantic models + enums | Add OutputType literal |
| `services/summarizer/src/repositories/mongodb_repository.py` | MongoDB CRUD | Save outputType + totalTokens |

### Entry Points
| File | Purpose | Relevance |
|------|---------|-----------|
| `services/summarizer/src/main.py` | FastAPI app, route registration | Register override router |
| `services/summarizer/src/config.py` | Settings + model mapping | Reference for configuration |

---

## Key Decisions

### 1. OutputType lives alongside Category, not replacing it

**Decision:** `outputType` is derived FROM `category` via a mapping, stored separately.

**Rationale:**
- Category = content classification ("cooking", "coding") — used for detection
- OutputType = what we produce ("recipe", "tutorial") — used for prompts + UI
- They map 1:1 today but could diverge (e.g., multiple output types per category)

### 2. Override is in-memory, not persisted

**Decision:** Override state stored in a module-level dict, not MongoDB.

**Rationale:**
- Override is ephemeral — only relevant during active processing
- Pipeline runs in single process (no distributed state needed)
- Cleaned up after pipeline completes
- If process restarts, pipeline restarts from scratch anyway

### 3. Consolidation is output-type-specific, not universal

**Decision:** Only certain output types trigger consolidation (recipe, tutorial, workout, travel).

**Rationale:**
- Not all content benefits from consolidation (podcast notes, reviews are chapter-bound)
- Over-consolidation loses chapter context
- Each output type has specific merge semantics (ingredients ≠ exercises)

### 4. Prompt changes are additive, not destructive

**Decision:** Add `{output_type_framing}` as a new placeholder; don't rewrite entire prompts.

**Rationale:**
- Existing prompts produce good output — minimize regression risk
- Output type framing is a context addition, not a replacement
- Can easily disable/change framing without touching core prompt logic

### 5. Completeness rules go in persona files, not chapter_summary.txt

**Decision:** "MUST include ALL ingredients" goes in `recipe.txt`, not the base prompt.

**Rationale:**
- Keeps base prompt generic (works for all personas)
- Persona files are the right place for domain-specific rules
- Easier to tune per-persona without affecting others

---

## Dependencies

### Upstream
| Dependency | From | Status | Blocking? |
|------------|------|--------|-----------|
| `OutputType` type in `packages/types` | Plan 0 | Pending | Yes — need shared type |
| `CATEGORY_TO_OUTPUT_TYPE` mapping agreement | Plan 0 | Defined in plan-0-contracts.md | Yes |
| SSE `detection_result` event format | Plan 0 | Defined in plan-0-contracts.md | Yes |
| DB schema: `outputType` field | Plan 0 | Pending backfill script | No — can add field without migration |

### Downstream
| Consumer | What they need | Plan |
|----------|---------------|------|
| vie-web (frontend) | `outputType` in SSE metadata + detection_result event | Plan 1 |
| vie-api | Override route proxy, outputType in responses | Plan 2 |
| vie-admin | outputType display in admin panel | Plan 4 |

---

## Current Category → Persona Mapping (youtube.py:317)

```python
CATEGORY_TO_PERSONA = {
    'cooking': 'recipe',
    'coding': 'code',
    'podcast': 'interview',
    'reviews': 'review',
    'fitness': 'fitness',
    'travel': 'travel',
    'education': 'education',
    'gaming': 'standard',   # No gaming-specific persona yet
    'diy': 'standard',      # No DIY-specific persona yet
    'music': 'music',
}
```

## New Category → OutputType Mapping (to be created)

```python
CATEGORY_TO_OUTPUT_TYPE = {
    'cooking': 'recipe',
    'coding': 'tutorial',
    'fitness': 'workout',
    'education': 'study_guide',
    'travel': 'travel_plan',
    'reviews': 'review',
    'podcast': 'podcast_notes',
    'diy': 'diy_guide',
    'gaming': 'game_guide',
    'music': 'music_guide',
}
# Default: 'summary'
```

---

## SSE Event Types (current)

| Event | Phase | Data |
|-------|-------|------|
| `phase` | All | `{phase: "metadata\|parallel_analysis\|chapter_summaries\|master_summary"}` |
| `metadata` | 1 | `{title, channel, duration, thumbnailUrl, context}` |
| `chapters` | 1 | `{chapters: [...], isCreatorChapters: bool}` |
| `description_analysis` | 2 | `{links, resources, timestamps, social}` |
| `synthesis_complete` | 2 | `{tldr, keyTakeaways}` |
| `chapter_ready` | 3 | `{index, chapter}` |
| `concepts_complete` | 3 | `{concepts: [...]}` |
| `master_summary_complete` | 4 | `{masterSummary}` |
| `done` | 4 | `{videoSummaryId, processingTimeMs}` |
| `error` | Any | `{message, code}` |

### New Events (this plan)

| Event | Phase | Data |
|-------|-------|------|
| `detection_result` | 1 (after metadata) | `{category, outputType, confidence}` |

### Modified Events (this plan)

| Event | Change |
|-------|--------|
| `metadata` | Add `outputType` field |

---

## Testing Strategy

| Test Type | Target | Framework |
|-----------|--------|-----------|
| Unit | output_type.py mappings | pytest |
| Unit | consolidation strategies | pytest |
| Unit | override state management | pytest |
| Unit | prompt builder framing | pytest |
| Integration | Full pipeline with outputType | pytest + TestClient |
| Integration | Override during active pipeline | pytest + TestClient |

---

## Glossary

| Term | Meaning |
|------|---------|
| **Category** | Content classification detected from video metadata ("cooking", "coding"). User-facing. |
| **Persona** | Internal LLM configuration for prompt selection ("recipe", "code"). Not user-facing. |
| **OutputType** | What the system produces ("recipe", "tutorial"). User-facing, derived from category. |
| **Consolidation** | Merging scattered blocks across chapters into coherent output (e.g., all ingredients → one list). |
| **Override** | User-initiated category change during processing. |
| **View** | Per-chapter display hint detected from block signatures (existing feature in block_postprocessing.py). |
