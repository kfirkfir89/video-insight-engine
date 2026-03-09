# Transcript Storage System - Context

> **Last Updated:** 2026-02-05
> **Status:** COMPLETED - All 5 phases implemented

---

## Implementation Summary

All phases of transcript storage have been implemented:

1. **Phase 1**: TypeScript types + Python transcript slicer utility
2. **Phase 2**: LocalStack S3 infrastructure + async S3 client
3. **Phase 3**: Pipeline integration with transcript slicing per chapter
4. **Phase 4**: Regeneration endpoint for re-processing videos
5. **Phase 5**: Migration script for backfilling existing videos

---

## Key Files Modified

### TypeScript Types
| File | Changes |
|------|---------|
| `packages/types/src/index.ts` | Added `RawTranscript`, `GenerationMetadata` interfaces; Added `transcript?: string` to `SummaryChapter`; Added `rawTranscriptRef`, `generation` to `VideoSummary` |

### Python Summarizer Service
| File | Changes |
|------|---------|
| `services/summarizer/src/utils/transcript_slicer.py` | **NEW** - `slice_transcript_for_chapter()` function |
| `services/summarizer/src/services/s3_client.py` | **NEW** - Async S3 client with lazy initialization |
| `services/summarizer/src/services/transcript_store.py` | **NEW** - Business logic for transcript storage |
| `services/summarizer/src/routes/stream.py` | S3 storage call, transcript slicing in chapters, generation metadata, regeneration endpoint |
| `services/summarizer/src/repositories/mongodb_repository.py` | Saves `rawTranscriptRef`, `generation`, chapter `transcript` |
| `services/summarizer/src/config.py` | Added S3 config: `TRANSCRIPT_S3_BUCKET`, `AWS_*`, `PROMPT_VERSION` |
| `services/summarizer/requirements.txt` | Added `aioboto3>=12.0.0`, `botocore>=1.34.0` |
| `services/summarizer/tests/test_transcript_slicer.py` | **NEW** - Unit tests for slicer |
| `services/summarizer/scripts/backfill-transcripts.py` | **NEW** - Migration script |

### Infrastructure
| File | Changes |
|------|---------|
| `docker-compose.yml` | Added `vie-localstack` service, S3 env vars, scripts volume mount |
| `.env.example` | Added S3 configuration section |

---

## Key Decisions Made This Session

### Decision 1: Lazy S3 Initialization
**Problem:** Container failed to start because aioboto3 wasn't in Docker image
**Solution:** Made aioboto3 import lazy - only imported when first S3 operation is called
**File:** `services/summarizer/src/services/s3_client.py`
**Pattern:**
```python
_aioboto3_available: bool | None = None

def _check_aioboto3() -> bool:
    global _aioboto3_available
    if _aioboto3_available is None:
        try:
            import aioboto3
            _aioboto3_available = True
        except ImportError:
            _aioboto3_available = False
    return _aioboto3_available
```

### Decision 2: Graceful S3 Degradation
**Problem:** S3 failures shouldn't block video summarization
**Solution:** Wrap S3 calls in try/except, log warning, continue processing
**File:** `services/summarizer/src/routes/stream.py:815-833`
**Impact:** Videos can still be processed even if S3 is unavailable

### Decision 3: Regeneration via Status Reset
**Problem:** How to trigger re-processing without duplicating stream logic
**Solution:** Regeneration endpoint resets status to PENDING; client reconnects to streaming endpoint
**File:** `services/summarizer/src/routes/stream.py` (regeneration endpoint)

### Decision 4: Scripts Volume Mount
**Problem:** Migration script wasn't accessible in container
**Solution:** Added volume mount for scripts directory
**File:** `docker-compose.yml`
**Mount:** `./services/summarizer/scripts:/app/scripts:ro`

---

## Architecture Overview

```
YouTube Transcript
       │
       ▼
stream.py::stream_summarization()
       │
       ├─ normalize_segments() → list[dict]
       │
       ├─ transcript_store.store() → S3 key (non-blocking)
       │     │
       │     ▼
       │   s3_client.put_json()
       │     │
       │     ▼
       │   LocalStack/AWS S3
       │
       ├─ process_creator_chapters() or process_ai_chapters()
       │     │
       │     ├─ slice_transcript_for_chapter() per chapter
       │     │
       │     ├─ llm_service.summarize_chapter()
       │     │
       │     ▼
       │   chapter with transcript slice
       │
       ├─ build_result() with:
       │     - rawTranscriptRef (S3 key)
       │     - generation metadata
       │     - chapters with transcript field
       │
       ▼
mongodb_repository.save_result()
```

---

## Testing Commands

### Start Services
```bash
docker compose up -d vie-mongodb vie-localstack vie-summarizer
```

### Verify Health
```bash
curl -s http://localhost:8000/health | jq .
# Returns: { "status": "healthy", "s3": "unavailable" }
# (S3 shows unavailable until Docker image rebuilt with aioboto3)
```

### Test Transcript Slicer
```bash
docker exec vie-summarizer python -c "
from src.utils.transcript_slicer import slice_transcript_for_chapter
segments = [
    {'text': 'Hello', 'startMs': 0, 'endMs': 1000},
    {'text': 'World', 'startMs': 5000, 'endMs': 6000},
]
result = slice_transcript_for_chapter(segments, 0, 8)
print(f'Result: {result}')  # 'Hello World'
"
```

### Test Regeneration Endpoint
```bash
curl -s -X POST http://localhost:8000/regenerate/invalid123 \
  -H "Content-Type: application/json" \
  -d '{"force": false}' | jq .
# Returns: { "detail": "Invalid video summary ID format" }
```

### Run Migration (Dry Run)
```bash
docker exec vie-summarizer python /app/scripts/backfill-transcripts.py --dry-run
```

---

## Known Issues

### 1. aioboto3 Not in Docker Image
**Status:** Requirements.txt updated, image needs rebuild
**Impact:** S3 storage disabled until rebuild
**Fix:** `docker compose build vie-summarizer`

### 2. Pyright Type Errors
**Status:** Expected - local type checking doesn't have packages installed
**Impact:** No runtime impact, just IDE warnings
**Examples:**
- `list[TranscriptSegment]` vs `list[dict]` covariance
- Missing module imports for aioboto3, pymongo

### 3. Tests Not Mounted in Container
**Status:** Tests directory not in volume mounts
**Impact:** Can't run pytest inside container
**Workaround:** Run tests locally or add volume mount

---

## Resume Instructions

To continue work on this task after context reset:

1. **Read task docs:**
   ```
   /resume transcript-storage
   ```

2. **Check current state:**
   ```bash
   curl http://localhost:8000/health
   docker logs vie-summarizer 2>&1 | tail -20
   ```

3. **Remaining work:**
   - Rebuild Docker image: `docker compose build vie-summarizer`
   - Update documentation (DATA-MODELS.md, SERVICE-SUMMARIZER.md)
   - Run full E2E test with actual video

4. **Key files to review:**
   - `services/summarizer/src/routes/stream.py` - Main pipeline
   - `services/summarizer/src/services/s3_client.py` - S3 integration
   - `services/summarizer/src/services/transcript_store.py` - Storage logic

---

## Data Flow Reference

### New Video Processing
```
1. POST /summarize → creates videoSummaryCache entry
2. GET /summarize/stream/{id} → connects to SSE
3. stream_summarization():
   a. fetch_transcript() → YouTube/yt-dlp
   b. normalize_segments() → millisecond format
   c. transcript_store.store() → S3 (optional)
   d. process_chapters() → slice + LLM summarize
   e. build_result() → includes rawTranscriptRef, generation
   f. save_result() → MongoDB with all fields
```

### Regeneration Flow
```
1. POST /regenerate/{id} → checks S3, resets status to PENDING
2. GET /summarize/stream/{id} → re-runs pipeline
3. Pipeline uses same logic, may use stored transcript
```

### Migration Flow
```
1. python backfill-transcripts.py --dry-run → preview
2. python backfill-transcripts.py → actual migration
3. For each video without rawTranscriptRef:
   a. Read transcriptSegments from MongoDB
   b. Store to S3
   c. Update MongoDB with rawTranscriptRef
```

---

## Configuration Reference

### Environment Variables (S3)
```bash
TRANSCRIPT_S3_BUCKET=vie-transcripts
AWS_REGION=us-east-1
AWS_ENDPOINT_URL=http://vie-localstack:4566  # LocalStack
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
```

### Config Class (Python)
```python
# services/summarizer/src/config.py
TRANSCRIPT_S3_BUCKET: str = "vie-transcripts"
AWS_REGION: str = "us-east-1"
AWS_ENDPOINT_URL: str | None = None
AWS_ACCESS_KEY_ID: str | None = None
AWS_SECRET_ACCESS_KEY: str | None = None
PROMPT_VERSION: str = "v1.0"
```

---

## MongoDB Schema Updates

### New Fields in videoSummaryCache
```javascript
{
  // ... existing fields ...

  // NEW: S3 reference for raw transcript
  rawTranscriptRef: "transcripts/abc123.json" | null,

  // NEW: Generation metadata
  generation: {
    model: "anthropic/claude-sonnet-4-20250514",
    promptVersion: "v1.0",
    generatedAt: "2026-02-05T10:30:00Z"
  } | null,

  // UPDATED: Chapters now include transcript
  summary: {
    chapters: [{
      // ... existing fields ...
      transcript: "Sliced transcript text for this chapter..."
    }]
  }
}
```
