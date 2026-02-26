# S3 Media Infrastructure — Context

**Last Updated: 2026-02-25**

---

## Key Files

### Primary (modify)
| File | Purpose | Key Details |
|------|---------|-------------|
| `services/summarizer/src/services/s3_client.py` | S3 client singleton | Has `put_json()`, `get_json()`, `exists()`, `delete()`, `health_check()`. Uses `settings.S3_BUCKET`. Lazy aioboto3 session. `@retry` decorator on put/get. |
| `services/summarizer/src/services/frame_extractor.py` | Frame extraction pipeline | `extract_frames_for_blocks()` is the main entry. Uses `Path` + local disk. Parallel ffmpeg via `asyncio.gather`. Stream URL cache with TTL. `extract_frame()` writes to `output_path: Path`. |
| `services/summarizer/src/config.py` | Pydantic settings | `FRAMES_DIR`, `S3_BUCKET`, `FRAME_EXTRACTION_ENABLED`. |
| `services/summarizer/src/main.py` | FastAPI app | Lines 31-34: creates frames_dir, mounts StaticFiles at `/frames`. Lifespan manager. |
| `services/summarizer/src/services/transcript_store.py` | Transcript CRUD | `_get_key()` returns `transcripts/{youtube_id}.json`. Wraps `s3_client`. |
| `services/summarizer/src/routes/stream.py` | SSE streaming | `_stream_cached_result()` at line 1414 streams chapters without URL refresh. Imports `clear_stream_url_cache` from frame_extractor. |
| `docker-compose.yml` | Docker services | No MinIO. S3 env vars for AWS. |
| `.env.example` | Env var docs | Has S3 config section for transcripts only. |

### Secondary (read for context)
| File | Purpose | Key Details |
|------|---------|-------------|
| `services/summarizer/src/services/chapter_pipeline.py` | Chapter post-processing | `postprocess_chapter()` at line 171 calls `extract_frames_for_blocks()`. This is the integration point. |
| `services/summarizer/src/utils/constants.py` | Constants | `YOUTUBE_ID_RE` regex for ID validation. |
| `services/summarizer/src/services/block_postprocessing.py` | Block post-processing | May reference visual blocks/imageUrl. |

### New files
| File | Purpose |
|------|---------|
| `scripts/migrate-s3-keys.py` | One-time migration script for transcript S3 keys |

---

## Architecture Decisions

### 1. Single Bucket Per Environment
**Decision:** Use `vie-transcripts` (existing AWS bucket) instead of separate buckets per data type.
**Why:** Simpler ops, per-video folder isolation, easier backup/restore.
**Trade-off:** Can't set different lifecycle rules per object type (acceptable for now).

### 2. Presigned URLs (not public bucket)
**Decision:** All access via presigned URLs. Bucket fully private.
**Why:** Security. No public access, time-limited URLs, can revoke access.
**Trade-off:** URLs expire (1h default), need refresh on cached results.

### 3. `s3_key` in MongoDB, not full URL
**Decision:** Store `s3_key` ("videos/abc/frames/25.jpg") not full URL.
**Why:** URLs change (endpoint, presigning). Key is permanent. Generate URL at response time.
**Trade-off:** Extra sync operation per visual block on response (but it's local signing, ~0ms).

### 4. ~~MinIO for Dev~~ (REMOVED)
**Decision:** Removed MinIO. Uses AWS S3 directly. `AWS_ENDPOINT_URL` kept optional for CI/CD testing with MinIO or LocalStack if needed.

### 5. Parallel Extract → Parallel Upload (Two Stages)
**Decision:** Don't upload each frame as it's extracted. Extract all first, then upload all.
**Why:** Simpler error handling. Can report partial extraction vs partial upload separately. Temp file cleanup is cleaner.
**Trade-off:** Slight peak memory increase (all frame bytes in memory briefly).

### 6. Sync Presigned URLs
**Decision:** `generate_presigned_url()` is sync, not async.
**Why:** boto3 presigning is a local cryptographic operation (HMAC-SHA256). No network call. Making it async would be misleading.

---

## Dependencies Between Tasks

```
Section 2 (Config) ──────────────────────┐
                                          ├──→ Section 1 (S3 Client) ──→ Section 3 (Frame Extractor)
Section 7 (Docker/MinIO) ────────────────┘                               │
                                                                         ├──→ Section 5 (Remove StaticFiles)
Section 4 (Transcript Store) ←── Section 1                               │
                                                                         └──→ Section 6 (Cached URL Refresh)
Section 8 (Migration Script) ←── Section 1, Section 4
Section 9 (.env.example) ←── Section 2, Section 7
```

**Critical path:** Config → S3 Client → Frame Extractor → Remove StaticFiles

**Can be parallelized:**
- Docker/MinIO (Section 7) and Config (Section 2) can start simultaneously
- Migration Script (Section 8) after S3 Client + Transcript Store done
- Cached URL Refresh (Section 6) after S3 Client done

---

## Existing Tests to Update

| Test File | What Changes |
|-----------|-------------|
| `services/summarizer/tests/test_frame_extractor.py` | Entire file — currently tests local disk I/O. Must mock S3 client instead. |
| `services/summarizer/tests/test_stream_routes.py` | May reference `FRAMES_BASE_URL` or frame URLs. |
| `services/summarizer/tests/test_youtube_service.py` | Shouldn't need changes (YouTube API, not frames). |

## New Tests Needed

| Test | Purpose |
|------|---------|
| `test_s3_client_put_bytes` | Verify binary upload with retry |
| `test_s3_client_presigned_url` | Verify presigned URL generation |
| `test_s3_client_dev_url` | Verify MinIO direct URL |
| `test_frame_extractor_s3` | Full pipeline: extract → upload → s3_key set |
| `test_frame_extractor_partial_failure` | Some frames fail, rest succeed |
| `test_frame_extractor_s3_exists_skip` | Cache hit skips extraction |
| `test_transcript_store_fallback` | Legacy key fallback works |
| `test_refresh_frame_urls` | Cached result URL refresh |
| `test_migrate_s3_keys` | Migration script (dry-run, normal, idempotent) |

---

## Environment Variables

### New
| Variable | Default | Purpose |
|----------|---------|---------|
| `S3_BUCKET` | `vie-transcripts` | Unified media bucket name (reuses existing AWS bucket) |
| `S3_PRESIGNED_URL_EXPIRY` | `3600` | Presigned URL validity (seconds) |

### Modified
| Variable | Old Default | New Default | Notes |
|----------|-------------|-------------|-------|
| `TRANSCRIPT_S3_BUCKET` | — | — | Removed — consolidated into `S3_BUCKET` |
| `AWS_ENDPOINT_URL` | _(empty)_ | _(empty)_ | Optional: custom endpoint for CI/CD testing |

### Removed
| Variable | Reason |
|----------|--------|
| `FRAMES_BASE_URL` | Replaced by presigned URLs |

### Kept
| Variable | Reason |
|----------|--------|
| `FRAMES_DIR` | Deprecated but harmless, remove in Phase 2 |
| `FRAME_EXTRACTION_ENABLED` | Still controls whether extraction runs |

---

## Important Gotchas

1. **aioboto3 includes boto3** — No need to add boto3 separately. `import boto3` works when aioboto3 is installed.

2. **~~MinIO presigned URLs~~** — MinIO removed. Using AWS S3 directly. `AWS_ENDPOINT_URL` kept for optional CI/CD testing.

3. **Existing MongoDB `imageUrl` fields** — Old summaries have `"imageUrl": "http://localhost:8000/frames/..."`. These won't have `s3_key`. `_refresh_frame_urls()` only refreshes blocks WITH `s3_key`, so old entries stay as-is. Frontend VisualBlock already handles broken images with placeholder.

4. **Docker networking** — No MinIO container needed. Summarizer connects to AWS S3 directly using credentials from env vars.

5. **`ensure_bucket_exists()`** — The S3 client has `ensure_bucket_exists()` for CI/CD testing with LocalStack. Not needed for production (bucket already exists in AWS).
