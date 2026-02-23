# Music Video Support — Tasks

Last Updated: 2026-02-23

---

## Phase 1: Gemini Crash Fix (P0)

- [x] **1.1** Fix `response.text` ValueError in `gemini_transcriber.py` (~line 399)
  - Wrap in try/except ValueError
  - Check `response.candidates` before accessing `.text`
  - Extract `block_reason` and `finish_reason` for error context
  - Raise `TranscriptError(ErrorCode.NO_TRANSCRIPT)` with descriptive message
  - Handle empty/whitespace-only `response_text` explicitly
  - **Acceptance:** Gemini empty responses raise TranscriptError instead of crashing
  - **Effort:** S

- [x] **1.2** Write tests for Gemini empty response handling
  - Test: no candidates → TranscriptError
  - Test: candidates but no text → TranscriptError
  - Test: empty/whitespace text → TranscriptError
  - Test: valid text → passes through normally
  - **Acceptance:** All 4 edge cases covered with passing tests
  - **Effort:** S

---

## Phase 2: Music Category Detection (P1)

- [x] **2.1** Add `"music"` category to `category_rules.json`
  - YouTube categories: `["Music", "Entertainment"]` (primary: Music)
  - Primary keywords: music, song, album, official video, lyrics, music video, concert, live performance
  - Secondary keywords: remix, cover, acoustic, track, EP, single, feat, ft, producer, beat, instrumental
  - Title patterns: `official (music )?video`, `lyrics?( video)?`, `\bft\.?\b`, `\bfeat\.?\b`, `live at`, `concert`
  - Channel patterns: common music channels (VEVO, etc.)
  - **Acceptance:** `_detect_category` returns `("music", score)` for music video metadata
  - **Effort:** S

- [x] **2.2** Add `'music'` to `VALID_CATEGORIES` in `youtube.py` (line 42)
  - **Acceptance:** `'music'` in VALID_CATEGORIES frozenset
  - **Effort:** S

- [x] **2.3** Add `'music'` to `_select_persona` mapping in `youtube.py` (line 329)
  - Map `'music': 'music'` (will point to music.txt persona in Phase 5)
  - **Acceptance:** `_select_persona` returns `'music'` for music category
  - **Effort:** S

- [x] **2.4** Add `'music'` to `classify_category_with_llm` prompt in `youtube.py` (line 370)
  - Add music description to the LLM prompt category list
  - **Acceptance:** LLM fallback can return `"music"` as a valid category
  - **Effort:** S

- [x] **2.5** Write tests for music category detection
  - Test: YouTube Music category (ID 10) → detected as music
  - Test: Title with "Official Music Video" → detected as music
  - Test: Title with "ft." + music keywords → detected as music
  - Test: Music review video → NOT detected as music (should be reviews)
  - **Acceptance:** All detection tests pass
  - **Effort:** S

---

## Phase 3: Music-Aware Transcription (P1)
**Depends on:** Phase 1, Phase 2

- [x] **3.1** Add `MUSIC_TRANSCRIPTION_PROMPT` to `gemini_transcriber.py`
  - Instructs Gemini to include ALL lyrics and singing
  - Note instrumental sections as `[Instrumental]`
  - Same JSON segment format as existing prompt
  - **Acceptance:** Prompt constant defined and ready for use
  - **Effort:** S

- [x] **3.2** Add `is_music` parameter to `transcribe_with_gemini()`
  - Thread from `stream.py` → `gemini_transcriber.py`
  - Select `MUSIC_TRANSCRIPTION_PROMPT` when `is_music=True`
  - Default to existing `TRANSCRIPTION_PROMPT` when `is_music=False`
  - **Acceptance:** Music videos use music-specific prompt; non-music videos unchanged
  - **Effort:** M

- [x] **3.3** Add `prompt` hint to Whisper `_transcribe_sync()`
  - Add optional `prompt` parameter: `"Transcribe all lyrics and singing accurately."` when `is_music=True`
  - Thread `is_music` from `stream.py` → `whisper_transcriber.py`
  - **Acceptance:** Whisper receives lyrics hint for music videos
  - **Effort:** S

- [x] **3.4** Thread `is_music` flag through `stream.py` pipeline
  - After category detection (line 984), determine `is_music = (category == "music")`
  - Pass to `fetch_transcript()` or to the individual transcriber calls
  - **Acceptance:** Category propagates to transcription prompt selection
  - **Effort:** M

- [x] **3.5** Write tests for music transcription prompt selection
  - Test: `is_music=True` → uses MUSIC_TRANSCRIPTION_PROMPT
  - Test: `is_music=False` → uses standard TRANSCRIPTION_PROMPT
  - Test: Whisper receives prompt hint when `is_music=True`
  - **Acceptance:** All prompt selection tests pass
  - **Effort:** S

---

## Phase 4: Metadata Fallback (P2)
**Depends on:** Phase 2, Phase 3

- [x] **4.1** Add `"metadata"` to `TranscriptSource` in `schemas.py` (line 9)
  - **Acceptance:** `"metadata"` is a valid TranscriptSource literal
  - **Effort:** S

- [x] **4.2** Implement `_build_metadata_text()` in `stream.py`
  - Compose from: title, channel name, description, tags, chapter titles
  - Clean/truncate description to reasonable length
  - Return structured text suitable for summarization
  - **Acceptance:** Function produces meaningful text from video metadata
  - **Effort:** S

- [x] **4.3** Add metadata fallback path in `stream.py` after Whisper failure
  - Gate on `category == "music"`
  - Emit SSE event: `{"event": "phase", "data": {"phase": "metadata_fallback"}}`
  - Create `TranscriptData(segments=[], raw_text=metadata_text, transcript_type="metadata", source="metadata")`
  - **Acceptance:** Music videos with no speech produce metadata-based transcript instead of error
  - **Effort:** M

- [x] **4.4** Handle `source == "metadata"` in the main pipeline
  - Skip sponsor filtering
  - Skip AI chapter detection (use creator chapters or single overview)
  - Skip concept extraction (no timestamps)
  - Pass metadata text to `summarize_chapter()` (works with any text)
  - **Acceptance:** Metadata-based transcripts flow through pipeline without errors
  - **Effort:** M

- [x] **4.5** Write tests for metadata fallback
  - Test: `_build_metadata_text` produces expected format
  - Test: Metadata fallback triggers only for music category
  - Test: Non-music categories still raise TranscriptError on all-fail
  - Test: Metadata transcript skips sponsor filtering and chapter detection
  - **Acceptance:** All fallback tests pass
  - **Effort:** M

---

## Phase 5: Music Persona (P2)
**Depends on:** Phase 2

- [x] **5.1** Create `services/summarizer/src/prompts/personas/music.txt`
  - Focus: song structure, lyrics themes, artist collaborations, production credits, musical style
  - Preferred blocks: quote (lyrics), callout (credits/featured artists), paragraph (analysis), comparison (style comparisons)
  - **Acceptance:** Persona file exists and follows format of existing personas
  - **Effort:** S

- [x] **5.2** Add MUSICIAN domain expert to `persona_system.txt`
  - Add entry with `view: "music"`
  - Define music-specific focus areas and preferred block types
  - **Acceptance:** Domain expert list includes MUSICIAN with correct view
  - **Effort:** S

---

## Phase 6: Frontend Integration (P2)
**Depends on:** Phase 2

- [x] **6.1** Add `'music'` to `VIDEO_CATEGORY_VALUES` in `packages/types/src/index.ts` (line 76)
  - **Acceptance:** `'music'` is a valid VideoCategory; TypeScript types compile; SSE validators accept `"music"`
  - **Effort:** S

- [x] **6.2** Add `case 'music'` to view switch in `ArticleSection.tsx`
  - Fall through to `<StandardView {...viewProps} />`
  - **Acceptance:** Music category renders StandardView without errors
  - **Effort:** S

---

## Verification

- [x] **V.1** Run all existing summarizer tests: 168 passed, 0 failed
- [x] **V.2** Run web type check: passed cleanly
- [x] **V.3** Run shared types build: success
- [x] **V.4** Rebuild summarizer: `docker-compose up -d --build vie-summarizer` — healthy, model=gemini/gemini-3-flash-preview
- [x] **V.5** E2E test with `nrzIrsJQT60` (Hebrew music mashup) — category=music (despite YT "People & Blogs"), 5 chapters, 32.6s
- [x] **V.6** E2E test with Adele - Hello (lyrics-heavy pop) — category=music, YT "Music", 6 chapters, 35.4s
- [x] **V.7** E2E test with Beethoven Moonlight Sonata (instrumental) — category=music, YT "Music", 3 movements as chapters, 21.3s
- [x] **V.8** Regression test with Fireship JS Pro Tips — category=coding, view=coding, unchanged behavior, 32.2s
- [x] **V.9** Playwright layout checks: desktop (1280px), mobile (375px), tablet (768px) — 0 new issues
- [x] **V.10** Frontend tests: 53 files, 1089 tests passed

---

## Summary

| Phase | Tasks | Effort | Status |
|-------|-------|--------|--------|
| Phase 1: Gemini Crash Fix | 2 | S | ✅ Complete |
| Phase 2: Music Detection | 5 | M | ✅ Complete |
| Phase 3: Music Transcription | 5 | M | ✅ Complete |
| Phase 4: Metadata Fallback | 5 | L | ✅ Complete |
| Phase 5: Music Persona | 2 | S | ✅ Complete |
| Phase 6: Frontend Integration | 2 | S | ✅ Complete |
| Verification | 10 | M | ✅ Complete (10/10) |
| **Total** | **31** | **L** | ✅ **DONE** |
