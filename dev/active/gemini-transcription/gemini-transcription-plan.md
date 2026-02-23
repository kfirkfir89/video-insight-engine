# Replace Whisper with Gemini Flash Transcription

Last Updated: 2026-02-22

## Executive Summary

Replace the slow OpenAI Whisper audio transcription fallback with Gemini Flash via LiteLLM. Whisper requires downloading audio, converting webm->mp3 (ffmpeg), chunking large files (pydub), and uploading sequentially — taking 5-15 minutes for a 26-minute video. Gemini Flash accepts raw audio natively (no conversion), handles up to 9.5 hours per request (no chunking), and is already configured in this project via LiteLLM + `GEMINI_API_KEY`. Zero new dependencies, zero new API keys.

**Cost comparison (26-min video):**

| Provider | Cost | Speed |
|----------|------|-------|
| OpenAI Whisper | ~$0.16 | 5-15 min |
| Gemini Flash | ~$0.04 | 30-90 sec |

## Current State Analysis

### Transcript Fallback Chain (stream.py `fetch_transcript`)
1. S3 cached transcript
2. yt-dlp subtitles
3. youtube-transcript-api
4. **Whisper** (current last resort)

### Whisper Bottlenecks (whisper_transcriber.py)
- `_download_audio_sync`: Downloads audio + **converts to MP3** via FFmpegExtractAudio
- `_split_audio_chunks`: Splits files > 24MB using pydub (Whisper API 25MB limit)
- `_transcribe_sync` / `_transcribe_chunked_sync`: Sequential API calls per chunk
- Timeout: 5-15 min (`min(max(300, duration * 0.055 + 120), 900)`)

### What Already Exists
- `GEMINI_API_KEY` in `config.py:44` (already an env var)
- `settings.llm_fast_model` returns `gemini/gemini-2.5-flash-lite` when Gemini is the fast provider
- LiteLLM already installed and used throughout the service
- `_classify_download_error` helper in `whisper_transcriber.py:43` (reusable)
- `NormalizedTranscript`, `TranscriptSegment` models in `schemas.py`
- `TranscriptError` exception in `exceptions.py`

## Proposed Future State

### New Fallback Chain
1. S3 cached transcript
2. yt-dlp subtitles
3. youtube-transcript-api
4. **Gemini Flash** (new, fast — 30-90s)
5. **Whisper** (existing, unchanged — fallback for Gemini failures)

### Architecture
```
fetch_transcript()
  └─ No captions found
     ├─ GEMINI_API_KEY set?
     │   ├─ YES → transcribe_with_gemini()
     │   │         ├─ Success → return TranscriptData(source="gemini")
     │   │         └─ Fail → log warning, fall through to Whisper
     │   └─ NO → skip to Whisper
     └─ Whisper fallback (existing code, unchanged)
```

## Implementation Phases

### Phase 1: Core Gemini Transcriber (New File)

**File:** `services/summarizer/src/services/gemini_transcriber.py`

Mirrors `whisper_transcriber.py` structure. Key functions:

1. **`_download_audio_raw_sync(video_id: str) -> Path`**
   - Uses yt-dlp with `format: bestaudio` — same as Whisper download
   - **No `FFmpegExtractAudio` postprocessor** — keeps raw format (webm/m4a/ogg)
   - UUID-based filenames (same pattern as whisper_transcriber)
   - Retry logic with exponential backoff (same pattern as whisper_transcriber)
   - Reuse `_classify_download_error` from whisper_transcriber

2. **`transcribe_with_gemini(video_id: str) -> NormalizedTranscript`**
   - Downloads raw audio via `_download_audio_raw_sync`
   - Uploads to Gemini via `litellm.acreate_file` (handles files > 20MB)
   - Calls `litellm.acompletion` with uploaded file + transcription prompt
   - Prompt asks for JSON array of `{text, startMs, endMs}` segments
   - Parses response into `NormalizedTranscript(source="gemini")`
   - Cleanup in `finally` block (same pattern as whisper_transcriber)

**Key details:**
- MIME type detection: `.webm` → `audio/webm`, `.m4a` → `audio/mp4`, etc.
- Transcription prompt requests structured JSON segments (20-40s each)
- Uses `settings.llm_fast_model` (gemini/gemini-2.5-flash-lite)
- Requires `settings.GEMINI_API_KEY` to be set

### Phase 2: Integration into Stream Pipeline

**File:** `services/summarizer/src/routes/stream.py`

In `fetch_transcript()`, insert Gemini before Whisper:

```python
# After youtube-transcript-api failure, before Whisper:
if settings.GEMINI_API_KEY:
    yield sse_event("phase", {"phase": "audio_transcription"})
    try:
        result = await asyncio.wait_for(
            transcribe_with_gemini(youtube_id),
            timeout=min(max(120.0, duration * 0.02 + 60), 300.0),
        )
        # yield TranscriptData and return
    except Exception as e:
        logger.warning(f"Gemini transcription failed, trying Whisper: {e}")
        # Fall through to existing Whisper code
```

**Timeout formula:** `min(max(120, duration * 0.02 + 60), 300)` — 2-5 min range.
- 26-min video → ~91s timeout
- 173-min video → ~206s timeout

### Phase 3: Schema Update

**File:** `services/summarizer/src/models/schemas.py`

Add `"gemini"` to `TranscriptSource`:
```python
TranscriptSource = Literal["ytdlp", "api", "proxy", "whisper", "gemini"]
```

### Phase 4: Tests

**File:** `services/summarizer/tests/test_gemini_transcriber.py`

Test classes mirroring whisper_transcriber tests:
- `TestDownloadAudioRawSync` — download without postprocessor, UUID filenames, retries
- `TestTranscribeWithGemini` — mock `acreate_file` + `acompletion`, parse JSON response, cleanup
- `TestGeminiResponseParsing` — various output formats, malformed JSON fallback
- `TestMimeTypeDetection` — file extension → MIME mapping

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| LiteLLM `acreate_file` API doesn't support Gemini | Low | High | Check LiteLLM docs; fallback: use `google-genai` SDK directly |
| Gemini returns poor transcription quality | Low | Medium | Whisper fallback remains; can tune prompt |
| Gemini rejects certain audio formats | Low | Medium | MIME type map covers common formats; can add conversion fallback |
| File upload fails for very large files | Low | Medium | Gemini handles up to 9.5h; timeout catches hangs |
| Existing Whisper tests break | Very Low | Low | Whisper code is untouched; only stream.py integration changes |

## Success Metrics

1. Videos without captions complete transcription in < 2 min (was 5-15 min)
2. All existing Whisper tests pass unchanged
3. New Gemini transcriber tests pass with > 80% coverage
4. Fallback to Whisper works when `GEMINI_API_KEY` is unset
5. Cost per transcription drops from ~$0.16 to ~$0.04 for 26-min video

## Dependencies

| Dependency | Status | Notes |
|-----------|--------|-------|
| LiteLLM >= 1.80.0 | Already installed | `acreate_file` + `acompletion` with file content |
| GEMINI_API_KEY | Already in config.py | Env var, already used for LLM |
| yt-dlp | Already installed | Download without FFmpeg conversion |
| NormalizedTranscript / TranscriptSegment | Already in schemas.py | Reuse existing models |

## Files Summary

| File | Action | What Changes |
|------|--------|-------------|
| `services/summarizer/src/services/gemini_transcriber.py` | **New** | Gemini transcription: download raw audio -> upload -> transcribe -> parse |
| `services/summarizer/src/routes/stream.py` | **Modify** | Try Gemini before Whisper, shorter timeout, new SSE phase |
| `services/summarizer/src/models/schemas.py` | **Modify** | Add `"gemini"` to TranscriptSource literal |
| `services/summarizer/tests/test_gemini_transcriber.py` | **New** | Tests for Gemini transcriber |

**NOT modified:** `whisper_transcriber.py` stays as-is (Whisper fallback), `config.py` already has `GEMINI_API_KEY`, `requirements.txt` no changes needed.
