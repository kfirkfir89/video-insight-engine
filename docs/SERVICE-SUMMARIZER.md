# Service: vie-summarizer

Python service that processes YouTube videos into structured summaries.

**Type:** HTTP service (FastAPI + BackgroundTasks)

---

## Tech Stack

| Technology | Purpose |
|------------|---------|
| Python 3.11+ | Runtime |
| FastAPI | Web framework + SSE streaming |
| youtube-transcript-api | Fetch transcripts |
| yt-dlp | Video metadata + chapters |
| LiteLLM | Multi-provider LLM abstraction (Anthropic, OpenAI, Gemini) |
| pymongo | MongoDB driver |
| aioboto3 | Async S3 client (transcripts + frame storage) |
| Pydantic | Validation & Settings |
| google-genai | Gemini native SDK (audio transcription) |
| structlog | Structured logging |

---

## Project Structure

```
services/summarizer/
├── Dockerfile
├── requirements.txt
├── pyproject.toml
└── src/
    ├── __init__.py
    ├── main.py                   # FastAPI app + routes
    ├── config.py                 # Settings + model mapping
    ├── dependencies.py           # DI providers
    ├── exceptions.py             # Custom exceptions
    ├── logging_config.py         # structlog configuration
    ├── middleware.py             # Request ID middleware
    │
    ├── routes/
    │   ├── stream.py             # SSE streaming endpoint
    │   └── override.py           # Detection override endpoint
    │
    ├── services/
    │   ├── llm.py                # LLMService (thin wrapper around provider)
    │   ├── llm_provider.py       # LiteLLM multi-provider abstraction
    │   ├── usage_tracker.py      # LLM usage tracking
    │   ├── output_type.py        # Category → OutputType mapping (override compat)
    │   ├── override_state.py     # In-memory override state
    │   ├── status_callback.py    # Status callback
    │   │
    │   ├── pipeline/             # Triage-based summarization pipeline
    │   │   ├── manifest.py           # Manifest stage (structural transcript scan)
    │   │   ├── triage.py             # Triage (content tags + tab layout)
    │   │   ├── prompt_builder.py     # Schema-injection prompt builder
    │   │   ├── extractor.py          # Adaptive extraction (1-3 LLM calls)
    │   │   ├── enrichment.py         # Quiz/flashcards (learning only)
    │   │   ├── synthesis.py          # TLDR, takeaways, master summary
    │   │   ├── post_processor.py     # Tab cleanup, celebrations, count validation
    │   │   └── pipeline_helpers.py   # SSE events, timer, data classes
    │   │
    │   ├── transcription/        # Transcript fetching & storage
    │   │   ├── transcript.py         # Transcript cleaning & formatting
    │   │   ├── transcript_fetcher.py # Multi-source fallback chain
    │   │   ├── transcript_store.py   # S3 transcript persistence
    │   │   ├── gemini_transcriber.py # Gemini Flash transcription
    │   │   └── whisper_transcriber.py # Whisper fallback
    │   │
    │   ├── media/                # Frame extraction & S3 storage
    │   │   ├── frame_extractor.py    # Video frame extraction + S3 upload
    │   │   ├── image_dedup.py        # Perceptual hashing for dedup
    │   │   ├── s3_client.py          # Async S3 client
    │   │   ├── stream_url.py         # Stream URL resolution
    │   │   └── download_utils.py     # Download helpers
    │   │
    │   └── video/                # YouTube & metadata
    │       ├── youtube.py            # Video metadata (yt-dlp)
    │       ├── sponsorblock.py       # Sponsor segment detection
    │       ├── description_analyzer.py # Description analysis
    │       └── playlist.py           # Playlist extraction (yt-dlp)
    │
    ├── repositories/
    │   ├── base.py               # Repository protocols
    │   └── mongodb_repository.py # MongoDB implementation
    │
    ├── prompts/
    │   ├── manifest.txt          # Manifest prompt (structural transcript scan)
    │   ├── triage.txt            # Triage prompt (content tags + tab design)
    │   ├── base_extraction.txt   # Schema-injection extraction template
    │   ├── accuracy_rules.txt    # JSON extraction accuracy rules
    │   ├── enrich_study.txt      # Study enrichment (quiz, flashcards)
    │   ├── synthesis.txt         # Synthesis prompt
    │   └── schemas/              # Domain schemas (injected into base_extraction)
    │       ├── learning.txt
    │       ├── tech.txt
    │       ├── fitness.txt
    │       ├── food.txt
    │       ├── music.txt
    │       ├── travel.txt
    │       ├── review.txt
    │       ├── project.txt
    │       ├── narrative.txt     # Modifier
    │       └── finance.txt       # Modifier
    │
    ├── utils/
    │   ├── json_parsing.py       # Robust JSON recovery
    │   ├── content_extractor.py  # Summary/bullet extraction
    │   ├── transcript_slicer.py  # Time-range transcript slicing
    │   └── constants.py          # Constants
    │
    └── models/
        ├── schemas.py            # Pydantic models
        ├── domain_types.py       # Domain data models (Food, Travel, Music, etc.)
        └── pipeline_types.py     # Pipeline models (ManifestResult, TriageResult, etc.)
```

---

## Environment Variables

```bash
# Database
MONGODB_URI=mongodb://vie-mongodb:27017/video-insight-engine

# LLM Provider Configuration
LLM_PROVIDER=anthropic          # anthropic, openai, or gemini
LLM_FAST_PROVIDER=              # Optional: separate provider for fast model
LLM_FALLBACK_PROVIDER=          # Optional: fallback if primary fails
LLM_MODEL=                      # Optional: override default model
LLM_FAST_MODEL=                 # Optional: override fast model
LLM_MAX_TOKENS=4096
LLM_FAST_MAX_TOKENS=2048

# Provider API Keys (set for providers you use)
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=                 # Required if using OpenAI or Whisper
GEMINI_API_KEY=                 # Enables Gemini audio transcription (faster than Whisper)
GOOGLE_API_KEY=                 # Required if using Gemini as LLM provider

# S3 Media Storage (transcripts, frames, audio)
S3_BUCKET=vie-transcripts
S3_PRESIGNED_URL_EXPIRY=3600    # Presigned URL validity (seconds)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-key      # AWS credentials
AWS_SECRET_ACCESS_KEY=your-secret
PROMPT_VERSION=v1.0             # For generation tracking

LOG_LEVEL=INFO
LOG_FORMAT=console              # console or json
```

---

## Processing Pipeline (Triage-Driven)

The pipeline uses 4-7 LLM calls with a triage-first architecture:

```
 1. CONNECT via SSE
    └─▶ GET /summarize/stream/{videoSummaryId}
    └─▶ If cached: stream structured result immediately
    └─▶ If pending: start processing pipeline

 2. FETCH METADATA (yt-dlp)
    └─▶ Title, channel, thumbnail, duration, chapters
    └─▶ Category pre-detection from metadata
    └─▶ SSE: metadata event

 3. FETCH TRANSCRIPT (Multi-Source Fallback Chain)
    └─▶ 0. S3 cached transcript (avoids all YouTube calls)
    └─▶ 1. yt-dlp subtitles (embedded in video metadata)
    └─▶ 2. youtube-transcript-api (with rate limit retry)
    └─▶ 3. Gemini Flash (audio transcription, ~30-90s, ~$0.04/26min)
    └─▶ 4. OpenAI Whisper (audio fallback, ~5-15min, ~$0.16/26min)
    └─▶ SSE: transcript_ready event

 4. MANIFEST + DESCRIPTION ANALYSIS (concurrent, 1 LLM call + metadata parse)
    └─▶ Manifest: structural transcript scan → item counts, sections, flags
    └─▶ 10-second asyncio.wait_for timeout, non-blocking (returns None on failure)
    └─▶ Description analysis: extract links, resources, social links from metadata
    └─▶ SSE: description_analysis event

 5. TRIAGE (1 LLM call)
    └─▶ Determine contentTags (1-2 primary + 0-2 modifiers) from manifest + metadata
    └─▶ 8 primary tags: learning, tech, fitness, food, music, travel, review, project
    └─▶ 2 modifier tags: narrative, finance
    └─▶ Design tab layout (IDs, labels, emoji, dataSource)
    └─▶ Fallback: category-based mapping if confidence < 0.6
    └─▶ SSE: triage_complete event

 6. ADAPTIVE EXTRACTION (1-3 LLM calls)
    └─▶ Schema-injected: base_extraction.txt + schemas/{tag}.txt per content tag
    └─▶ <4K words: single extraction call
    └─▶ 4-20K words: single + overflow retry if validation fails
    └─▶ >3h videos AND >20K words: segmented extraction (token-based splitting)
    └─▶ Pydantic validation on all output
    └─▶ Post-extraction: count validation against manifest (advisory, logs warnings)
    └─▶ SSE: extraction_progress events, then extraction_complete

 7. ENRICHMENT (0-1 LLM calls, conditional)
    └─▶ learning: quiz + flashcards + scenarios
    └─▶ Other tags: skipped (no LLM call)
    └─▶ Non-critical: failure returns None gracefully
    └─▶ SSE: enrichment_complete event (if applicable)

 8. SYNTHESIS (1 LLM call)
    └─▶ Generate TLDR, key takeaways, master summary, SEO description
    └─▶ SSE: synthesis_complete event

 9. POST-PROCESSING + SAVE
    └─▶ Drop empty tabs, add celebrations, accent colors
    └─▶ Store structured result via save_structured_result()
    └─▶ Fields: triage, output (domain-keyed), enrichment, synthesis
    └─▶ Set status = "completed"
    └─▶ SSE: done event + [DONE] signal
```

---

## Key Implementations

### LLM Service (Thin Wrapper)

```python
# src/services/llm.py
class LLMService:
    """Thin wrapper around LLMProvider. Pipeline modules call _call_llm()."""

    def __init__(self, provider: LLMProvider):
        self._provider = provider

    async def _call_llm(self, prompt: str, max_tokens: int = 2000) -> str:
        async with asyncio.timeout(settings.LLM_TIMEOUT_SECONDS):
            return await self._provider.complete(prompt, max_tokens=max_tokens)
```

### Pipeline Modules

```python
# All pipeline modules follow the same pattern:
# - Accept llm_service, repository, and domain-specific args
# - Call llm_service._call_llm() for LLM interactions
# - Return typed results (Pydantic models or dicts)

# src/services/pipeline/manifest.py
async def run_manifest(llm_service, transcript, video_data) -> ManifestResult | None
def format_manifest_for_triage(manifest: ManifestResult) -> str

# src/services/pipeline/triage.py
async def run_triage(llm_service, video_data, manifest_text=None) -> TriageResult

# src/services/pipeline/extractor.py
async def extract(llm_service, transcript, triage, ...) -> AsyncGenerator[dict, None]

# src/services/pipeline/enrichment.py
async def enrich(llm_service, content_tag, extraction_data, ...) -> EnrichmentData | None

# src/services/pipeline/synthesis.py
async def synthesize(llm_service, extraction_text, video_title, ...) -> SynthesisResult

# src/services/pipeline/post_processor.py
def validate_extraction_counts(manifest: ManifestResult, extraction: dict) -> list[str]
```

**Model mapping (config.py):**
```python
MODEL_MAP = {
    "anthropic": {"default": "anthropic/claude-sonnet-4-20250514", "fast": "anthropic/claude-3-5-haiku-20241022"},
    "openai": {"default": "openai/gpt-4o", "fast": "openai/gpt-4o-mini"},
    "gemini": {"default": "gemini/gemini-2.5-flash", "fast": "gemini/gemini-2.5-flash-lite"},
}
```

---

## Content Tag System

The pipeline uses triage (LLM) to determine content tags from manifest + metadata. Each tag has a domain schema injected into a shared extraction template.

### 8 Primary Content Tags + 2 Modifiers

| ContentTag | Category Fallback | Domain Schema | Enrichment |
|------------|-------------------|---------------|------------|
| learning | education (default) | `schemas/learning.txt` | quiz, flashcards, scenarios |
| tech | coding, programming | `schemas/tech.txt` | - |
| fitness | fitness | `schemas/fitness.txt` | - |
| food | cooking | `schemas/food.txt` | - |
| music | music | `schemas/music.txt` | - |
| travel | travel | `schemas/travel.txt` | - |
| review | reviews | `schemas/review.txt` | - |
| project | diy, craft | `schemas/project.txt` | - |
| narrative | podcast, interview | `schemas/narrative.txt` | Modifier only |
| finance | — | `schemas/finance.txt` | Modifier only |

### SSE Event Protocol

| Event | Data |
|-------|------|
| `cached` | `{videoSummaryId}` (only for cached results) |
| `metadata` | `{title, channel, thumbnailUrl, duration}` |
| `transcript_ready` | `{duration}` |
| `sponsor_segments` | `{count, filteredDuration}` (SponsorBlock integration) |
| `description_analysis` | `{links, resources, socialLinks}` (concurrent with manifest) |
| `triage_complete` | `{contentTags, modifiers, primaryTag, tabs, confidence}` |
| `extraction_progress` | `{section, percent}` (multiple events) |
| `extraction_complete` | `{domain-keyed data}` |
| `enrichment_complete` | `{quiz?, flashcards?, scenarios?}` (conditional, learning only) |
| `synthesis_complete` | `{tldr, keyTakeaways, masterSummary, seoDescription}` |
| `done` | `{videoSummaryId, cached?}` |
| `[DONE]` | Terminal signal |

### Key Design Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Triage-first | LLM picks tags + designs tabs | More flexible than fixed output types |
| Schema injection | `base_extraction.txt` + `schemas/{tag}.txt` | One extraction prompt, domain schemas swapped in |
| Manifest pre-scan | Structural transcript scan before triage | Gives triage item counts, sections, flags for better decisions |
| Manifest non-blocking | 10s timeout, returns None on failure | Triage falls back to transcript_preview |
| Count validation advisory | Logs warnings at 60% threshold | Never blocks pipeline, just flags missing items |
| Legacy coercion | `field_validator(mode="before")` | Accepts old string format for travel tips and music analysis |
| Finance modifier costs-only | `costs[]` + `savingTips[]`, no budget | Primary domain owns budget structure |
| Adaptive extraction | 1-3 calls by word count | Prevents token overflow on long videos |
| Category fallback | Map video category to content tag | Safety net when triage confidence < 0.6 |

---

## Output Schema

The pipeline stores structured results with `triage`, `output`, `enrichment`, and `synthesis` fields:

```python
# MongoDB document structure (after pipeline completes):
{
    "triage": {
        "contentTags": ["learning"],       # 1-2 primary content tags
        "modifiers": [],                    # 0-2 modifier tags (narrative, finance)
        "primaryTag": "learning",           # First content tag
        "tabs": [                           # LLM-designed tab layout
            {"id": "key_points", "label": "Key Points", "emoji": "💡", "dataSource": "learning.keyPoints"},
            {"id": "concepts", "label": "Core Concepts", "emoji": "🧠", "dataSource": "learning.concepts"}
        ],
        "confidence": 0.95
    },
    "output": {
        "learning": {                       # Domain-keyed extraction data
            "keyPoints": [...],
            "concepts": [...],
            "takeaways": [...],
            "timestamps": [...]
        }
    },
    "enrichment": {
        "quizzes": [...],       # learning only
        "flashcards": [...],    # learning only
        "scenarios": [...]      # learning only
    },
    "synthesis": {
        "tldr": "...",
        "keyTakeaways": ["..."],
        "masterSummary": "...",
        "seoDescription": "..."
    }
}
```

See `src/models/domain_types.py` for domain data models and `src/models/pipeline_types.py` for pipeline types.

---

## Transcript Fallback Chain

The summarizer uses a multi-source fallback chain to maximize transcript availability:

```
┌─────────────────────────────────────────────────────────┐
│                  TRANSCRIPT SOURCES                     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  0. S3 Cached Transcript                               │
│     └─▶ Avoids all YouTube calls                       │
│     └─▶ Source: "s3" (cached-{original_source})        │
│                         │                               │
│                         ▼                               │
│  1. yt-dlp Subtitles                                   │
│     └─▶ Extracted during video metadata fetch           │
│     └─▶ Source: "ytdlp"                                │
│                         │                               │
│                         ▼                               │
│  2. youtube-transcript-api                             │
│     └─▶ With rate limit retry (tenacity)               │
│     └─▶ 3 attempts, exponential backoff (4-30s)        │
│     └─▶ Source: "api" or "proxy"                       │
│                         │                               │
│                         ▼                               │
│  3. Gemini Flash (if GEMINI_API_KEY set)               │
│     └─▶ Download raw audio via yt-dlp (no conversion)  │
│     └─▶ Upload to Gemini File API (google-genai SDK)   │
│     └─▶ Transcribe with generate_content()             │
│     └─▶ ~30-90s, ~$0.04 per 26-min video              │
│     └─▶ Music-aware prompt when category=music         │
│     └─▶ Source: "gemini"                               │
│                         │                               │
│                         ▼                               │
│  4. OpenAI Whisper (if enabled)                        │
│     └─▶ Download audio + convert to MP3 (FFmpeg)       │
│     └─▶ Chunk large files (>24MB) with pydub           │
│     └─▶ Transcribe with Whisper API                    │
│     └─▶ ~5-15min, ~$0.16 per 26-min video             │
│     └─▶ Max 60 minutes                                 │
│     └─▶ Source: "whisper"                              │
│                         │                               │
│                         ▼                               │
│  5. Metadata Fallback (music category only)            │
│     └─▶ Builds text from title, channel, description,  │
│         tags, and chapter titles                        │
│     └─▶ Only triggers when category == "music"         │
│     └─▶ Non-music videos still raise TranscriptError   │
│     └─▶ Skips sponsor filtering + AI chapter detection │
│     └─▶ Source: "metadata"                             │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Configuration

```bash
# Gemini transcription (preferred audio fallback)
GEMINI_API_KEY=...      # Enables Gemini Flash transcription

# Whisper fallback settings
WHISPER_ENABLED=true
WHISPER_MAX_DURATION_MINUTES=60
OPENAI_API_KEY=sk-...  # Required for Whisper
```

---

## S3 Media Storage

All media (transcripts, frames, future audio) is stored in a unified S3 bucket (`vie-transcripts`).

### Architecture

```
vie-transcripts (S3 bucket)
└── videos/{youtube_id}/
    ├── transcript.json       ← processed transcript
    └── frames/
        └── {timestamp}.jpg   ← extracted video frames
```

```
┌─────────────────────────────────────────────────────────┐
│                 S3 MEDIA STORAGE                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. Store Raw Transcript                                │
│     └─▶ S3 key: "videos/{youtubeId}/transcript.json"   │
│     └─▶ Legacy fallback: "transcripts/{youtubeId}.json"│
│     └─▶ Contains: segments, source, language, fetchedAt│
│                                                         │
│  2. Upload Video Frames                                 │
│     └─▶ S3 key: "videos/{youtubeId}/frames/{ts}.jpg"   │
│     └─▶ Parallel upload via asyncio.gather              │
│     └─▶ S3 exists check skips duplicates                │
│     └─▶ Blocks store s3_key (permanent) in MongoDB     │
│                                                         │
│  3. Serve via Presigned URLs                            │
│     └─▶ Generated at response time (sync, local signing)│
│     └─▶ Default expiry: 1 hour (S3_PRESIGNED_URL_EXPIRY)│
│     └─▶ Cached results refresh URLs before emitting    │
│                                                         │
│  4. Track Generation Metadata                           │
│     └─▶ model: LLM used for summarization              │
│     └─▶ promptVersion: for tracking prompt changes     │
│     └─▶ generatedAt: ISO timestamp                     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Design Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Single bucket | `vie-transcripts` for all media | Simpler ops, per-video folder isolation |
| Presigned URLs | All access via signed URLs | Security: private bucket, time-limited access |
| `s3_key` in MongoDB | Store key, not URL | URLs change (expiry), key is permanent |
| Sync presigning | No async for URL generation | Local crypto operation (HMAC-SHA256), no network call |
| Lazy S3 initialization | aioboto3 imported on first use | Container starts without S3 dependency |
| Graceful degradation | S3 failure doesn't block summarization | Core functionality works without S3 |

### Migration Scripts

**Transcript key migration** (legacy → new path):

```bash
# Dry run (preview what would be migrated)
python scripts/migrate-s3-keys.py --dry-run

# Run migration
python scripts/migrate-s3-keys.py --batch-size 10

# Migrate and delete old keys
python scripts/migrate-s3-keys.py --delete-old
```

**Backfill raw transcripts** for existing videos:

```bash
docker exec vie-summarizer python /app/scripts/backfill-transcripts.py --dry-run
docker exec vie-summarizer python /app/scripts/backfill-transcripts.py --batch-size 100
```

---

## Dockerfile

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY src/ ./src/

# Run FastAPI server
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

## Commands

```bash
# Run server
uvicorn src.main:app --host 0.0.0.0 --port 8000

# Development with auto-reload
uvicorn src.main:app --reload --port 8000

# Run tests
pip install -e ".[dev]"
pytest
```

---

## API Reference

### POST /summarize

Trigger video summarization (async).

**Request:**
```json
{
  "videoSummaryId": "507f1f77bcf86cd799439011",
  "youtubeId": "dQw4w9WgXcQ",
  "url": "https://youtube.com/watch?v=dQw4w9WgXcQ",
  "userId": "507f1f77bcf86cd799439012"
}
```

**Response (202 Accepted):**
```json
{
  "status": "accepted",
  "videoSummaryId": "507f1f77bcf86cd799439011"
}
```

### POST /playlist/extract

Extract playlist metadata using yt-dlp (fast, no video download).

**Request:**
```json
{
  "playlist_id": "PLxxx",
  "max_videos": 100
}
```

**Response:**
```json
{
  "playlist_id": "PLxxx",
  "title": "React Tutorial Series",
  "channel": "Fireship",
  "thumbnail_url": "https://img.youtube.com/...",
  "total_videos": 15,
  "videos": [
    {
      "video_id": "dQw4w9WgXcQ",
      "title": "React Hooks",
      "position": 0,
      "duration": 1200,
      "thumbnail_url": "https://img.youtube.com/..."
    }
  ]
}
```

**Error Codes:**
- `404`: Playlist not found or private
- `500`: yt-dlp extraction failed

### POST /regenerate/{video_summary_id}

Trigger regeneration of an existing video summary.

**Request:**
```json
{
  "force": false  // Optional: set true to re-fetch from YouTube if S3 unavailable
}
```

**Response (200 OK):**
```json
{
  "status": "ready",
  "video_summary_id": "507f1f77bcf86cd799439011",
  "message": "Video summary ready for regeneration. Connect to streaming endpoint to process.",
  "has_raw_transcript": true,
  "generation": {
    "model": "anthropic/claude-sonnet-4-20250514",
    "promptVersion": "v1.0",
    "generatedAt": "2026-02-05T10:30:00Z"
  }
}
```

**Error Codes:**
- `400`: Invalid video summary ID format
- `404`: Video summary not found

### POST /override/{video_summary_id}

Override detected category during active pipeline processing. Affects remaining chapters only.

**Request:**
```json
{
  "category": "fitness"
}
```

**Response (200):**
```json
{
  "category": "fitness",
  "outputType": "workout",
  "outputTypeLabel": "Workout Plan",
  "persona": "fitness"
}
```

**Error Codes:**
- `422`: Invalid category (returns list of valid categories)
- `503`: Override capacity reached

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "service": "summarizer",
  "model": "anthropic/claude-sonnet-4-20250514",
  "database": "connected",
  "s3": "healthy"
}
```
