# Prompt & Pipeline Update — Context

Last Updated: 2026-03-10

## Current State: ALL 4 PHASES COMPLETE ✅

All 13 steps implemented and tested. **185 Python tests passing** (0 failures).
TypeScript types compilation clean (no errors).

### What Was Done This Session

**Phase 1 — Prompt Text Fixes:**
- Rewrote `accuracy_rules.txt` for JSON extraction focus
- Fixed `triage.txt` examples (specific labels, correct tab ordering)
- Added voice field guide to `base_extraction.txt`
- Verified `enrich_code.txt` deletion
- Fixed `finance.txt` budget duplication (costs-only modifier)

**Phase 2 — Schema Improvements:**
- `food.txt` / `FoodIngredient`: numeric `amount: float` + `displayAmount: str` with coercion
- `travel.txt` / `TravelData`: structured `TravelTip` arrays with legacy string coercion
- `music.txt` / `MusicData`: structured `MusicAnalysisItem` arrays with legacy string coercion
- All TypeScript types synced in `vie-response.ts`
- `FinanceData` budget field removed (both Pydantic + TypeScript)

**Phase 3 — Manifest Pipeline:**
- Created `manifest.txt` prompt (structural transcript scan)
- Created `manifest.py` stage with 10s timeout, non-blocking
- Created `ManifestResult`, `ItemCounts`, `ManifestFlags` Pydantic models
- Rewired `stream.py`: manifest+description concurrent → triage → extract → validate
- Updated `triage.py` to accept `manifest_text` param (falls back to transcript)
- Added `validate_extraction_counts()` with wildcard path resolution

**Phase 4 — Category Alignment:**
- Verified CATEGORY_TO_TAG covers all 8 content tags + fallback keywords

### Key Files Modified

| File | What Changed |
|------|-------------|
| `src/prompts/accuracy_rules.txt` | Complete rewrite |
| `src/prompts/triage.txt` | Examples, `{manifest}` variable |
| `src/prompts/base_extraction.txt` | Voice field guide |
| `src/prompts/manifest.txt` | **NEW** — manifest prompt |
| `src/prompts/schemas/finance.txt` | Costs-only, no budget |
| `src/prompts/schemas/food.txt` | Numeric amounts |
| `src/prompts/schemas/travel.txt` | Structured tip arrays |
| `src/prompts/schemas/music.txt` | Structured analysis |
| `src/models/domain_types.py` | FoodIngredient, TravelTip, MusicAnalysisItem, FinanceData |
| `src/models/pipeline_types.py` | ManifestResult, ItemCounts, ManifestFlags |
| `src/services/pipeline/manifest.py` | **NEW** — run_manifest, format_manifest_for_triage |
| `src/services/pipeline/triage.py` | manifest_text param, {manifest} variable |
| `src/services/pipeline/post_processor.py` | validate_extraction_counts, _count_items_at_path |
| `src/routes/stream.py` | Rewired phases: manifest concurrent, count validation |
| `packages/types/src/vie-response.ts` | FinanceData, FoodIngredient, TravelTip, MusicAnalysisItem |
| `tests/test_manifest.py` | **NEW** — 13 tests |
| `tests/test_post_processor.py` | +14 tests for count validation |
| `tests/test_domain_types.py` | Updated for schema changes |
| `tests/test_pipeline_integration.py` | Updated music fixture |

### Key Decisions Made

1. **Manifest uses regular call_llm** (not a separate fast model param) — 10s `asyncio.wait_for` timeout keeps it fast
2. **Manifest is non-blocking** — returns None on any failure, triage falls back to transcript_preview
3. **Count validation is advisory** — logs warnings at 60% threshold, never blocks pipeline
4. **Finance modifier is costs-only** — primary domain owns budget structure, finance just adds `costs[]` + `savingTips[]`
5. **Legacy coercion via field_validator(mode="before")** — accepts old string format for travel tips and music analysis
6. **FinanceBudget class still exists** in domain_types.py — used by TravelData.budget, NOT by FinanceData

### Remaining Work (Not Critical for This Task)

1. **Frontend renderers** — FoodRenderer, TravelRenderer, MusicRenderer need updates for new structured types
2. **DB cache clear** — Required on deployment (old cached data has incompatible schemas)
3. **SERVICE-SUMMARIZER.md docs** — Should document manifest stage
4. **Dead code audit** — Check if FinanceBudget/FinanceBudgetItem are used outside TravelData

### Test Results

```
185 passed, 0 failures (11.01s)
- test_domain_types.py: 45 tests
- test_manifest.py: 13 tests
- test_post_processor.py: 34 tests
- test_prompt_builder.py: 15 tests
- test_triage.py: 21 tests
- test_enrichment.py: 11 tests
- test_pipeline_integration.py: 46 tests
```

TypeScript compilation: clean (no errors)

### Pipeline Flow (Updated)

```
Phase 1: YouTube metadata fetch
Phase 2: Transcript fetch
Phase 3: Manifest + Description Analysis (concurrent)
Phase 3b: Triage (uses manifest_text if available, else transcript_preview)
Phase 4: Extraction (schema-injected)
Phase 4b: Extraction Count Validation (advisory)
Phase 5: Enrichment (learning only)
Phase 6: Synthesis
Phase 7: Post-processing (drop_empty_tabs, celebrations, accents)
Phase 8: Save to DB
```
