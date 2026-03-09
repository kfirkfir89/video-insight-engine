# Music Video Support — Detection, Transcription & Metadata Fallback

Last Updated: 2026-02-23

---

## Executive Summary

Music videos are the most common case hitting the audio transcription fallback (no YouTube captions), but the system has **zero music support**. Every music video currently fails completely because:

1. No "music" category — YouTube's "Music" category (ID 10) isn't mapped; music videos fall to "standard"
2. Gemini prompt explicitly skips music — line 73: "If you hear music or silence, skip those sections" → returns empty for music videos
3. Gemini empty response crashes the pipeline — `response.text` raises `ValueError` with no handler
4. No music persona or frontend view
5. No metadata fallback — when all transcript sources fail, the system just errors out
6. Subtitle cleaning strips `[Music]` annotations that could be useful for music videos

This plan adds end-to-end music video support: detection → transcription → fallback → persona → frontend.

---

## Current State Analysis

### Category Detection (`youtube.py`)
- **VALID_CATEGORIES** (line 42): 10 categories, no `music`
- **`_select_persona`** (line 315): maps categories → personas, no music entry
- **`classify_category_with_llm`** (line 370): LLM prompt lists categories explicitly, no music
- **`category_rules.json`**: 9 categories with weighted scoring (keywords 40%, youtube_category 30%, title 15%, channel 15%)

### Transcription
- **Gemini prompt** (line 73): `"If you hear music or silence, skip those sections"` — kills music video transcription
- **Gemini response handling** (line 399): `response.text` accessed directly — crashes with `ValueError` when no text
- **Whisper** (`whisper_transcriber.py` line 139): No `prompt` parameter for music hint
- **Subtitle cleaning** (`youtube.py` lines 766-769, `transcript.py` line 127): Strips `[Music]` annotations

### Pipeline (`stream.py`)
- Transcript fallback chain: S3 cache → yt-dlp subs → youtube-transcript-api → Gemini → Whisper
- No metadata-only fallback path when all sources fail
- Category known at line 984 (after `finalize_video_context`), transcript fetched at line 1020

### Schemas (`schemas.py`)
- `TranscriptSource = Literal["ytdlp", "api", "proxy", "whisper", "gemini"]` — no `"metadata"`
- `TranscriptData` in stream.py uses plain `str` for source (not validated against literal)

### Persona System
- 8 persona files: code, recipe, interview, review, fitness, travel, education, standard
- 10 domain experts in `persona_system.txt` — no music expert
- Gaming and DIY map to `standard` persona (no dedicated files)

### Frontend
- `VIDEO_CATEGORY_VALUES` in `packages/types/src/index.ts` line 76: no `'music'`
- `ArticleSection.tsx` line 78: switch statement maps categories → views, no `'music'` case
- 10 view components exist, no `MusicView.tsx`
- SSE validator at `sse-validators.ts` line 254 validates against `VIDEO_CATEGORY_VALUES`

---

## Proposed Future State

```
Music Detection (fast, at category detection time)
         ↓
    Is music video?
    ├── YES → Use MUSIC_TRANSCRIPTION_PROMPT (Gemini) or prompt hint (Whisper)
    │         ├── Got lyrics/speech → Summarize with music persona
    │         └── No words (instrumental) → Metadata-only fallback
    └── NO  → Normal transcript flow (unchanged)
```

### Key Behaviors After Implementation
1. Music videos detected via YouTube category ID 10, keywords, title patterns, channel patterns
2. Gemini uses a music-specific prompt that transcribes lyrics instead of skipping them
3. Whisper gets a prompt hint for better lyrics transcription
4. When both Gemini and Whisper fail (instrumental), metadata fallback creates summary from title/description/tags
5. Music persona produces music-relevant analysis (song structure, lyrics themes, artist credits)
6. Frontend renders music videos via StandardView (dedicated MusicView is a follow-up)

---

## Implementation Phases

### Phase 1: Critical Bug Fix (Gemini Crash)
**Priority:** P0 — unblocks everything, affects all audio transcription, not just music

Fix the `response.text` ValueError crash in `gemini_transcriber.py`. This is an existing production bug that affects any video where Gemini returns no candidates or empty text.

### Phase 2: Music Category Detection
**Priority:** P1 — fast, isolated, no risk to existing categories

Add `"music"` category to the detection system: rules JSON, VALID_CATEGORIES, persona mapping, LLM classification prompt.

### Phase 3: Music-Aware Transcription
**Priority:** P1 — requires Phase 1 (Gemini fix) and Phase 2 (detection)

Create `MUSIC_TRANSCRIPTION_PROMPT` for Gemini that includes lyrics. Add `is_music` parameter threading from stream.py through to the transcriber. Add Whisper prompt hint.

### Phase 4: Metadata Fallback
**Priority:** P2 — only needed for instrumental/all-fail case

When all transcript sources fail for a music video, build a metadata-based "transcript" from title, description, tags, chapter titles. Add `"metadata"` to `TranscriptSource`. Handle `source == "metadata"` in the pipeline (skip sponsor filtering, skip AI chapter detection).

### Phase 5: Music Persona
**Priority:** P2 — improves quality but system works without it

Create `music.txt` persona file. Add MUSICIAN domain expert to `persona_system.txt`. Wire up `'music': 'music'` in `_select_persona`.

### Phase 6: Frontend Integration
**Priority:** P2 — minimal change, fall through to StandardView

Add `'music'` to `VIDEO_CATEGORY_VALUES` in shared types. Add `case 'music'` to ArticleSection view switch → StandardView. Dedicated MusicView with lyrics blocks is a separate follow-up task.

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Music category misdetects non-music content | Medium | Low | High confidence threshold; LLM fallback validates; only affects persona selection |
| Music transcription prompt reduces quality for spoken music content (commentary, podcast about music) | Low | Medium | Only activate when category == "music", not for mixed content |
| Metadata fallback produces low-quality summaries | Medium | Medium | Clearly label as "metadata-based" in transcript_type; frontend can show indicator |
| Subtitle cleaning strips useful `[Music]` annotations | Low | Low | Conditional skip only when category == "music"; existing behavior preserved for all other categories |
| Gemini crash fix changes error behavior | Low | High | Comprehensive try/except with specific error codes; test with known edge cases |

---

## Success Metrics

1. **Detection accuracy**: Music videos (YouTube category 10) correctly detected as `"music"` ≥90% of the time
2. **Transcription coverage**: Music videos with lyrics produce non-empty transcripts via Gemini or Whisper
3. **No regressions**: All existing tests pass; non-music videos unaffected
4. **Crash fix**: `response.text` ValueError no longer crashes the pipeline
5. **Graceful degradation**: Instrumental videos produce metadata-based summaries instead of errors

---

## Required Resources and Dependencies

### Internal Dependencies
- `services/summarizer/` — all backend changes
- `packages/types/` — shared TypeScript types
- `apps/web/` — frontend view switch

### External Dependencies
- Google Gemini API (multi-modal audio transcription)
- OpenAI Whisper API (fallback transcription)
- YouTube Data API (category detection, metadata)

### Test Resources
- Hebrew music mashup: `nrzIrsJQT60`
- Pop music video with lyrics (any well-known song)
- Instrumental music video (no vocals)
- Music commentary/review video (should NOT trigger music path)

---

## Effort Estimates

| Phase | Effort | Files Changed | Risk |
|-------|--------|--------------|------|
| Phase 1: Gemini crash fix | S | 1 | Low |
| Phase 2: Music category detection | M | 3 | Low |
| Phase 3: Music-aware transcription | M | 3 | Medium |
| Phase 4: Metadata fallback | L | 3 | Medium |
| Phase 5: Music persona | S | 3 | Low |
| Phase 6: Frontend integration | S | 3 | Low |
| **Total** | **L** | **~12 files** | **Medium** |
