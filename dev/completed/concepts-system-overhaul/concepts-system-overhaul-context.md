# Concepts System Overhaul — Context

**Last Updated:** 2026-02-15

---

## Key Files

### Backend (Python Summarizer)

| File | Purpose | Key Lines |
|------|---------|-----------|
| `services/summarizer/src/routes/stream.py` | Streaming SSE endpoint | L33: `build_concept_dicts` import; L394: parallel path usage; L651-659: inline concept extraction (THE BUG) |
| `services/summarizer/src/services/llm.py` | LLM orchestration | L143-161: `build_concept_dicts()`; L164-182: `_build_concepts_anchor()` |
| `services/summarizer/src/models/schemas.py` | Pydantic schemas | L89-94: `Concept` model (id, name, definition, timestamp) |
| `services/summarizer/src/prompts/concept_extract.txt` | Concept extraction prompt | Sent to LLM for extracting concepts from transcript |

### Frontend (TypeScript Web)

| File | Purpose | Key Lines |
|------|---------|-----------|
| `apps/web/src/lib/timestamp-utils.ts` | Timestamp + concept utils | L27-38: `getConceptSearchNeedles()` — sidebar matching variants |
| `apps/web/src/components/video-detail/ConceptHighlighter.tsx` | Inline concept tooltips | L40-76: Independent variant generation (diverges from sidebar) |
| `apps/web/src/components/video-detail/ArticleSection.tsx` | Video article layout | L169-236: Per-chapter concept sidebar |
| `apps/web/src/components/video-detail/ConceptsContext.tsx` | React context for concepts | Provides concept state to component tree |
| `apps/web/src/components/video-detail/blocks/ItineraryBlock.tsx` | Itinerary block renderer | Missing ConceptHighlighter wrapping |
| `apps/web/src/components/video-detail/blocks/QuizBlock.tsx` | Quiz block renderer | Missing ConceptHighlighter wrapping |
| `apps/web/src/lib/concept-utils.ts` | **NEW** shared variant util | To be created: `getNameVariants()` |

### Shared Types

| File | Purpose | Key Lines |
|------|---------|-----------|
| `packages/types/src/index.ts` | Shared TypeScript types | L494-499: `Concept` interface |

### Tests

| File | Purpose |
|------|---------|
| `apps/web/src/lib/__tests__/timestamp-utils.test.ts` | Existing timestamp/concept tests |
| `apps/web/src/lib/__tests__/concept-utils.test.ts` | **NEW** shared variant tests |
| `services/summarizer/tests/` | Backend concept tests |

---

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Single `getNameVariants()` vs keep separate | Single function | Eliminates divergence, easier to maintain |
| Where to put shared function | `concept-utils.ts` | Dedicated file, doesn't bloat timestamp-utils |
| Dedup strategy | Case-insensitive, first wins | Preserves primary definition |
| Invalid timestamp handling | Graceful `None` | Falls back to content matching instead of breaking |
| Orphaned concepts display | "Additional Concepts" section | Only shows when orphans exist, collapsible |
| `aliases` field | Optional, backward-compatible | Future-proof without breaking existing data |
| Variant generation approach | Computed client-side | No backend change needed for existing data |

---

## Dependencies

### Internal

| Dependency | Impact |
|------------|--------|
| `@vie/types` Concept interface | Phase 3.4 adds `aliases` field |
| ConceptsContext provider | Phase 2.6 needs access to allConcepts |
| Existing timestamp-utils tests | Must continue passing after Phase 2.2 |

### External

| Dependency | Version | Used For |
|------------|---------|----------|
| Pydantic | v2.x | Schema validation (summarizer) |
| Vitest | Latest | Frontend testing |
| pytest | Latest | Backend testing |

---

## Architecture Notes

### Current Concept Flow

```
LLM → extract_concepts() → build_concept_dicts() → MongoDB
                                      ↑
                     streaming path BYPASSES this (Bug 1.1)
```

### Current Matching Flow (Frontend)

```
Sidebar:  timestamp-utils.ts → getConceptSearchNeedles() → chapter content scan
Inline:   ConceptHighlighter.tsx → useMemo variant map → regex matching
          ↑ DIFFERENT LOGIC (Bug 2.1)
```

### Target Architecture

```
LLM → extract_concepts() → build_concept_dicts() → MongoDB
                                    ↑
                     ALL paths use this (Fix 1.1)
                     + normalize + dedup + validate (Fix 1.2, 1.3)

Sidebar:  concept-utils.ts → getNameVariants() → chapter content scan
Inline:   concept-utils.ts → getNameVariants() → regex matching
          ↑ SAME LOGIC (Fix 2.1)
```

---

## Variant Generation Specification

### `getNameVariants(name: string): string[]`

Input: `"Duration, Path, and Outcome (DPO)"`

Output:
```
[
  "duration, path, and outcome (dpo)",    // full name lowercased
  "duration, path, and outcome",          // base name without parens (≥3 chars)
  "dpo",                                  // abbreviation from parens (≤6 chars)
]
```

Input: `"EMDR (Eye Movement Desensitization Reprocessing)"`

Output:
```
[
  "emdr (eye movement desensitization reprocessing)",  // full name
  "emdr",                                               // base is short abbreviation
  "eye movement desensitization reprocessing",          // content from parens (reversed pattern)
]
```

Input: `"Client/Server Architecture"`

Output:
```
[
  "client/server architecture",  // full name
  "client",                      // slash part (≥3 chars)
  "server",                      // slash part (≥3 chars)
  "client/server architectures", // plural
]
```

Input: `"Neuroplasticity"`

Output:
```
[
  "neuroplasticity",     // full name
  "neuroplasticities",   // plural (maybe skip for -y endings; keep simple)
]
```
