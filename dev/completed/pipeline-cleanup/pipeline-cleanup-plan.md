# Pipeline Cleanup: Integration & Dead Code Removal

> Last Updated: 2026-03-09
> Branch: `dev-1`
> Predecessor: `pipeline-v2` (92.5% complete — built the new 4-stage pipeline)

---

## Executive Summary

The new 4-stage summarization pipeline is built and validated (pipeline-v2 task). This task completes the migration by:
1. **Integrating** valuable old features (SponsorBlock, description analyzer, persona completeness rules)
2. **Deleting** ~2,355 lines of dead service code + ~27 dead prompt/example files
3. **Cleaning up** stream.py (~600 dead lines), llm.py, pipeline_helpers.py, main.py
4. **Improving** transcript segmentation (token-based, >3h videos only)
5. **Restructuring** the `services/` folder from flat (25+ files) to grouped subpackages

**Impact:** Removes all legacy chapter-based pipeline remnants. After this, the codebase has ONE clean pipeline path.

---

## Current State

### Active Pipeline Flow
```
stream_summarization() [stream.py:604]
  → Intent Detection (intent_detector.py)
  → Extraction (extractor.py) — adaptive: single / overflow / segmented
  → Enrichment (enrichment.py) — study_kit + code_walkthrough only
  → Synthesis (synthesis.py) — TLDR + takeaways + masterSummary
```

### Problems
1. **stream.py** is ~970 lines but only ~170 are active (lines 604-742, 750-805, 850-882). Lines 1-596 are dead old pipeline code.
2. **9 service files** are completely dead (2,355 lines total)
3. **27+ prompt/example files** are dead
4. **llm.py** (836 lines) is mostly dead — only `_call_llm()` is used
5. **pipeline_helpers.py** (520 lines) has ~250 lines of dead code
6. **SponsorBlock** is imported but never called in new pipeline
7. **Description analyzer** exists but isn't wired in
8. **Persona completeness rules** (valuable domain accuracy rules) are trapped in dead persona files
9. **Transcript segmentation** splits by word count — should split by tokens, only for >3h videos
10. **Flat services/ folder** has 25+ files — hard to navigate

---

## Proposed Future State

### After Cleanup
- stream.py: ~200 lines (from ~970)
- llm.py: ~100 lines (from ~836)
- pipeline_helpers.py: ~150 lines (from ~520)
- Dead service files: 0 (from 9)
- Dead prompts: 0 (from 27+)

### After Integration
- SponsorBlock filters sponsor segments before extraction
- Description analyzer runs parallel with intent detection
- Persona completeness rules injected via `{accuracy_rules}` placeholder per output type

### After Restructuring
```
services/summarizer/src/services/
├── pipeline/          (intent_detector, extractor, enrichment, synthesis, pipeline_helpers)
├── transcription/     (transcript, transcript_fetcher, transcript_store, gemini/whisper)
├── media/             (frame_extractor, image_dedup, s3_client, stream_url, download_utils)
├── video/             (youtube, sponsorblock, description_analyzer, playlist)
├── llm.py             (LLMService — cleaned)
├── llm_provider.py    (LiteLLM wrapper)
├── usage_tracker.py
├── override_state.py
├── output_type.py     (keep for override.py compat)
└── status_callback.py
```

---

## Implementation Phases

### Phase 1: Extract Utilities Before Deletion [S]
**Why first:** Phase 5 deletes `prompt_builders.py` — must save valuable utilities.

- Create `src/utils/prompt_utils.py` with: `sanitize_llm_input()`, `validate_timestamp()`, `seconds_to_timestamp()`, `load_prompt()`
- Update imports in any active file that uses these

### Phase 2: Persona Completeness Rules → Extraction Prompts [M]
**Why before deletion:** Phase 5 deletes persona files — must extract valuable rules first.

- Read all 9 persona files, extract ONLY completeness rules (strip V2.1 block type instructions)
- Create `src/utils/accuracy_rules.py` — dict mapping `output_type → rules_string`
- Wire into `extractor.py` → `_format_prompt()` via `{accuracy_rules}` placeholder

### Phase 3: SponsorBlock Integration [S]
- Add ~5 lines in `stream_summarization()` after transcript fetch, before intent detection
- `sponsorblock.py` already exists and is imported — just call it

### Phase 4: Description Analyzer Integration [S]
- Run `analyze_description()` concurrently with `detect_intent()` via `asyncio.gather()`
- Include result in MongoDB save + emit SSE event
- No frontend changes needed (ignored unknown events)

### Phase 5: Dead Code Deletion [L]
The largest phase. 8 sub-steps:

**5a.** Delete 9 dead service files (~2,355 lines)
**5b.** Delete ~27 dead prompt/example files
**5c.** Clean stream.py (delete lines 1-596 + dead imports)
**5d.** Clean pipeline_helpers.py (delete dead functions + imports)
**5e.** Clean llm.py (keep only `_call_llm()`, delete old methods)
**5f.** Clean main.py (remove `chapter_pipeline` import)
**5g.** Keep output_type.py (override.py depends on it — mismatch is known, separate fix)
**5h.** Delete 6 dead test files, update 2 test files with dead imports

### Phase 6: Transcript Segmentation [M]
- Change threshold: only trigger for videos >3 hours (`duration_minutes > 180`)
- Split by token count (not word count) — approximate 1 token ≈ 0.75 words
- Use chapter boundaries as natural split points when available
- Keep `utils/transcript_slicer.py` for time-range slicing

### Phase 7: Folder Restructuring [L]
- Create subpackages: `pipeline/`, `transcription/`, `media/`, `video/`
- Move files into grouped directories
- Add `__init__.py` with re-exports for backward compat
- Update ALL import paths (mechanical find-and-replace)
- Update ALL test imports

---

## Execution Order & Dependencies

```
Phase 1 (extract utilities)     ← MUST precede Phase 5
Phase 2 (persona rules)         ← MUST precede Phase 5
Phase 3 (SponsorBlock)          ← independent
Phase 4 (description analyzer)  ← independent
Phase 5 (dead code deletion)    ← depends on 1, 2
Phase 6 (segmentation)          ← independent
Phase 7 (folder restructure)    ← depends on 5 (clean first, then reorganize)
```

**Recommended sequence:** 1 → 2 → 3 → 4 → 5 → 6 → 7

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Deleting code that's actually used | HIGH | Grep ALL imports before each deletion |
| Breaking test suite | MEDIUM | Run tests after each phase |
| Import path changes (Phase 7) | MEDIUM | Mechanical find-and-replace, test verification |
| output_type.py mismatch | LOW | Keep as-is, fix in separate PR |
| SponsorBlock API unavailable | LOW | Already handles gracefully (returns empty list) |

---

## Success Metrics

1. **Zero dead service files** — all 9 deleted
2. **Zero dead prompts** — all 27+ deleted
3. **stream.py < 250 lines** — from ~970
4. **All tests pass** — both Python and frontend
5. **Import check clean** — `python -c "from src.routes.stream import router"` works
6. **SponsorBlock active** — sponsor segments filtered from transcript
7. **Description analysis** — runs parallel with intent detection

---

## Verification Plan

1. `cd services/summarizer && python -c "from src.routes.stream import router"` — no import errors
2. `cd services/summarizer && python -m pytest tests/ -v` — all tests pass
3. `scripts/test-pipeline-live.sh` — real video end-to-end
4. `cd apps/web && npm test` — no broken frontend imports
5. Verify `packages/types/src/output-types.ts` matches Python models
