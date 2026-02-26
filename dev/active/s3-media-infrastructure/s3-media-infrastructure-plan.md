# S3 Media Infrastructure — Implementation Plan

**Last Updated: 2026-02-25**
**Status: Planning**
**Branch: `feat/s3-media-infrastructure`**

---

## Executive Summary

Replace the local Docker volume frame storage with a unified S3 bucket (`vie-transcripts`). Frames currently write to a mounted volume and are served via FastAPI's StaticFiles — this breaks on container replacement and doesn't scale. The new architecture stores all video media (frames, transcripts, future audio) in S3 with presigned URLs for access.

Phase 1 (this task) delivers: S3 frame upload pipeline, presigned URL generation, transcript key migration, and removal of the local StaticFiles infrastructure. MinIO was removed in favor of direct AWS S3 usage.

---

## Current State Analysis

### What Exists Today

| Component | File | Current Behavior |
|-----------|------|-----------------|
| S3 Client | `services/summarizer/src/services/s3_client.py` | Only `put_json()`, `get_json()`, `exists()`, `delete()`. Uses `TRANSCRIPT_S3_BUCKET` ("vie-transcripts"). No binary upload. No presigned URLs. |
| Frame Extractor | `services/summarizer/src/services/frame_extractor.py` | Extracts frames to `FRAMES_DIR` (local path), sets `imageUrl` to `FRAMES_BASE_URL/{youtube_id}/{ts}.jpg`. Uses `Path` objects for disk I/O. |
| Config | `services/summarizer/src/config.py` | `FRAMES_DIR=/app/data/frames`, `FRAMES_BASE_URL=http://localhost:8000/frames`, `TRANSCRIPT_S3_BUCKET=vie-transcripts`. |
| Main | `services/summarizer/src/main.py` | Mounts `StaticFiles(directory=frames_dir)` at `/frames` in lifespan. Creates `frames_dir` on startup. |
| Transcript Store | `services/summarizer/src/services/transcript_store.py` | Keys: `transcripts/{youtube_id}.json`. No fallback paths. |
| Docker Compose | `docker-compose.yml` | `summarizer_frames` volume mounted at `/app/data/frames`. No MinIO. No S3 env vars for frames. |
| Cached Results | `services/summarizer/src/routes/stream.py:1414` | `_stream_cached_result()` emits chapters as-is — no URL refresh. Old `imageUrl` values (localhost) remain stale. |
| Chapter Pipeline | `services/summarizer/src/services/chapter_pipeline.py:211` | Calls `extract_frames_for_blocks()` which writes to local disk. |

### Key Pain Points

1. **Non-durable frames** — Docker volume lost on container replacement
2. **Localhost URLs** — `FRAMES_BASE_URL` is `http://localhost:8000/frames`, breaks in production
3. **No presigned URLs** — No auth mechanism for serving images
4. **No binary upload** — S3 client only supports JSON
5. **Stale cached URLs** — Cached summaries have old `imageUrl` values forever

---

## Proposed Future State

```
vie-transcripts (S3 bucket)
└── videos/{youtube_id}/
    ├── transcript.json       ← processed transcript
    └── frames/
        └── {timestamp}.jpg   ← extracted video frames
```

- Frames upload to S3 via `put_bytes()` (parallel with `asyncio.gather`)
- Presigned URLs generated at response time (sync — local signing)
- Blocks store `s3_key` in MongoDB (permanent), `imageUrl` is ephemeral
- Cached results refresh presigned URLs via `_refresh_frame_urls()`
- Transcript keys migrate to `videos/{id}/transcript.json` with fallback

---

## Implementation Phases

### Phase 1: Core S3 Frame Storage (this task)

8 sub-tasks across 5 files (modify) + 2 new files + docker-compose changes.

### Phase 2: Shared Package + Thumbnails (future)

Extract S3 client to `packages/s3-media/` when second service needs it.

### Phase 3: API Integration — Presigned URLs for auth users, proxy for shared links (future)

### Phase 4: Admin Tooling — Orphan cleanup, S3 stats (future)

---

## Phase 1 — Detailed Implementation

### Section 1: S3 Client Extensions

**File:** `services/summarizer/src/services/s3_client.py`
**Effort:** M

#### 1.1 Add `put_bytes()` method
- Mirrors `put_json()` pattern with same `@retry` decorator
- Signature: `async def put_bytes(self, key: str, data: bytes, content_type: str = "application/octet-stream") -> None`
- Uses `put_object` with `Body=data, ContentType=content_type`
- No ACL param (bucket is private)

#### 1.2 Add `generate_presigned_url()` method
- **Sync method** (no network call — boto3 presigning is local cryptographic operation)
- Uses sync `boto3` client (not aioboto3) for signing
- Default expiry from `settings.S3_PRESIGNED_URL_EXPIRY` (1 hour)
- Signature: `def generate_presigned_url(self, key: str, expires_in: int | None = None) -> str`

#### 1.3 Add `get_dev_url()` method
- Direct URL for MinIO dev only: `f"{endpoint}/{bucket}/{key}"`
- Warns/raises if no `AWS_ENDPOINT_URL` set (not for production)
- Signature: `def get_dev_url(self, key: str) -> str`

#### 1.4 Update bucket reference
- `self._bucket = settings.effective_s3_bucket` (uses new property)

**Acceptance Criteria:**
- `put_bytes()` uploads binary data with retry
- `generate_presigned_url()` returns valid signed URL
- `get_dev_url()` works with MinIO, warns without endpoint
- All existing tests still pass

### Section 2: Config Updates

**File:** `services/summarizer/src/config.py`
**Effort:** S

#### 2.1 Add new settings
- `S3_BUCKET: str = "vie-transcripts"` — unified bucket (reuses existing AWS bucket)
- `S3_PRESIGNED_URL_EXPIRY: int = 3600` — 1 hour default

#### 2.2 Add `effective_s3_bucket` property
- Returns `TRANSCRIPT_S3_BUCKET` if set to non-default, else `S3_BUCKET`
- Backward compat: existing `TRANSCRIPT_S3_BUCKET` env var still works

#### 2.3 Remove `FRAMES_BASE_URL`
- Mark `FRAMES_DIR` as deprecated (still used in transition)
- Remove `FRAMES_BASE_URL` setting
- Remove `model_post_init` localhost warning (no longer relevant)

**Acceptance Criteria:**
- `settings.effective_s3_bucket` returns correct bucket
- `TRANSCRIPT_S3_BUCKET` env var still works for backward compat
- `FRAMES_BASE_URL` removed from config

### Section 3: Frame Extractor Refactor

**File:** `services/summarizer/src/services/frame_extractor.py`
**Effort:** L

#### 3.1 Extract frames to temp files (Stage 1)
- Replace `Path`-based local disk I/O with `tempfile.NamedTemporaryFile`
- `try/finally` guarantees cleanup even on crash
- Returns `(timestamp, bytes | None)` per frame
- Check S3 exists first (cache hit → skip extraction)

#### 3.2 Upload frames to S3 (Stage 2)
- Parallel upload via `asyncio.gather`
- S3 key pattern: `videos/{youtube_id}/frames/{timestamp}.jpg`
- Returns `s3_key | None` per frame
- Partial failure: log warning, return `None`

#### 3.3 Update `extract_frames_for_blocks()` orchestrator
- Two-stage pipeline: extract all → upload all (both parallel)
- Generate presigned URLs for successful uploads (sync)
- Set both `s3_key` (permanent, for MongoDB) and `imageUrl` (ephemeral, for SSE)
- Failed frames get `s3_key: null`, frontend handles gracefully

#### 3.4 Remove all `Path`/`FRAMES_DIR`/`FRAMES_BASE_URL` references
- No more local disk I/O
- Import S3 client and config

**Acceptance Criteria:**
- Frames upload to S3 in parallel
- S3 exists check skips already-extracted frames
- Temp files cleaned up on success and failure
- Partial failure doesn't break pipeline
- `s3_key` and `imageUrl` set on blocks

### Section 4: Transcript Store Migration

**File:** `services/summarizer/src/services/transcript_store.py`
**Effort:** S

#### 4.1 New key pattern
- `_get_key()` returns `videos/{youtube_id}/transcript.json`
- `_get_legacy_key()` returns `transcripts/{youtube_id}.json`

#### 4.2 Backward-compatible reads
- `get()` tries new path first, falls back to legacy path
- `get_by_ref()` unchanged (reads exact ref from MongoDB)

#### 4.3 Writes to new path
- `store()` writes to `videos/{youtube_id}/transcript.json`
- Returns new key

**Acceptance Criteria:**
- New transcripts stored at `videos/{id}/transcript.json`
- Old transcripts readable via fallback
- `get_by_ref()` still works with old keys in MongoDB

### Section 5: Remove Local Frame Infrastructure

**File:** `services/summarizer/src/main.py`
**Effort:** S

#### 5.1 Remove StaticFiles mount
- Remove `StaticFiles` import
- Remove `frames_dir` creation in lifespan
- Remove `app.mount("/frames", ...)` line
- Keep `check_frame_deps()` call (ffmpeg/yt-dlp still needed)

#### 5.2 Remove `Path` import
- Only if no other usage remains

**Acceptance Criteria:**
- No `/frames` endpoint
- Startup still checks ffmpeg/yt-dlp
- Health check still works

### Section 6: Presigned URLs for Cached Summaries

**File:** `services/summarizer/src/routes/stream.py`
**Effort:** S

#### 6.1 Add `_refresh_frame_urls()` helper
- Sync function (presigned URL generation is local signing)
- Iterates chapters → blocks, refreshes `imageUrl` from `s3_key`
- Skips blocks without `s3_key`

#### 6.2 Call in `_stream_cached_result()`
- Before emitting chapter events (line ~1440)
- Refresh all chapter blocks' presigned URLs

**Acceptance Criteria:**
- Cached summaries serve fresh presigned URLs
- Blocks without `s3_key` are unchanged
- No network calls during URL refresh

### Section 7: Docker Compose — MinIO

**File:** `docker-compose.yml`
**Effort:** M

#### 7.1 ~~Add MinIO service~~ (REMOVED — uses AWS S3 directly)

#### 7.3 Update `vie-summarizer`
- Remove `summarizer_frames` volume mount
- Add S3 env vars: `S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_PRESIGNED_URL_EXPIRY`
- Remove `FRAMES_BASE_URL`, `AWS_ENDPOINT_URL`, `TRANSCRIPT_S3_BUCKET` env vars
- Remove depends_on: `vie-minio-init`

#### 7.4 Update volumes section
- Remove `summarizer_frames`
- Remove `vie_minio_data`

**Acceptance Criteria:**
- `docker-compose up` starts without MinIO
- Summarizer connects to AWS S3 directly

### Section 8: Migration Script

**File:** `scripts/migrate-s3-keys.py` (new)
**Effort:** M

#### 8.1 Idempotent migration
- Find MongoDB docs with `rawTranscriptRef` starting with `transcripts/`
- Check if new key exists in S3 → skip if yes
- Copy S3 object to new path
- Update MongoDB `rawTranscriptRef`

#### 8.2 CLI flags
- `--dry-run`: preview only
- `--batch-size N`: control parallelism
- `--delete-old`: remove old keys after copy

#### 8.3 Logging and summary
- Log each: `Migrated {id}` or `Skipped {id}: already migrated`
- Summary: `Migrated: N, Skipped: N, Failed: N`

**Acceptance Criteria:**
- Safe to run multiple times (idempotent)
- `--dry-run` makes no changes
- Summary printed at end

### Section 9: Update `.env.example`

**File:** `.env.example`
**Effort:** S

#### 9.1 Add S3 media bucket config
- `S3_BUCKET=vie-transcripts`
- `S3_PRESIGNED_URL_EXPIRY=3600`
- Update MinIO local dev example

#### 9.2 Update comments
- Replace "Transcript Storage" header with "S3 Media Storage"
- Document MinIO usage for local dev

**Acceptance Criteria:**
- `.env.example` documents all new env vars
- Clear instructions for local dev with MinIO

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| ~~MinIO incompatible with boto3 presigning~~ | ~~High~~ | Removed — using AWS S3 directly. |
| Existing cached summaries have localhost `imageUrl` | Medium | `_refresh_frame_urls()` regenerates from `s3_key`. Old entries without `s3_key` show placeholder (frontend already handles). |
| S3 upload latency adds to summarization time | Medium | Parallel uploads with `asyncio.gather`. S3 exists check skips duplicates. |
| ~~`TRANSCRIPT_S3_BUCKET` env var in production~~ | ~~Low~~ | Removed — consolidated to `S3_BUCKET=vie-transcripts`. |
| Frame extraction temp files leak on crash | Low | `try/finally` with `os.unlink()` guarantees cleanup. |

---

## Success Metrics

1. **Functional:** Summarize a video → frames appear in MinIO under `videos/{id}/frames/`
2. **Cached:** Load cached summary → images load from fresh presigned URLs
3. **Idempotent:** Re-summarize same video → S3 exists check skips frame extraction
4. **Health:** `/health` returns `s3: healthy, bucket: vie-transcripts`
5. **Migration:** `migrate-s3-keys.py --dry-run` shows expected operations
6. **No regression:** All existing tests pass

---

## Dependencies

| Dependency | Type | Status |
|-----------|------|--------|
| aioboto3 | Python package | Already installed |
| boto3 | Python package | Needed for sync presigning (check if aioboto3 includes it) |
| ~~MinIO Docker image~~ | ~~Infrastructure~~ | Removed — using AWS S3 directly |
| ~~MinIO Client (mc)~~ | ~~Infrastructure~~ | Removed — using AWS S3 directly |
| ffmpeg + yt-dlp | System tools | Already in Docker image |

---

## Files Changed Summary

| File | Action | Lines Est. |
|------|--------|-----------|
| `services/summarizer/src/services/s3_client.py` | Modify | +80 |
| `services/summarizer/src/config.py` | Modify | +10, -10 |
| `services/summarizer/src/services/frame_extractor.py` | Modify (major) | +100, -50 |
| `services/summarizer/src/services/transcript_store.py` | Modify | +15, -5 |
| `services/summarizer/src/main.py` | Modify | -5 |
| `services/summarizer/src/routes/stream.py` | Modify | +20 |
| `docker-compose.yml` | Modify | +40, -5 |
| `.env.example` | Modify | +15, -5 |
| `scripts/migrate-s3-keys.py` | Create | ~120 |
| Tests (various) | Create/Modify | ~200 |

**Total estimated: ~450 new/modified lines + ~200 test lines**
