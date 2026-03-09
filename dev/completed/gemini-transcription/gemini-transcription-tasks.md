# Gemini Transcription — Tasks

Last Updated: 2026-02-22

## Phase 1: Core Gemini Transcriber

- [x] Create `services/summarizer/src/services/gemini_transcriber.py`
  - [x] `_download_audio_raw_sync()` — yt-dlp download without FFmpeg conversion
  - [x] MIME type detection map (webm, m4a, ogg, mp3, opus, wav, flac)
  - [x] `_parse_gemini_response()` — handles markdown wrapping, malformed JSON
  - [x] `_get_gemini_model()` — strip `gemini/` prefix for google-genai SDK
  - [x] `transcribe_with_gemini()` — upload via google-genai SDK + generate_content with Part.from_uri + parse JSON
  - [x] Cleanup in `finally` block
  - [x] Error handling with TranscriptError

## Phase 2: Schema Update

- [x] Add `"gemini"` to `TranscriptSource` in `schemas.py:9`

## Phase 3: Pipeline Integration

- [x] Modify `fetch_transcript()` in `stream.py`
  - [x] Insert Gemini block before Whisper (conditional on GEMINI_API_KEY)
  - [x] Yield `audio_transcription` SSE phase
  - [x] Gemini timeout: `min(max(120, duration * 0.02 + 60), 300)`
  - [x] Fall through to Whisper on Gemini failure
  - [x] Separate `whisper_transcription` SSE phase when falling back

## Phase 4: Tests

- [x] Create `services/summarizer/tests/test_gemini_transcriber.py`
  - [x] `TestDownloadAudioRawSync` — 10 tests: no FFmpeg, UUID filenames, retries, backoff, .part filtering
  - [x] `TestTranscribeWithGemini` — 11 tests: mock genai.Client (upload/generate_content/delete), cleanup, error propagation
  - [x] `TestGeminiResponseParsing` — 12 tests: valid JSON, markdown wrapping, malformed JSON, edge cases
  - [x] `TestMimeTypeDetection` — 9 tests: all extensions + unknown default + coverage check

## Phase 5: Verification

- [x] Run new tests: 42 Gemini tests passed
- [x] Run existing Whisper tests: 40 Whisper tests passed (unchanged)
- [x] Total: 82 tests, 0 failures

## Phase 7: Production Bug Fix (LiteLLM → google-genai SDK)

- [x] Identified root cause: LiteLLM treats Gemini file URI as image URL → 403
- [x] Installed `google-genai>=1.0.0` dependency
- [x] Rewrote `transcribe_with_gemini()` to use `genai.Client` directly
- [x] Added `_get_gemini_model()` helper to strip `gemini/` prefix
- [x] Added uploaded file cleanup via `client.aio.files.delete()`
- [x] Rewrote `TestTranscribeWithGemini` to mock `genai.Client`
- [x] Updated `requirements.txt` with `google-genai>=1.0.0`
- [x] All 82 tests pass (42 Gemini + 40 Whisper)

## Phase 6: Playwright Layout Checks

- [x] Desktop (1280px): Layout clean, no overflow, sidebar + content side-by-side
- [x] Tablet (768px): Content reflows properly, sidebar visible, text wraps correctly
- [x] Mobile (375px): Sidebar overlay pattern, no horizontal scrollbar
- [x] Overflow scan: No body overflow at any viewport, minor article overflow (28px) from timeline dots (decorative, pre-existing)
- [x] Hierarchy check: No z-index conflicts, proper scroll isolation, sticky header works correctly
