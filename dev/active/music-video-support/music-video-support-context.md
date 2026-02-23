# Music Video Support — Context

Last Updated: 2026-02-23
Status: **Code Complete** — All 6 phases implemented, all unit/integration tests pass, Playwright layout verified

---

## Key Files

### Backend — Category Detection
| File | Purpose | Key Lines |
|------|---------|-----------|
| `services/summarizer/src/prompts/detection/category_rules.json` | Weighted scoring rules per category | Lines 13-120 (existing categories), line 122 (default) |
| `services/summarizer/src/services/youtube.py` | VALID_CATEGORIES, _select_persona, classify_category_with_llm, _detect_category | Lines 42-45 (VALID_CATEGORIES), 315-340 (_select_persona), 343-405 (LLM classify), 206-312 (_detect_category) |

### Backend — Transcription
| File | Purpose | Key Lines |
|------|---------|-----------|
| `services/summarizer/src/services/gemini_transcriber.py` | Gemini audio transcription | Lines 63-76 (TRANSCRIPTION_PROMPT), ~399 (response.text crash), 410-431 (error handling) |
| `services/summarizer/src/services/whisper_transcriber.py` | Whisper fallback transcription | Lines 139-191 (_transcribe_sync), 304-391 (transcribe_with_whisper) |

### Backend — Pipeline
| File | Purpose | Key Lines |
|------|---------|-----------|
| `services/summarizer/src/routes/stream.py` | Main SSE pipeline, transcript fallback chain | Lines 86-91 (TranscriptData), 122-286 (fetch_transcript), 303-378 (context/persona), 948-1178 (stream_summarization), 1020-1029 (transcript fetch) |
| `services/summarizer/src/models/schemas.py` | TranscriptSource type, NormalizedTranscript | Line 9 (TranscriptSource), 45-50 (NormalizedTranscript) |

### Backend — Persona System
| File | Purpose |
|------|---------|
| `services/summarizer/src/prompts/personas/` | 8 persona files: code, recipe, interview, review, fitness, travel, education, standard |
| `services/summarizer/src/prompts/persona_system.txt` | 10 domain experts (AUTHOR, CHEF, TRAVELER, CRITIC, ENGINEER, PROFESSOR, TRAINER, HOST, MAKER, GAMER) |

### Backend — Subtitle Cleaning
| File | Purpose | Key Lines |
|------|---------|-----------|
| `services/summarizer/src/services/youtube.py` | `_clean_subtitle_text` strips [Music] annotations | Lines 766-769 |
| `services/summarizer/src/services/transcript.py` | Also strips [Music] | Line 127 |

### Frontend
| File | Purpose | Key Lines |
|------|---------|-----------|
| `packages/types/src/index.ts` | VIDEO_CATEGORY_VALUES, VideoCategory type | Lines 76-90 |
| `apps/web/src/components/video-detail/ArticleSection.tsx` | Category → View switch | Lines 66-101 |
| `apps/web/src/components/video-detail/views/index.ts` | View barrel exports | — |
| `apps/web/src/lib/sse-validators.ts` | SSE category validation (uses VIDEO_CATEGORY_VALUES) | Line 254 |

### Tests
| File | Purpose |
|------|---------|
| `services/summarizer/tests/test_gemini_transcriber.py` | Gemini transcriber tests |
| `services/summarizer/tests/test_whisper_transcriber.py` | Whisper transcriber tests |

---

## Key Decisions

### 1. Music detection via weighted scoring (not special-case)
**Decision:** Add music as a standard category in `category_rules.json`, not a hardcoded YouTube category check.
**Why:** Consistent with existing detection architecture. YouTube category alone isn't reliable (entertainment category overlaps). Weighted scoring with keywords + title patterns + YouTube category gives better accuracy.

### 2. Separate transcription prompt, not conditional logic inside existing prompt
**Decision:** Create `MUSIC_TRANSCRIPTION_PROMPT` as a separate constant, selected based on `is_music` flag.
**Why:** Cleaner separation. The music prompt has fundamentally different instructions (include lyrics vs. skip music). Avoids complex conditional prompting.

### 3. Metadata fallback only for music category
**Decision:** Metadata-only fallback is gated on `category == "music"`. Other categories still fail normally when all transcript sources fail.
**Why:** For non-music content, no transcript genuinely means we can't summarize. For music videos, metadata (title, description, artist credits) actually contains meaningful information to summarize.

### 4. StandardView fallback for frontend (no MusicView yet)
**Decision:** Add `case 'music': return <StandardView />` in the view switch. Dedicated MusicView is a follow-up task.
**Why:** StandardView handles all block types. Building a proper MusicView with lyrics display, credits layout, etc. is a separate design effort.

### 5. Pass `is_music` flag through pipeline, not re-detect
**Decision:** The stream route knows the category from detection. Pass `is_music: bool` down to transcriber functions.
**Why:** Avoids duplicate detection. Category is already determined in the pipeline before transcription starts.

---

## Dependencies Between Phases

```
Phase 1 (Gemini crash fix)
    ↓
Phase 3 (Music transcription) ← Phase 2 (Music detection)
    ↓
Phase 4 (Metadata fallback)
    ↓
Phase 5 (Music persona) [independent, can parallel Phase 3-4]
    ↓
Phase 6 (Frontend) ← Phase 2 (needs 'music' category)
```

Phase 1 is independent and should be done first (bug fix).
Phase 2 is independent of Phase 1 but required by Phases 3, 5, 6.
Phase 5 and 6 can be done in parallel after Phase 2.

---

## API Contracts

### TranscriptSource (after change)
```python
TranscriptSource = Literal["ytdlp", "api", "proxy", "whisper", "gemini", "metadata"]
```

### New SSE event for metadata fallback
```json
{"event": "phase", "data": {"phase": "metadata_fallback"}}
```

### VideoCategory (after change)
```typescript
export const VIDEO_CATEGORY_VALUES = [
  'cooking', 'coding', 'travel', 'reviews', 'fitness',
  'education', 'podcast', 'diy', 'gaming', 'music', 'standard',
] as const;
```

---

## Test Videos

| Video ID | Type | Expected Behavior |
|----------|------|-------------------|
| `nrzIrsJQT60` | Hebrew music mashup | Detect as music, attempt lyrics, possibly metadata fallback |
| (any pop MV) | Lyrics-heavy music video | Detect as music, Gemini transcribes lyrics successfully |
| (instrumental) | No vocals | Detect as music, all transcription fails, metadata fallback |
| (music review) | Commentary about music | Detect as reviews/education, NOT music — normal flow |
