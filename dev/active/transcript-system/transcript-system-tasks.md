# Transcript System - Task Checklist

**Last Updated:** 2026-01-27

---

## Overview

- **Total Phases:** 4 (Phase 3 removed)
- **Estimated Effort:** 15-20 hours
- **Dependencies:** Phase 1 → Phase 2 → Phase 4

---

## Phase 1: Rate Limiting Fix

**Effort:** S (2-3 hours)
**Priority:** P0 - Critical
**Dependencies:** None
**Status:** ✅ COMPLETE

### Tasks

- [x] **1.1** Add `RATE_LIMITED` error code to `schemas.py`
- [x] **1.2** Add rate limit detection function to `transcript.py`
- [x] **1.3** Add tenacity retry decorator to `_fetch_transcript_sync()`
- [x] **1.4** Map rate limit exceptions to RATE_LIMITED error code
- [x] **1.5** Test Phase 1

---

## Phase 2: Normalized Transcript Format

**Effort:** M (3-4 hours)
**Priority:** P1 - High
**Dependencies:** Phase 1 complete
**Status:** ✅ COMPLETE

### Tasks

- [x] **2.1** Add Pydantic models to `schemas.py`
- [x] **2.2** Add `normalize_segments()` function to `transcript.py`
- [x] **2.3** Update `get_transcript()` to return `NormalizedTranscript`
- [x] **2.4** Update MongoDB storage to save segments
- [x] **2.5** Test Phase 2

---

## Phase 3: Browser-Side Fetching

**Status:** ❌ REMOVED

> **REMOVED (2026-01-27):** Browser-side YouTube transcript fetching cannot work due to
> YouTube's CORS policy. The browser cannot directly fetch transcripts from YouTube's
> API. All transcript fetching must go through the backend.
>
> The backend has a robust fallback chain: yt-dlp → youtube-transcript-api → Whisper.
>
> **Code cleaned up:** All browser transcript code has been removed from the codebase:
> - Removed `use-browser-transcript.ts` hook
> - Removed `BrowserTranscript` interface from types
> - Removed `browserTranscript` parameter from API routes and services
> - Removed browser transcript handling from Python summarizer

---

## Phase 4: Whisper Fallback

**Effort:** L (6-8 hours)
**Priority:** P2 - Medium
**Dependencies:** Phase 2 complete (for NormalizedTranscript)
**Status:** ✅ COMPLETE

### Tasks

- [x] **4.1** Add Whisper configuration to `config.py`
- [x] **4.2** Add openai to requirements.txt
- [x] **4.3** Add ffmpeg to Dockerfile
- [x] **4.4** Create `whisper_transcriber.py` service
- [x] **4.5** Integrate Whisper into fallback chain
- [x] **4.6** Test Phase 4

---

## Post-Implementation

- [x] **5.1** Update documentation
- [ ] **5.2** Add monitoring (future)
- [x] **5.3** Clean up

---

## Progress Summary

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1 | ✅ Complete | Rate limiting with retry |
| Phase 2 | ✅ Complete | Normalized segments stored |
| Phase 3 | ❌ Removed | CORS prevents browser-side fetching |
| Phase 4 | ✅ Complete | Whisper fallback ready |
| Post | ✅ Complete | Monitoring deferred |

**Overall Progress:** All viable phases complete ✅

---

## Transcript Fallback Chain (Final)

```
yt-dlp subtitles (from video metadata)
    ↓ (if unavailable)
youtube-transcript-api (with rate limit retry)
    ↓ (if NO_TRANSCRIPT error)
OpenAI Whisper (audio transcription)
```

---

## Files Modified

**Backend (Python):**
- `services/summarizer/src/models/schemas.py` - Added RATE_LIMITED, TranscriptSegment, NormalizedTranscript
- `services/summarizer/src/services/transcript.py` - Added retry logic, normalize_segments()
- `services/summarizer/src/services/whisper_transcriber.py` - NEW: Whisper fallback service
- `services/summarizer/src/repositories/mongodb_repository.py` - Store transcriptSegments, transcriptSource
- `services/summarizer/src/routes/stream.py` - Whisper fallback integration
- `services/summarizer/src/config.py` - WHISPER_ENABLED settings
- `services/summarizer/requirements.txt` - Added openai
- `services/summarizer/Dockerfile` - Added ffmpeg

**Shared Types:**
- `packages/types/src/index.ts` - TranscriptSegment, TranscriptSource types

**Documentation:**
- `docs/SERVICE-SUMMARIZER.md` - Updated fallback chain
- `docs/DATA-MODELS.md` - Updated MongoDB fields
