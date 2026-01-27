# Transcript System Overhaul - Implementation Plan

**Last Updated:** 2026-01-27

> **Note:** Phase 3 (Browser-Side Fetching) was REMOVED. Browser-side YouTube transcript
> fetching cannot work due to YouTube's CORS policy. See tasks.md for details.

---

## Executive Summary

Implement a bulletproof transcript fetching system that can summarize ANY YouTube video. The plan adds 3 layers to the existing fallback chain: rate limiting fixes, normalized transcript format, and Whisper audio transcription fallback.

### Goal
- **Current success rate:** ~85% (fails on rate limiting, no-caption videos)
- **Target success rate:** ~99% (only fails on private/deleted/live)

### Key Deliverables
1. **Phase 1:** Rate limiting fix with retry logic
2. **Phase 2:** Normalized transcript format with segment storage
3. ~~**Phase 3:** Browser-side transcript fetching~~ **(REMOVED - CORS limitation)**
4. **Phase 4:** Whisper audio transcription fallback

---

## Current State Analysis

### What Works
| Layer | Status | Notes |
|-------|--------|-------|
| Cache (MongoDB) | ✅ Done | Versioning, deduplication working |
| yt-dlp subtitles | ✅ Done | Has retry + proxy fallback |
| youtube-transcript-api | ⚠️ Partial | No retry on 429 |
| Webshare proxy | ⚠️ Partial | No retry on 429 |

### What's Missing
| Layer | Status | Impact |
|-------|--------|--------|
| Rate limit retry | ❌ Missing | ~10% of videos fail unnecessarily |
| Segment storage | ❌ Missing | Blocks timestamp features |
| Browser fetching | ❌ Missing | Server IP quota exhausted |
| Whisper fallback | ❌ Missing | No-caption videos fail |

### Current Fallback Chain
```
1. CACHE              → MongoDB by youtubeId
     ↓ miss
2. YT-DLP SUBTITLES   → Server extracts subtitles
     ↓ no subtitles
3. SERVER API         → youtube-transcript-api direct
     ↓ blocked/429 (FAILS HERE!)
4. SERVER + PROXY     → youtube-transcript-api + Webshare
     ↓ fail (FAILS HERE!)
5. ERROR              → Generic "something went wrong"
```

### Final Fallback Chain
```
1. CACHE              → MongoDB by youtubeId
     ↓ miss
2. YT-DLP SUBTITLES   → Server extracts subtitles
     ↓ no subtitles exist
3. SERVER API         → youtube-transcript-api with RETRY ← FIX
     ↓ blocked/429
4. SERVER + PROXY     → youtube-transcript-api + Webshare with RETRY ← FIX
     ↓ fail
5. WHISPER            → Download audio → OpenAI Whisper ← NEW
     ↓ fail
6. ERROR              → Specific error code + message ← FIX
```

> **Note:** Browser-side fetching was originally planned but removed due to CORS limitations.

---

## Proposed Architecture

### Normalized Transcript Format

All sources output this unified format:

```python
class TranscriptSegment(BaseModel):
    text: str
    startMs: int   # milliseconds
    endMs: int     # milliseconds

class NormalizedTranscript(BaseModel):
    text: str
    segments: list[TranscriptSegment]
    source: Literal["ytdlp", "api", "proxy", "whisper"]
```

### Source Format Conversions

| Source | Input Format | Conversion |
|--------|--------------|------------|
| yt-dlp | `start` (s) + `duration` (s) | Multiply by 1000 |
| API | `start` (s) + `duration` (s) | Multiply by 1000 |
| Whisper | `start` (s) + `end` (s) | Multiply by 1000 |

### Data Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Browser   │────▶│   vie-api   │────▶│ Summarizer  │
│             │     │             │     │             │
│ • Send URL  │     │ • Validate  │     │ • Fallback  │
│             │     │ • Trigger   │     │   chain     │
│             │     │   summary   │     │ • Normalize │
└─────────────┘     └─────────────┘     └─────────────┘
                                               │
                                               ▼
                                        ┌─────────────┐
                                        │  MongoDB    │
                                        │             │
                                        │ • segments  │
                                        │ • source    │
                                        └─────────────┘
```

---

## Implementation Phases

### Phase 1: Rate Limiting Fix (Effort: S)

**Goal:** Stop failing on 429 errors

**Changes:**
1. Add `RATE_LIMITED` error code
2. Add `@tenacity.retry()` decorator with exponential backoff
3. Detect 429 in error messages and map correctly

**Files:**
- `services/summarizer/src/models/schemas.py` - Add error code
- `services/summarizer/src/services/transcript.py` - Add retry logic

**Acceptance Criteria:**
- [ ] 429 errors trigger 3 retries with exponential backoff (4s, 8s, 16s)
- [ ] Rate limit errors return `RATE_LIMITED` code, not `UNKNOWN_ERROR`
- [ ] Logs show retry attempts with timing

---

### Phase 2: Normalized Transcript Format (Effort: M)

**Goal:** Store segments for timestamp features

**Changes:**
1. Add Pydantic models for segments
2. Add conversion functions
3. Update MongoDB storage
4. Update cache retrieval

**Files:**
- `services/summarizer/src/models/schemas.py` - Add models
- `services/summarizer/src/services/transcript.py` - Add normalization
- `services/summarizer/src/repositories/mongodb_repository.py` - Store segments

**Acceptance Criteria:**
- [ ] All transcript sources converted to millisecond format
- [ ] `transcriptSegments` array stored in MongoDB
- [ ] `transcriptSource` field tracks origin
- [ ] Existing transcripts continue working (backward compatible)

---

### Phase 3: Browser-Side Fetching ❌ REMOVED

> **REMOVED (2026-01-27):** Browser-side YouTube transcript fetching cannot work due to
> YouTube's CORS policy. The browser cannot directly fetch transcripts from YouTube's
> API endpoints. All transcript fetching must go through the backend.
>
> The backend fallback chain (yt-dlp → API → Whisper) is sufficient for ~99% success rate.

---

### Phase 4: Whisper Fallback (Effort: L)

**Goal:** Transcribe videos without captions

**Changes:**
1. Create Whisper transcriber service
2. Add ffmpeg to Docker
3. Add configuration settings
4. Integrate into fallback chain

**Files:**
- `services/summarizer/src/services/whisper_transcriber.py` - New service
- `services/summarizer/src/config.py` - Add settings
- `services/summarizer/src/services/transcript.py` - Integrate fallback
- `services/summarizer/requirements.txt` - Add openai
- `services/summarizer/Dockerfile` - Add ffmpeg

**Acceptance Criteria:**
- [ ] Audio downloaded via yt-dlp
- [ ] Transcribed via OpenAI Whisper API
- [ ] Estimated timestamps generated (~2.5 words/second)
- [ ] Returns `NormalizedTranscript` with `source: "whisper"`
- [ ] Triggered only when `NO_TRANSCRIPT` error
- [ ] Respects `WHISPER_MAX_DURATION_MINUTES` setting
- [ ] Audio file cleaned up after processing

---

## Risk Assessment

### Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Browser CORS issues | Medium | High | Fallback to server fetch |
| Whisper API costs | Low | Medium | Limit to videos < 60 min |
| Rate limit evasion | Low | Low | Exponential backoff |
| Breaking changes | Low | High | Backward-compatible storage |

### Dependencies

| Phase | Dependencies |
|-------|-------------|
| 1 | `tenacity` package (already in requirements) |
| 2 | Phase 1 error codes |
| 3 | `youtube-transcript` npm package |
| 4 | OpenAI API key, ffmpeg binary |

### Rollback Strategy

Each phase is independently deployable:
- Phase 1: Remove retry decorator
- Phase 2: Ignore new MongoDB fields
- Phase 3: Skip browser fetch, use server
- Phase 4: Disable `WHISPER_ENABLED` flag

---

## Success Metrics

### Primary Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Transcript success rate | ~85% | >99% |
| 429 error failures | ~10% | <1% |
| No-caption video failures | 100% | <10% |
| Avg transcript fetch time | ~3s | ~2s (browser) |

### Monitoring

- Log `transcriptSource` distribution
- Track retry attempts per video
- Monitor Whisper API usage/costs
- Alert on error rate spikes

---

## Timeline Estimates

| Phase | Effort | Dependencies |
|-------|--------|--------------|
| Phase 1 | S (2-3 hours) | None |
| Phase 2 | M (3-4 hours) | Phase 1 |
| Phase 3 | L (4-5 hours) | Phase 2 |
| Phase 4 | L (6-8 hours) | Phase 2 |

**Total:** ~15-20 hours

**Recommended Order:** 1 → 2 → 3 → 4

Phase 3 and 4 can be parallelized after Phase 2 completes.

---

## Verification Plan

### Phase 1
```bash
# Trigger rate limiting with rapid requests
# Should see retry logs and RATE_LIMITED error code
docker logs vie-summarizer -f
```

### Phase 2
```bash
# Check MongoDB for new fields
mongosh vie --eval "db.videoSummaryCache.findOne({}, {transcriptSegments: 1, transcriptSource: 1})"
```

### Phase 3
```bash
# Check browser console for transcript fetch
# Check summarizer logs for "Using browser-fetched transcript"
```

### Phase 4
```bash
# Test with video that has no captions
# Check logs for "trying Whisper fallback"
```

---

## Coverage After Implementation

| Video Type | Current | After |
|------------|---------|-------|
| Has captions | ✅ | ✅ |
| No captions | ❌ | ✅ (Whisper) |
| Foreign language | ⚠️ | ✅ |
| Music videos | ❌ | ✅ |
| Old videos | ⚠️ | ✅ |
| IP blocked | ⚠️ | ✅ (Proxy) |
| Rate limited | ❌ | ✅ (Retry) |

**Only fails:** Private, deleted, live streams
