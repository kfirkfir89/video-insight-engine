# S3 Media Infrastructure — Task Checklist

**Last Updated: 2026-02-25**
**Status: Complete**

---

## Prerequisites

- [x] Verify `aioboto3` includes `boto3` (for sync presigning)
- [x] Read current test files for frame extractor

---

## Section 1: S3 Client Extensions [Effort: M] ✅

**File:** `services/summarizer/src/services/s3_client.py`

- [x] 1.1 Add `put_bytes()` method with `@retry` decorator
- [x] 1.2 Add `generate_presigned_url()` sync method
- [x] 1.3 Add `get_dev_url()` method
- [x] 1.4 Update `self._bucket` to use `settings.S3_BUCKET`
- [x] 1.5 Tests: 7 passing (`test_s3_client.py`)

---

## Section 2: Config Updates [Effort: S] ✅

**File:** `services/summarizer/src/config.py`

- [x] 2.1 Add `S3_BUCKET: str = "vie-transcripts"` setting
- [x] 2.2 Add `S3_PRESIGNED_URL_EXPIRY: int = 3600` setting
- [x] 2.3 ~~Add `effective_s3_bucket` property~~ (removed — no longer needed)
- [x] 2.4 Remove `FRAMES_BASE_URL` setting
- [x] 2.5 Mark `FRAMES_DIR` with deprecation comment
- [x] 2.6 Remove `model_post_init` (no more localhost warning)
- [x] 2.7 Update S3 config section comment to "S3 Media Storage"

---

## Section 3: Frame Extractor Refactor [Effort: L] ✅

**File:** `services/summarizer/src/services/frame_extractor.py`

- [x] 3.1 Add S3 client import and `_frame_s3_key()` helper
- [x] 3.2 Refactor `extract_frame()` to use temp files → returns bytes
- [x] 3.3 Add `_upload_frame()` async helper
- [x] 3.4 Two-stage pipeline: extract → upload → presign
- [x] 3.5 S3 exists check (cache hit → skip extraction)
- [x] 3.6 Remove all `Path`/`FRAMES_DIR`/`FRAMES_BASE_URL` references
- [x] 3.7 Tests: 19 passing (`test_frame_extractor.py`)

---

## Section 4: Transcript Store Migration [Effort: S] ✅

**File:** `services/summarizer/src/services/transcript_store.py`

- [x] 4.1 Add `_get_legacy_key()` → `transcripts/{youtube_id}.json`
- [x] 4.2 Update `_get_key()` → `videos/{youtube_id}/transcript.json`
- [x] 4.3 Update `get()` with fallback: try new key, then legacy key
- [x] 4.4 `store()` writes to new key path
- [x] 4.5 Tests: 8 passing (`test_transcript_store.py`)

---

## Section 5: Remove Local Frame Infrastructure [Effort: S] ✅

**File:** `services/summarizer/src/main.py`

- [x] 5.1 Remove `StaticFiles` import
- [x] 5.2 Remove `frames_dir` creation in lifespan
- [x] 5.3 Remove `app.mount("/frames", ...)` line
- [x] 5.4 Remove `Path` import
- [x] 5.5 Keep `check_frame_deps()` call

---

## Section 6: Presigned URLs for Cached Summaries [Effort: S] ✅

**File:** `services/summarizer/src/routes/stream.py`

- [x] 6.1 Add `_refresh_frame_urls()` sync helper
- [x] 6.2 Call in `_stream_cached_result()` before emitting chapters
- [x] 6.3 Tests: 5 passing (`test_refresh_frame_urls.py`)

---

## Section 7: Docker Compose — MinIO [Effort: M] ✅

**File:** `docker-compose.yml`

- [x] 7.1 ~~Add `vie-minio` service~~ (removed — uses AWS S3 directly)
- [x] 7.2 ~~Add `vie-minio-init` container~~ (removed)
- [x] 7.3 Update `vie-summarizer` (S3 env vars, remove MinIO deps)
- [x] 7.4 Update volumes (remove `summarizer_frames`, remove `vie_minio_data`)

---

## Section 8: Migration Script [Effort: M] ✅

**File:** `scripts/migrate-s3-keys.py` (new)

- [x] 8.1 CLI args: `--dry-run`, `--batch-size`, `--delete-old`, `--mongodb-uri`, `--s3-bucket`
- [x] 8.2 Idempotent migration logic
- [x] 8.3 Summary logging

---

## Section 9: Update .env.example [Effort: S] ✅

**File:** `.env.example`

- [x] 9.1 Add `S3_BUCKET=vie-transcripts`
- [x] 9.2 Add `S3_PRESIGNED_URL_EXPIRY=3600`
- [x] 9.3 Update section header and MinIO docs
- [x] 9.4 Remove `TRANSCRIPT_S3_BUCKET` and MinIO section

---

## Test Results (verified 2026-02-25)

- **51 new tests passing** (0 failures)
- **657/671 summarizer tests passing** (14 pre-existing failures, confirmed identical on clean tree)
- **1178/1178 web unit tests passing**
- No regressions introduced

---

## Integration Testing (manual — requires docker-compose)

- [ ] 10.1 `docker-compose up -d` — all services start (no MinIO)
- [ ] 10.2 Summarize a video — check AWS S3 for frames
- [ ] 10.3 Frontend: visual block images load
- [ ] 10.4 Load cached summary: presigned URLs regenerated
- [ ] 10.5 `/health` endpoint: S3 status shows `healthy`
