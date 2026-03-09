# Summarizer Block Architecture - Tasks

**Last Updated:** 2026-02-04
**Status:** COMPLETED

---

## Phase 1: Prompt Files [Effort: S] - COMPLETED

- [x] **1.1** Renamed `prompts/section_detect.txt` → `prompts/chapter_detect.txt`
- [x] **1.2** Updated `chapter_detect.txt` content: "sections" → "chapters" in JSON schema
- [x] **1.3** Renamed `prompts/section_summary.txt` → `prompts/chapter_summary.txt`
- [x] **1.4** Updated `chapter_summary.txt` content: "section" → "chapter" references
- [x] **1.5** Updated `prompts/master_summary.txt`: `{sections_detailed}` → `{chapters_detailed}`

---

## Phase 2: TypeScript Types [Effort: M] - COMPLETED

- [x] **2.1** Added `BaseBlock` interface with `blockId: string`
- [x] **2.2-2.13** Updated all block types to extend `BaseBlock`
- [x] **2.14** Created `SummaryChapter` interface with `Section` as backwards compat alias
- [x] **2.15** Section kept as alias for SummaryChapter (backwards compat)
- [x] **2.16** Updated `VideoSummary`: `sections` → `chapters`
- [x] **2.17** Updated `VideoContext`: `persona` → `category` (user-facing)
- [x] **2.18** Updated SSE event types: added `chapter_detect`, `chapter_summaries` phases
- [x] **2.19** TypeScript build passes

---

## Phase 3: Python Summarizer [Effort: L] - COMPLETED

### 3.1 Schemas (models/schemas.py)
- [x] **3.1.1** Renamed `Section` class → `Chapter`
- [x] **3.1.2** Updated `VideoSummary.sections` → `VideoSummary.chapters`
- [x] **3.1.3** Added `content: list[dict]` field for content blocks

### 3.2 LLM Service (services/llm.py)
- [x] **3.2.1** Added `inject_block_ids(blocks: list[dict]) -> list[dict]` function
- [x] **3.2.2** Renamed `detect_sections()` → `detect_chapters()` (with backwards compat alias)
- [x] **3.2.3** Renamed `summarize_section()` → `summarize_chapter()` (with backwards compat alias)
- [x] **3.2.4** Renamed `stream_detect_sections()` → `stream_detect_chapters()` (with backwards compat alias)
- [x] **3.2.5** Renamed `stream_summarize_section()` → `stream_summarize_chapter()` (with backwards compat alias)
- [x] **3.2.6** Updated prompt loading: `load_prompt("chapter_detect")`, `load_prompt("chapter_summary")`
- [x] **3.2.7** `inject_block_ids()` called in summarize_chapter
- [x] **3.2.8** Updated `generate_master_summary` parameter: `sections` → `chapters`

### 3.3 Stream Routes (routes/stream.py)
- [x] **3.3.1** Renamed `build_section_dict()` → `build_chapter_dict()`
- [x] **3.3.2** Renamed `process_creator_sections()` → `process_creator_chapters()`
- [x] **3.3.3** Renamed `process_ai_sections()` → `process_ai_chapters()`
- [x] **3.3.4** Updated SSE event: `section_ready` → `chapter_ready`
- [x] **3.3.6** Updated `build_result()`: `sections` → `chapters`
- [x] **3.3.7** Added `extract_context()` function for persona→category mapping
- [x] **3.3.9** Category (not persona) stored in context_dict

---

## Phase 4: API Layer [Effort: M] - COMPLETED

- [x] API types updated through @vie/types package
- [x] Frontend handles both legacy `section_ready` and new `chapter_ready` events

---

## Phase 5: Frontend [Effort: L] - COMPLETED

### 5.1 Type Imports
- [x] Section type kept as alias for SummaryChapter for backwards compat
- [x] Components use Section type which is now alias

### 5.3 Hook Updates
- [x] **5.3.1** Updated `use-summary-stream.ts` to handle both `chapter_ready` and legacy `section_ready`
- [x] **5.3.2** State still uses `sections` internally but handles chapter events
- [x] **5.3.3** Updated `use-processing-manager.ts` to handle `chapter_ready` events

### 5.4 View Components
- [x] Updated `StreamingIndicator.tsx`: phase labels use `chapter_detect`, `chapter_summaries`

### 5.6 Frontend Tests - ALL 418 TESTS PASS
- [x] **5.6.1** Updated `use-summary-stream.test.ts` - phase names, event names
- [x] **5.6.2** Updated `processing-store.test.ts` - phase names
- [x] **5.6.3** Updated `sse-validators.test.ts` - phase names, blockId in content blocks, category in context

---

## Phase 6: Database Reset [Effort: S] - COMPLETED

- [x] **6.1** Created `scripts/reset-database.ts`
- [x] **6.2** Collections to drop: videoSummaryCache, memorizedItems, userVideos, systemExpansionCache, userChats
- [x] **6.3** Preserves users, folders collections

---

## Phase 7: Documentation Updates [Effort: S] - COMPLETED

- [x] **7.1** Updated `docs/DATA-MODELS.md`:
  - Added blockId to ContentBlock types
  - Updated VideoContext from persona to category
  - Updated videoSummaryCache schema: sections → chapters
  - Updated systemExpansionCache references
  - Updated memorizedItems: video_section → video_chapter
  - Added QuoteBlock and StatisticBlock documentation

- [x] **7.2** Updated `docs/SERVICE-SUMMARIZER.md`:
  - Updated prompt file names
  - Updated processing pipeline: DETECT SECTIONS → DETECT CHAPTERS
  - Updated code examples with chapter terminology
  - Updated output schema: Section → Chapter class

- [x] **7.3** Updated `docs/API-REFERENCE.md`:
  - Updated SSE event types: section_ready → chapter_ready
  - Updated phase names: section_detect → chapter_detect, section_summaries → chapter_summaries
  - Updated event payloads with blockId
  - Updated metadata event to show category instead of persona
  - Updated client implementation example

---

## Phase 8: End-to-End Testing [Effort: M] - COMPLETED

- [x] TypeScript compilation passes (all packages)
- [x] All 418 frontend tests pass
- [x] SSE validators updated with chapter terminology
- [x] Phase names validated
- [x] Content blocks validated with blockId
- [x] Category field validated in VideoContext

---

## Final Checklist - ALL COMPLETE

- [x] All "section" → "chapter" renames complete in production code
- [x] All ContentBlocks have `blockId` in schema and validators
- [x] SSE events updated: `chapter_ready`, `chapter_detect`, `chapter_summaries`
- [x] `context.category` stored (not persona) - persona is internal LLM concept only
- [x] All tests pass (418 tests)
- [x] TypeScript builds clean
- [x] Database reset script created
- [x] Documentation updated

---

## Summary of Changes

### New Files
- `scripts/reset-database.ts` - Database reset utility

### Renamed Files
- `services/summarizer/src/prompts/section_detect.txt` → `chapter_detect.txt`
- `services/summarizer/src/prompts/section_summary.txt` → `chapter_summary.txt`

### Key Code Changes
1. **packages/types/src/index.ts** - BaseBlock with blockId, SummaryChapter type, VideoContext with category
2. **services/summarizer/src/services/llm.py** - inject_block_ids(), renamed functions with backwards compat
3. **services/summarizer/src/routes/stream.py** - chapter_ready events, persona→category mapping
4. **apps/web/src/lib/sse-validators.ts** - Updated schemas for chapter events
5. **apps/web/src/hooks/use-summary-stream.ts** - Handles both chapter and legacy section events
6. **apps/web/src/hooks/use-processing-manager.ts** - Handles chapter_ready events
7. **apps/web/src/components/video-detail/StreamingIndicator.tsx** - Updated phase labels

### Documentation Updates
- `docs/DATA-MODELS.md`
- `docs/SERVICE-SUMMARIZER.md`
- `docs/API-REFERENCE.md`

---

## Progress Tracking

| Phase | Status | Completed | Notes |
|-------|--------|-----------|-------|
| Phase 1: Prompts | COMPLETED | 2026-02-04 | All prompts renamed and updated |
| Phase 2: Types | COMPLETED | 2026-02-04 | BaseBlock, Chapter types, category |
| Phase 3: Python | COMPLETED | 2026-02-04 | LLM service, stream routes |
| Phase 4: API | COMPLETED | 2026-02-04 | Types via @vie/types |
| Phase 5: Frontend | COMPLETED | 2026-02-04 | Hooks, validators, tests |
| Phase 6: Database | COMPLETED | 2026-02-04 | Reset script created |
| Phase 7: Docs | COMPLETED | 2026-02-04 | All docs updated |
| Phase 8: E2E | COMPLETED | 2026-02-04 | 418 tests pass |

**Overall Status:** COMPLETED
