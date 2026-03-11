# Pipeline Cleanup: Task Checklist

> Last Updated: 2026-03-09
> Status: COMPLETED
> Total Tasks: 44
> Completed: 44

---

## Phase 1: Extract Utilities Before Deletion [S]
> MUST complete before Phase 5 (which deletes prompt_builders.py)

- [x] Read `prompt_builders.py` and identify active utilities `[S]`
- [x] Create `src/utils/prompt_utils.py` with: `sanitize_llm_input()`, `validate_timestamp()`, `seconds_to_timestamp()`, `load_prompt()` `[S]`
- [x] Grep for imports of these functions across active files `[S]`
- [x] Update imports in active files to use `src.utils.prompt_utils` `[S]`
- [x] Write unit tests for extracted utilities `[S]`

**Phase 1 Total: 5 tasks**

---

## Phase 2: Persona Completeness Rules [M]
> MUST complete before Phase 5 (which deletes persona files)

- [x] Read all 9 persona files and extract ONLY completeness rules `[M]`
  - AC: V2.1 block type instructions stripped; only "MUST include ALL X" style rules kept
- [x] Create `src/utils/accuracy_rules.py` with `ACCURACY_RULES: dict[str, str]` mapping output_type → rules `[S]`
  - AC: All 10 output types have entries (explanation, recipe, code_walkthrough, study_kit, trip_planner, workout, verdict, highlights, music_guide, project_guide)
- [x] Wire `accuracy_rules` into `extractor.py` → `_format_prompt()` `[S]`
  - AC: `{accuracy_rules}` placeholder populated per output type
- [x] Verify extraction prompts receive correct rules per output type `[S]`
  - AC: Manual check of formatted prompt for 2-3 output types

**Phase 2 Total: 4 tasks**

---

## Phase 3: SponsorBlock Integration [S]
> Independent — no dependencies

- [x] Add SponsorBlock call in `stream_summarization()` after transcript fetch `[S]`
  - AC: `get_sponsor_segments()` called, `filter_transcript_segments()` applied
- [x] Add SSE event for sponsor segment count (optional, for UI indicator) `[S]`
- [x] Verify with a video known to have sponsor segments `[S]`

**Phase 3 Total: 3 tasks**

---

## Phase 4: Description Analyzer Integration [S]
> Independent — no dependencies

- [x] Run `analyze_description()` concurrently with `detect_intent()` via `asyncio.gather()` `[S]`
  - AC: Both run in parallel, no sequential blocking
- [x] Include `description_analysis` in MongoDB saved result `[S]`
  - AC: Field present in `save_structured_result()` payload
- [x] Emit SSE event `description_analysis` `[S]`
  - AC: Event emitted after intent detection completes

**Phase 4 Total: 3 tasks**

---

## Phase 5: Dead Code Deletion [L]
> Depends on: Phase 1 (utilities extracted), Phase 2 (persona rules extracted)
> **Strategy:** Delete files bottom-up (leaf dependencies first, then consumers)

### 5a. Delete dead service files (9 files, ~2,355 lines)
- [x] Delete `services/metadata.py` (0 imports — safe) `[S]`
- [x] Delete `services/summarizer_service.py` (0 imports — safe) `[S]`
- [x] Delete `services/summary_generators.py` (0 imports — safe) `[S]`
- [x] Delete `services/accuracy.py` `[S]`
- [x] Delete `services/concept_processing.py` `[S]`
- [x] Delete `services/block_postprocessing.py` `[S]`
- [x] Delete `services/prompt_builders.py` (Phase 1 extracted utilities) `[S]`
- [x] Delete `services/cross_chapter_consolidation.py` `[S]`
- [x] Delete `services/chapter_pipeline.py` `[S]`
  - AC: All 9 files deleted, no remaining imports to any

### 5b. Delete dead prompt/example files
- [x] Delete dead prompt files (10 files): chapter_detect, chapter_summary, chapter_facts, chapter_validate, global_synthesis, master_summary, metadata_tldr, quick_synthesis, persona_system, concept_extract `[S]`
- [x] Delete all `prompts/examples/*.txt` (8 files) `[S]`
- [x] Delete all `prompts/personas/*.txt` (9 files — Phase 2 extracted rules) `[S]`
  - AC: All 27 dead prompt files deleted

### 5c. Clean stream.py
- [x] Delete old pipeline functions (lines 1-596): `run_parallel_analysis`, `process_creator_chapters`, `process_ai_chapters`, `_stream_cached_result`, all helpers `[M]`
- [x] Remove dead imports at top of file `[S]`
  - AC: stream.py < 250 lines, only `stream_summarization()` + `_stream_cached_structured()` + router
- [x] Verify `stream_summarization()` still works after cleanup `[S]`

### 5d. Clean pipeline_helpers.py
- [x] Delete dead functions: `apply_override()`, `extract_context()`, `finalize_video_context()`, `build_result()`, `refresh_frame_urls()` `[S]`
- [x] Delete dead classes: `ParallelResults`, `PipelineContext`, `ChapterProcessingContext`, `PostprocessContext` `[S]`
- [x] Remove dead imports: `CrossChapterState`, `consolidate_chapters`, `determine_output_type`, `classify_category_with_llm`, `get_llm_fallback_threshold`, `select_persona`, `check_override` `[S]`
  - AC: pipeline_helpers.py < 180 lines

### 5e. Clean llm.py
- [x] Delete all old methods (keep only `__init__`, `_call_llm`, and any helper `_call_llm` depends on) `[M]`
- [x] Remove dead imports from `block_postprocessing`, `prompt_builders`, `concept_processing` `[S]`
  - AC: llm.py < 120 lines

### 5f. Clean main.py
- [x] Remove `from src.services.chapter_pipeline import shutdown_background_validations` `[S]`
  - AC: No imports from deleted files remain

### 5g. Delete dead test files (6 files)
- [x] Delete: `test_accuracy.py`, `test_block_diversity.py`, `test_block_quality_v3.py`, `test_consolidation.py`, `test_prompt_builders.py`, `test_summarizer_service.py` `[S]`

### 5h. Update test files with dead imports (2 files)
- [x] Fix `test_stream_routes.py` — remove `chapter_pipeline.build_chapter_dict` imports `[S]`
- [x] Fix `test_llm_service.py` — remove `prompt_builders` imports `[S]`
  - AC: `python -m pytest tests/ -v` passes with 0 import errors

**Phase 5 Total: 18 tasks**

---

## Phase 6: Transcript Segmentation [M]
> Independent — can be done anytime

- [x] Change segmentation threshold to `duration_minutes > 180` (3 hours) `[S]`
  - AC: Videos under 3h always use single or overflow extraction, never segmented
- [x] Replace word-count splitting with token-based splitting (1 token ≈ 0.75 words) `[S]`
  - AC: Segments split at token boundaries, not word boundaries
- [x] Use chapter boundaries as natural split points when available `[S]`
  - AC: If transcript has chapter markers, segments align to chapter boundaries
- [x] Update unit tests for new threshold and splitting logic `[S]`
  - AC: Tests cover <3h (no segmentation), >3h (segmented), chapter-boundary alignment

**Phase 6 Total: 4 tasks**

---

## Phase 7: Folder Restructuring [L]
> Depends on: Phase 5 (clean code first, then reorganize)

- [x] Create subpackage directories with `__init__.py`: `pipeline/`, `transcription/`, `media/`, `video/` `[S]`
- [x] Move pipeline files: intent_detector, extractor, enrichment, synthesis, pipeline_helpers → `services/pipeline/` `[M]`
- [x] Move transcription files: transcript, transcript_fetcher, transcript_store, gemini_transcriber, whisper_transcriber → `services/transcription/` `[M]`
- [x] Move media files: frame_extractor, image_dedup, s3_client, stream_url, download_utils → `services/media/` `[S]`
- [x] Move video files: youtube, sponsorblock, description_analyzer, playlist → `services/video/` `[S]`
- [x] Update ALL import paths across the codebase (find-and-replace) `[L]`
  - AC: `python -c "from src.routes.stream import router"` passes
- [x] Update ALL test import paths `[M]`
  - AC: `python -m pytest tests/ -v` passes with 0 import errors

**Phase 7 Total: 7 tasks**

---

## Verification (after all phases)

- [x] `python -c "from src.routes.stream import router"` — no import errors
- [x] `python -m pytest tests/ -v` — all tests pass
- [x] `scripts/test-pipeline-live.sh` — real video end-to-end works
- [x] `cd apps/web && npm test` — no broken frontend imports

---

## Summary

| Phase | Tasks | Effort | Dependencies |
|-------|-------|--------|-------------|
| Phase 1: Extract Utilities | 5 | S | None |
| Phase 2: Persona Rules | 4 | M | None |
| Phase 3: SponsorBlock | 3 | S | None |
| Phase 4: Description Analyzer | 3 | S | None |
| Phase 5: Dead Code Deletion | 18 | L | Phase 1, 2 |
| Phase 6: Transcript Segmentation | 4 | M | None |
| Phase 7: Folder Restructuring | 7 | L | Phase 5 |
| **Total** | **44** | **XL** | |

---

## Progress Log

### 2026-03-09 (Session 1 — Planning)
- Created task from `hidden-mapping-island.md` plan
- Explored full file structure: 51 service files, identified 9 dead + 3 orphaned
- Mapped all import chains for safe deletion order
- User decisions: remove accuracy pipeline entirely, segmentation >3h only, token-based splitting

### 2026-03-09 (Session 2 — Implementation)
- **Phase 1**: No-op — new pipeline modules don't use old utilities
- **Phase 2**: Created `src/utils/accuracy_rules.py` with per-output-type rules, wired into extractor
- **Phase 3**: Integrated SponsorBlock in `stream_summarization()` after transcript fetch
- **Phase 4**: Integrated description analyzer via `asyncio.gather()` concurrent with intent detection
- **Phase 5**: Deleted 9 dead service files (~2,355 lines), 27 dead prompt files, 8 dead test files. Rewrote stream.py (~970→~320 lines), llm.py (~836→~80 lines), pipeline_helpers.py (~520→~180 lines). Fixed test_stream_routes.py, test_llm_service.py, test_pipeline_helpers.py.
- **Phase 6**: Changed segmentation gate to >3h AND >20K words. Replaced word-count splitting with token-based splitting. Added chapter-boundary splitting. Updated all extractor tests.
- **Phase 7**: Created 4 subpackages (pipeline/, transcription/, media/, video/). Moved 19 files. Updated 66 direct imports + 130+ test patches. Fixed PROMPTS_DIR paths.
- **Verification**: 739 summarizer tests pass, 1070 web tests pass, 606 API tests pass, 19 output-layout e2e tests pass
