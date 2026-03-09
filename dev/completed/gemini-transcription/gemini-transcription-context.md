# Gemini Transcription — Context

Last Updated: 2026-02-22

## Status: COMPLETE (post-production fix)

All 5 phases done. Production bug found and fixed: LiteLLM file API doesn't work
with Gemini — rewrote to use `google-genai` SDK directly. All tests pass.

## Critical Decision: LiteLLM → google-genai SDK

**Problem:** LiteLLM's `acreate_file` uploads to Gemini successfully, but `acompletion`
treats the returned file URI as an image URL and tries to HTTP-fetch it → 403 error.
This was discovered in production.

**Fix:** Replaced LiteLLM file operations with `google-genai` SDK:
- `client.aio.files.upload()` for file upload
- `client.aio.models.generate_content()` with `Part.from_uri()` for transcription
- `client.aio.files.delete()` for cleanup

**Why not LiteLLM:** LiteLLM's file reference abstraction doesn't support Gemini's
native file URI scheme. The google-genai SDK handles this natively.

## Files Changed

| File | Action | What Changed |
|------|--------|-------------|
| `services/summarizer/src/services/gemini_transcriber.py` | **New** | 340 lines — download raw audio, upload via google-genai SDK, transcribe, parse JSON segments |
| `services/summarizer/src/routes/stream.py` | **Modified** | Inserted Gemini before Whisper in `fetch_transcript()`, new `audio_transcription` SSE phase |
| `services/summarizer/src/models/schemas.py` | **Modified** | Added `"gemini"` to `TranscriptSource` literal |
| `services/summarizer/tests/test_gemini_transcriber.py` | **New** | 42 tests across 4 test classes |
| `services/summarizer/requirements.txt` | **Modified** | Added `google-genai>=1.0.0` |

## Files NOT Changed (as planned)

- `whisper_transcriber.py` — untouched, remains as fallback
- `config.py` — already has `GEMINI_API_KEY`

## Key Implementation Details

### gemini_transcriber.py
- `_download_audio_raw_sync()` — yt-dlp with NO FFmpegExtractAudio postprocessor, keeps raw webm/m4a/ogg
- `_get_mime_type()` — maps 7 audio extensions to MIME types
- `_parse_gemini_response()` — strips markdown code blocks, finds JSON array boundaries, validates segments
- `_get_gemini_model()` — strips `gemini/` prefix from LiteLLM model name for google-genai SDK
- `transcribe_with_gemini()` — full async workflow: download → upload via `genai.Client.aio.files.upload()` → transcribe via `genai.Client.aio.models.generate_content()` with `Part.from_uri()` → parse → delete uploaded file → cleanup local file

### stream.py Integration
- Gemini inserted at line ~216 in `fetch_transcript()`, before Whisper
- Conditional on `settings.GEMINI_API_KEY` being set
- Timeout: `min(max(120, duration * 0.02 + 60), 300)` — 2-5 min range
- On any Gemini failure, logs warning and falls through to Whisper

### New Fallback Chain
1. S3 cached transcript
2. yt-dlp subtitles
3. youtube-transcript-api
4. **Gemini Flash** (new — 30-90s, ~$0.04/26min video)
5. **Whisper** (existing — 5-15min, ~$0.16/26min video)

## Test Results

- 42 Gemini tests: ALL PASSED
- 40 Whisper tests: ALL PASSED (unchanged)
- Total: 82 tests, 0 failures

## Playwright Layout Verification

- Desktop (1280px): Clean, no overflow
- Tablet (768px): Proper reflow
- Mobile (375px): Sidebar overlay, no horizontal scrollbar
- No z-index conflicts, proper scroll isolation
