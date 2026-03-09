# Pipeline Cleanup: Context & Key Files

> Last Updated: 2026-03-09

---

## Key Files — Active Pipeline (KEEP)

| File | Purpose | Lines |
|------|---------|-------|
| `src/routes/stream.py` | SSE streaming endpoint — `stream_summarization()` at line 604 | ~970 (170 active) |
| `src/services/intent_detector.py` | Classifies output type from metadata + transcript preview | 173 |
| `src/services/extractor.py` | Adaptive extraction (single/overflow/segmented) | 231 |
| `src/services/enrichment.py` | Enrichment for study_kit + code_walkthrough | 63 |
| `src/services/synthesis.py` | TLDR, takeaways, masterSummary generation | 40 |
| `src/services/llm.py` | LLMService — only `_call_llm()` is used | ~836 (100 active) |
| `src/services/llm_provider.py` | LiteLLM multi-provider wrapper | 388 |
| `src/services/pipeline_helpers.py` | SSE events, timer, data classes | ~520 (270 active) |
| `src/services/sponsorblock.py` | SponsorBlock API — filter sponsor segments | 188 |
| `src/services/description_analyzer.py` | Extract resources/links from description | 188 |
| `src/services/youtube.py` | Video metadata, persona detection | 975 |
| `src/services/transcript.py` | Transcript cleaning and formatting | 290 |
| `src/services/transcript_fetcher.py` | Fallback chain: S3→yt-dlp→API→Gemini→Whisper | 262 |
| `src/services/transcript_store.py` | S3 transcript persistence | 159 |
| `src/services/gemini_transcriber.py` | Google Gemini transcription | 516 |
| `src/services/whisper_transcriber.py` | Local Whisper transcription | 371 |
| `src/services/frame_extractor.py` | Frame extraction + S3 upload | 663 |
| `src/services/image_dedup.py` | Perceptual hashing for frame dedup | 70 |
| `src/services/s3_client.py` | S3 operations with retry | 344 |
| `src/services/stream_url.py` | Stream URL resolution | 144 |
| `src/services/download_utils.py` | Download helpers | 96 |
| `src/services/playlist.py` | Playlist extraction via yt-dlp | 194 |
| `src/services/usage_tracker.py` | LLM usage tracking | 217 |
| `src/services/override_state.py` | In-memory override state (used in finally block) | 89 |
| `src/services/output_type.py` | Category→output type mapping (override.py depends) | 82 |
| `src/services/status_callback.py` | Status callback | 47 |
| `src/models/output_types.py` | 10 Pydantic output schemas | 658 |
| `src/models/schemas.py` | Request/response models | 145 |
| `src/utils/json_parsing.py` | Robust JSON recovery | 403 |
| `src/utils/content_extractor.py` | Summary/bullet extraction | 322 |
| `src/utils/transcript_slicer.py` | Time-range transcript slicing | 78 |
| `src/utils/constants.py` | Constants | 16 |

---

## Key Files — Dead Code (DELETE)

### Service Files (9 files, ~2,355 lines)

| File | Lines | Why Dead | Imports From |
|------|-------|----------|-------------|
| `services/accuracy.py` | 227 | Old accuracy pipeline — removed per user decision | stream.py:34, chapter_pipeline.py:24 |
| `services/chapter_pipeline.py` | 334 | Old chapter orchestration | main.py:21, stream.py:35, pipeline_helpers.py:24 |
| `services/concept_processing.py` | 486 | Old concept dedup | llm.py:62, prompt_builders.py:24 |
| `services/cross_chapter_consolidation.py` | 229 | Old chapter merging | pipeline_helpers.py:42 |
| `services/block_postprocessing.py` | 347 | Old block system | llm.py:17 |
| `services/prompt_builders.py` | 435 | Old prompt building (extract utils first!) | llm.py:31, concept_processing.py:218/390 |
| `services/summary_generators.py` | 93 | Orphaned, 0 active imports | none |
| `services/summarizer_service.py` | 175 | Orphaned old SummarizeService class | none |
| `services/metadata.py` | 29 | Orphaned, 0 imports | none |

### Dead Prompt/Example Files (~27 files)

**Prompts:**
- `chapter_detect.txt`, `chapter_summary.txt`, `chapter_facts.txt`, `chapter_validate.txt`
- `global_synthesis.txt`, `master_summary.txt`, `metadata_tldr.txt`, `quick_synthesis.txt`
- `persona_system.txt`, `concept_extract.txt`

**Examples:** All 8 files in `prompts/examples/`

**Personas:** All 9 files in `prompts/personas/` (AFTER extracting completeness rules)

### Dead Test Files (6 files)

| Test File | Source Deleted |
|-----------|---------------|
| `tests/test_accuracy.py` | accuracy.py |
| `tests/test_block_diversity.py` | block_postprocessing.py |
| `tests/test_block_quality_v3.py` | chapter_pipeline.py + block_postprocessing.py |
| `tests/test_consolidation.py` | cross_chapter_consolidation.py |
| `tests/test_prompt_builders.py` | prompt_builders.py |
| `tests/test_summarizer_service.py` | summarizer_service.py |

### Test Files Needing Updates (2 files)

| Test File | Fix |
|-----------|-----|
| `tests/test_stream_routes.py` | Remove `chapter_pipeline.build_chapter_dict` imports (lines 583, 605) |
| `tests/test_llm_service.py` | Remove `prompt_builders.ChapterSummaryRequest/ChapterContext` import (line 109) |

---

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| No accuracy pipeline | Context window is large enough — send full transcript. No need for fact extraction/validation. |
| Transcript segmentation >3h only | Context window handles most videos. Only ultra-long (3h+) need splitting. |
| Token-based splitting | More accurate than word count for LLM context limits |
| Keep output_type.py | override.py route depends on it. Output type mismatch (old vs new names) is a separate fix. |
| Keep override_state.py | `clear_override()` and `clear_generation_started()` called in stream.py finally block |
| Extract utilities before deletion | `sanitize_llm_input`, `validate_timestamp`, `seconds_to_timestamp`, `load_prompt` are valuable |
| Extract persona rules before deletion | Completeness rules (e.g., "ALL ingredients with EXACT measurements") improve extraction quality |
| Folder restructuring last | Clean code first, then reorganize. Minimizes merge conflicts. |

---

## Import Chain Analysis

### Files importing dead code (must update):

```
main.py:21          → chapter_pipeline.shutdown_background_validations  [REMOVE]
stream.py:34        → accuracy.extract_chapter_facts                    [REMOVE]
stream.py:35        → chapter_pipeline.*                                [REMOVE]
llm.py:17           → block_postprocessing.*                            [REMOVE]
llm.py:31           → prompt_builders.*                                 [REMOVE]
llm.py:62           → concept_processing.*                              [REMOVE]
pipeline_helpers.py:24 → chapter_pipeline.CrossChapterState             [REMOVE]
pipeline_helpers.py:41 → output_type.determine_output_type              [REMOVE - dead function using it]
pipeline_helpers.py:42 → cross_chapter_consolidation.consolidate_chapters [REMOVE]
```

### Circular dependency (both dead):
```
concept_processing.py:218 → prompt_builders.validate_timestamp
prompt_builders.py:24     → concept_processing.*
```
Both files are deleted — no impact.

---

## Active Pipeline SSE Events

| Event | When | Payload |
|-------|------|---------|
| `metadata` | After video data fetch | title, channel, thumbnail, duration |
| `intent_detected` | After intent detection | output_type, sections, confidence |
| `extraction_progress` | During extraction | segment progress |
| `extraction_complete` | After extraction | full typed output data |
| `enrichment_complete` | After enrichment | quiz, flashcards, cheat sheet |
| `synthesis_complete` | After synthesis | TLDR, takeaways, masterSummary |
| `description_analysis` | NEW — after desc analysis | links, resources, social_links |
| `done` | Pipeline complete | final result |

---

## Extraction Prompt Placeholders

All `extract_*.txt` prompts use:
- `{title}` — video title
- `{duration_minutes}` — video duration
- `{sections}` — expected output sections
- `{transcript}` — full or segmented transcript
- `{accuracy_rules}` — domain-specific completeness rules (Phase 2 populates this)
