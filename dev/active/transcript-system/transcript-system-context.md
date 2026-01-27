# Transcript System - Context & Reference

**Last Updated:** 2026-01-27

> **Note:** Phase 3 (Browser-Side Fetching) was REMOVED due to YouTube CORS limitations.
> See tasks.md for details. References to Phase 3 below are kept for historical context.

---

## Key Files

### Phase 1: Rate Limiting Fix

| File | Purpose | Key Lines |
|------|---------|-----------|
| `services/summarizer/src/models/schemas.py` | Error code definitions | `ErrorCode` enum |
| `services/summarizer/src/services/transcript.py` | Transcript fetching | `_fetch_transcript_sync()` |

### Phase 2: Normalized Format

| File | Purpose | Key Lines |
|------|---------|-----------|
| `services/summarizer/src/models/schemas.py` | Add segment models | New `TranscriptSegment` |
| `services/summarizer/src/services/transcript.py` | Add normalization | `normalize_segments()` |
| `services/summarizer/src/repositories/mongodb_repository.py` | Store segments | `save_result()` |

### Phase 3: Browser Fetching ❌ REMOVED

> **REMOVED:** Browser-side fetching cannot work due to YouTube CORS policy.
> No code was implemented - all transcript fetching goes through backend.

### Phase 4: Whisper Fallback

| File | Purpose | Key Lines |
|------|---------|-----------|
| `services/summarizer/src/services/whisper_transcriber.py` | NEW - Whisper service | All |
| `services/summarizer/src/config.py` | Whisper settings | New settings |
| `services/summarizer/src/services/transcript.py` | Integrate fallback | `get_transcript()` |
| `services/summarizer/requirements.txt` | Add openai | New dependency |
| `services/summarizer/Dockerfile` | Add ffmpeg | apt-get install |

---

## Key Decisions

### 1. Milliseconds for Timestamps
**Decision:** Normalize all timestamps to milliseconds (startMs, endMs)
**Rationale:**
- More precision than seconds
- Consistent across all sources
- JavaScript-friendly (video.currentTime * 1000)

### 2. ~~Browser Fetch with 5s Timeout~~ ❌ REMOVED
**Decision:** ~~Frontend attempts transcript fetch with 5-second timeout~~
**Status:** REMOVED - YouTube CORS policy prevents browser-side fetching.
All transcript fetching goes through the backend fallback chain.

### 3. Whisper as Last Resort
**Decision:** Whisper only triggers on NO_TRANSCRIPT error
**Rationale:**
- API costs money (~$0.006/min)
- Most videos have captions
- Nuclear option for edge cases

### 4. Backward Compatible Storage
**Decision:** Add new fields without removing old ones
**Rationale:**
- `transcript` field still works
- New `transcriptSegments` enhances
- No migration needed

### 5. Source Tracking
**Decision:** Store `transcriptSource` with every transcript
**Rationale:**
- Analytics on fetch methods
- Debug which path used
- Cost attribution for Whisper

---

## Dependencies

### Python Packages
```
tenacity          # Retry with backoff
youtube-transcript-api  # Already installed
openai            # For Whisper API (Phase 4)
```

### npm Packages
```
# None required - Phase 3 was removed
```

### System Dependencies
```
ffmpeg            # Audio extraction for Whisper (Phase 4)
```

---

## Error Code Reference

### Current Codes
```python
class ErrorCode(str, Enum):
    NO_TRANSCRIPT = "NO_TRANSCRIPT"
    VIDEO_TOO_LONG = "VIDEO_TOO_LONG"
    VIDEO_TOO_SHORT = "VIDEO_TOO_SHORT"
    VIDEO_UNAVAILABLE = "VIDEO_UNAVAILABLE"
    VIDEO_RESTRICTED = "VIDEO_RESTRICTED"
    LIVE_STREAM = "LIVE_STREAM"
    LLM_ERROR = "LLM_ERROR"
    UNKNOWN_ERROR = "UNKNOWN_ERROR"
```

### Adding in Phase 1
```python
    RATE_LIMITED = "RATE_LIMITED"  # NEW
```

### Detection Logic
```python
def _is_rate_limit_error(error_str: str) -> bool:
    """Detect rate limiting in error messages."""
    error_lower = error_str.lower()
    return any(x in error_lower for x in ["429", "too many", "rate limit"])
```

---

## MongoDB Schema Changes

### Current videoSummaryCache
```javascript
{
  youtubeId: string,
  transcript: string,           // Full text
  transcriptType: string,       // "manual|auto-generated|yt-dlp"
  // ... other fields
}
```

### After Phase 2
```javascript
{
  youtubeId: string,
  transcript: string,                    // Full text (kept for backward compat)
  transcriptType: string,                // "manual|auto-generated|yt-dlp"
  transcriptSegments: [                  // NEW
    { text: string, startMs: number, endMs: number }
  ],
  transcriptSource: string,              // NEW: "ytdlp|api|proxy|whisper"
  // ... other fields
}
```

---

## API Contract

### POST /api/videos (unchanged)
```typescript
{
  url: string;
  folderId?: string;
  bypassCache?: boolean;
  providers?: ProviderConfig;
}
```

> **Note:** No `browserTranscript` field - Phase 3 was removed due to CORS limitations.

---

## Configuration Settings

### Current (config.py)
```python
MAX_VIDEO_DURATION_MINUTES = 180
MIN_VIDEO_DURATION_SECONDS = 60
WEBSHARE_PROXY_USERNAME: str | None = None
WEBSHARE_PROXY_PASSWORD: str | None = None
```

### Adding in Phase 4
```python
WHISPER_ENABLED: bool = True
WHISPER_MAX_DURATION_MINUTES: int = 60
```

---

## Testing Notes

### Manual Testing Commands

**Test rate limiting:**
```bash
# Rapid requests to trigger 429
for i in {1..10}; do
  curl -X POST localhost:3000/api/videos \
    -H "Content-Type: application/json" \
    -d '{"url":"https://youtube.com/watch?v=dQw4w9WgXcQ"}' &
done
```

**Check MongoDB segments:**
```bash
mongosh vie --eval '
  db.videoSummaryCache.findOne(
    {transcriptSegments: {$exists: true}},
    {youtubeId: 1, transcriptSource: 1, "transcriptSegments": {$slice: 2}}
  )
'
```

**Test Whisper fallback:**
```bash
# Find a video without captions (music video usually)
# Check logs for "trying Whisper fallback"
docker logs vie-summarizer -f | grep -i whisper
```

---

## Related Documentation

- `TRANSCRIPT-SYSTEM-PLAN.md` - Original detailed plan (root dir)
- `docs/ERROR-HANDLING.md` - Error flow, user messages
- `docs/DATA-MODELS.md` - MongoDB schemas
- `docs/SERVICE-SUMMARIZER.md` - Summarizer architecture
- `CACHING-RESEARCH.md` - Cache strategy analysis

---

## Rollback Procedures

### Phase 1 Rollback
Remove `@tenacity.retry()` decorator from transcript.py

### Phase 2 Rollback
Code ignores `transcriptSegments` field if not present

### Phase 3 Rollback
N/A - Phase 3 was not implemented (CORS limitation)

### Phase 4 Rollback
Set `WHISPER_ENABLED = False` in config

---

## Contacts & Resources

### External APIs
- **YouTube Transcript API:** No API key needed
- **Webshare Proxy:** Credentials in `.env`
- **OpenAI Whisper:** Uses `OPENAI_API_KEY`

### Python Package
- `youtube-transcript-api`: https://pypi.org/project/youtube-transcript-api/
- `tenacity`: https://tenacity.readthedocs.io/
