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
| aioboto3 | Async S3 client (for transcript storage) |
| Pydantic | Validation & Settings |
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
    │   └── stream.py             # SSE streaming endpoint
    │
    ├── services/
    │   ├── transcript.py         # YouTube transcript fetching
    │   ├── youtube.py            # Video metadata (yt-dlp)
    │   ├── description_analyzer.py # Description analysis
    │   ├── llm.py                # LLM service (prompts + orchestration)
    │   ├── llm_provider.py       # LiteLLM abstraction layer
    │   ├── usage_tracker.py      # LLM usage tracking
    │   ├── playlist.py           # Playlist extraction (yt-dlp)
    │   ├── sponsorblock.py       # Sponsor segment detection
    │   ├── whisper_transcriber.py # Whisper fallback
    │   ├── s3_client.py          # Async S3 client (lazy init)
    │   └── transcript_store.py   # Transcript storage service
    │
    ├── repositories/
    │   ├── base.py               # Repository protocols
    │   └── mongodb_repository.py # MongoDB implementation
    │
    ├── prompts/
    │   ├── chapter_detect.txt
    │   ├── chapter_summary.txt
    │   ├── concept_extract.txt
    │   ├── master_summary.txt
    │   └── global_synthesis.txt
    │
    └── models/
        └── schemas.py            # Pydantic models
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
OPENAI_API_KEY=                 # Required if using OpenAI
GOOGLE_API_KEY=                 # Required if using Gemini

# S3 Configuration (for transcript storage)
TRANSCRIPT_S3_BUCKET=vie-transcripts
AWS_REGION=us-east-1
AWS_ENDPOINT_URL=http://vie-localstack:4566  # LocalStack for dev
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
PROMPT_VERSION=v1.0             # For generation tracking

LOG_LEVEL=INFO
LOG_FORMAT=console              # console or json
```

---

## Processing Pipeline

```
 1. RECEIVE HTTP REQUEST
    └─▶ POST /summarize
    └─▶ { videoSummaryId, youtubeId, url, userId }

 2. RETURN 202 ACCEPTED
    └─▶ Background task queued
    └─▶ Return immediately to caller

 3. UPDATE STATUS (background)
    └─▶ Set videoSummaryCache.status = "processing"

 4. FETCH METADATA
    └─▶ YouTube oEmbed API
    └─▶ Get: title, channel, thumbnail

 5. FETCH TRANSCRIPT (Multi-Source Fallback Chain)
    └─▶ 1. yt-dlp subtitles (embedded in video metadata)
    └─▶ 2. youtube-transcript-api (with rate limit retry)
    └─▶ 3. OpenAI Whisper (audio transcription fallback)
    └─▶ Handle: manual > auto-generated
    └─▶ Output: NormalizedTranscript (segments with ms timestamps)

 5b. STORE RAW TRANSCRIPT (optional)
    └─▶ Store to S3 (LocalStack/AWS) as JSON
    └─▶ Key: "transcripts/{youtubeId}.json"
    └─▶ Graceful degradation if S3 unavailable

 6. CLEAN TRANSCRIPT
    └─▶ Remove [Music], [Applause], etc.
    └─▶ Merge fragmented sentences
    └─▶ Normalize spacing

 7. DETECT CHAPTERS (LLM)
    └─▶ Use creator chapters if available, else AI-detect 3-8 logical chapters
    └─▶ Output: boundaries + titles

 8. SUMMARIZE CHAPTERS (LLM)
    └─▶ One call per chapter
    └─▶ Slice transcript for chapter time range
    └─▶ Generate: content blocks with blockId, summary + bullets
    └─▶ Store transcript slice in chapter

 9. EXTRACT CONCEPTS (LLM)
    └─▶ Identify key terms
    └─▶ Extract definitions
    └─▶ Map to timestamps

10. SYNTHESIZE (LLM)
    └─▶ Generate TLDR
    └─▶ Identify key takeaways

11. SAVE TO CACHE
    └─▶ Update videoSummaryCache
    └─▶ Include rawTranscriptRef (S3 key)
    └─▶ Include generation metadata (model, promptVersion, timestamp)
    └─▶ Set status = "completed"
```

---

## Key Implementations

### FastAPI Application

```python
# src/main.py

from fastapi import FastAPI, BackgroundTasks, HTTPException
from pydantic import BaseModel
from .config import settings
from .services.summarizer import process_video
from .services.mongodb import db, update_status
import logging

app = FastAPI(title="Video Summarizer Service")
logger = logging.getLogger(__name__)

class SummarizeRequest(BaseModel):
    videoSummaryId: str
    youtubeId: str
    url: str
    userId: str | None = None

class SummarizeResponse(BaseModel):
    status: str
    videoSummaryId: str

@app.get("/health")
async def health():
    return {"status": "healthy", "service": "summarizer"}

@app.post("/summarize", response_model=SummarizeResponse, status_code=202)
async def summarize(request: SummarizeRequest, background_tasks: BackgroundTasks):
    """
    Trigger video summarization.
    Returns immediately, processing happens in background.
    """
    background_tasks.add_task(
        run_summarization,
        request.videoSummaryId,
        request.youtubeId,
        request.url,
        request.userId
    )

    return SummarizeResponse(
        status="accepted",
        videoSummaryId=request.videoSummaryId
    )

async def run_summarization(
    video_summary_id: str,
    youtube_id: str,
    url: str,
    user_id: str | None
):
    """Background task to process video."""
    try:
        # Update status to processing
        update_status(video_summary_id, 'processing')

        logger.info(f"Processing video {youtube_id} (id: {video_summary_id})")

        # Process video (all LLM calls)
        result = process_video(
            video_summary_id=video_summary_id,
            youtube_id=youtube_id,
            url=url
        )

        # Save result to cache
        db.videoSummaryCache.update_one(
            {'_id': ObjectId(video_summary_id)},
            {'$set': {
                'title': result['title'],
                'channel': result['channel'],
                'duration': result['duration'],
                'thumbnailUrl': result['thumbnailUrl'],
                'transcript': result['transcript'],
                'summary': result['summary'],
                'status': 'completed',
                'processedAt': datetime.utcnow(),
                'updatedAt': datetime.utcnow()
            }}
        )

        logger.info(f"Completed video {youtube_id}")

    except Exception as e:
        logger.error(f"Failed to process video {youtube_id}: {str(e)}")
        update_status(video_summary_id, 'failed', str(e))
```

### Transcript Fetching

```python
# src/services/transcript.py

from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import (
    TranscriptsDisabled,
    NoTranscriptFound,
    VideoUnavailable
)

class TranscriptError(Exception):
    pass

def get_transcript(video_id: str) -> tuple[list[dict], str]:
    """
    Fetch transcript from YouTube.
    Returns (segments, full_text)
    """
    try:
        transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)

        # Prefer manual captions
        try:
            transcript = transcript_list.find_manually_created_transcript(['en'])
        except:
            try:
                transcript = transcript_list.find_generated_transcript(['en'])
            except:
                # Try any available language
                transcript = transcript_list.find_transcript(['en', 'en-US'])

        segments = transcript.fetch()
        full_text = ' '.join([s['text'] for s in segments])

        return segments, full_text

    except TranscriptsDisabled:
        raise TranscriptError("Captions are disabled for this video")
    except NoTranscriptFound:
        raise TranscriptError("No English transcript available")
    except VideoUnavailable:
        raise TranscriptError("Video is unavailable or private")
    except Exception as e:
        raise TranscriptError(f"Failed to fetch transcript: {str(e)}")
```

### LLM Summarization (LiteLLM Multi-Provider)

```python
# src/services/llm_provider.py
from litellm import acompletion
from src.config import settings

class LLMProvider:
    """Multi-provider LLM abstraction using LiteLLM."""

    def __init__(self, model: str | None = None, fallback_models: list[str] | None = None):
        self._model = model or settings.llm_model
        self._fallback_models = fallback_models or settings.llm_fallback_models

    async def complete(self, prompt: str, max_tokens: int = 2000) -> str:
        """Generate completion from prompt."""
        kwargs = {
            "model": self._model,  # e.g., "anthropic/claude-sonnet-4-20250514"
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": max_tokens,
        }
        if self._fallback_models:
            kwargs["fallbacks"] = self._fallback_models

        response = await acompletion(**kwargs)
        return response.choices[0].message.content or ""

    async def stream(self, prompt: str, max_tokens: int = 2000):
        """Stream completion tokens."""
        kwargs = {
            "model": self._model,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": max_tokens,
            "stream": True,
        }
        response = await acompletion(**kwargs)
        async for chunk in response:
            if chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content


# src/services/llm.py
class LLMService:
    """LLM service for video summarization."""

    def __init__(self, provider: LLMProvider):
        self._provider = provider

    async def detect_chapters(self, transcript: str, segments: list) -> list[dict]:
        """Detect logical chapters using configured LLM provider."""
        prompt = load_prompt("chapter_detect").format(transcript=transcript[:15000])
        response = await self._provider.complete(prompt, max_tokens=2000)
        return parse_json_response(response)['chapters']

    async def summarize_chapter(self, chapter_text: str, title: str, persona: str) -> dict:
        """Generate content blocks, summary and bullets for a chapter."""
        prompt = load_prompt("chapter_summary").format(
            title=title, chapter_text=chapter_text, persona=persona
        )
        response = await self._provider.complete(prompt, max_tokens=1000)
        # Content blocks are injected with blockId (UUID) for stable referencing
        return parse_json_response(response)
```

**Model mapping (config.py):**
```python
MODEL_MAP = {
    "anthropic": {"default": "anthropic/claude-sonnet-4-20250514", "fast": "anthropic/claude-3-5-haiku-20241022"},
    "openai": {"default": "openai/gpt-4o", "fast": "openai/gpt-4o-mini"},
    "gemini": {"default": "gemini/gemini-3-flash-preview", "fast": "gemini/gemini-2.5-flash-lite"},
}
```

---

## Output Schema

```python
# src/models/schemas.py

from pydantic import BaseModel
from typing import Literal

# Transcript system types
TranscriptSource = Literal["ytdlp", "api", "proxy", "whisper"]

class TranscriptSegment(BaseModel):
    text: str
    startMs: int  # Milliseconds
    endMs: int

class NormalizedTranscript(BaseModel):
    text: str
    segments: list[TranscriptSegment]
    source: TranscriptSource

class Chapter(BaseModel):
    id: str                      # UUID
    timestamp: str               # "03:45"
    startSeconds: int
    endSeconds: int
    title: str
    originalTitle: str | None    # Creator's chapter title
    generatedTitle: str | None   # AI-generated title
    isCreatorChapter: bool       # True if from YouTube chapters
    content: list[dict]          # ContentBlocks with blockId
    summary: str
    bullets: list[str]

class Concept(BaseModel):
    id: str
    name: str
    definition: str | None
    timestamp: str | None

class VideoSummary(BaseModel):
    tldr: str
    keyTakeaways: list[str]
    chapters: list[Chapter]
    concepts: list[Concept]
```

---

## Transcript Fallback Chain

The summarizer uses a multi-source fallback chain to maximize transcript availability:

```
┌─────────────────────────────────────────────────────────┐
│                  TRANSCRIPT SOURCES                     │
├─────────────────────────────────────────────────────────┤
│                                                         │
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
│  3. OpenAI Whisper (if enabled)                        │
│     └─▶ Download audio via yt-dlp                      │
│     └─▶ Transcribe with Whisper API                    │
│     └─▶ For videos without captions                    │
│     └─▶ Max 60 minutes                                 │
│     └─▶ Source: "whisper"                              │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Configuration

```bash
# Whisper fallback settings
WHISPER_ENABLED=true
WHISPER_MAX_DURATION_MINUTES=60
OPENAI_API_KEY=sk-...  # Required for Whisper
```

---

## Transcript Storage (S3)

Raw transcripts are stored in S3 for regeneration and RAG/search capabilities.

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                 TRANSCRIPT STORAGE                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. Store Raw Transcript                                │
│     └─▶ S3 key: "transcripts/{youtubeId}.json"         │
│     └─▶ Contains: segments, source, language, fetchedAt│
│                                                         │
│  2. Slice Transcript per Chapter                        │
│     └─▶ Extract text by startSeconds/endSeconds        │
│     └─▶ Store slice in chapter.transcript field        │
│                                                         │
│  3. Track Generation Metadata                           │
│     └─▶ model: LLM used for summarization              │
│     └─▶ promptVersion: for tracking prompt changes     │
│     └─▶ generatedAt: ISO timestamp                     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Design Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Lazy S3 initialization | aioboto3 imported on first use | Container starts without S3 dependency |
| Graceful degradation | S3 failure doesn't block summarization | Core functionality works without S3 |
| Regeneration via status reset | Reuses streaming endpoint | No duplicate code |
| Chapter-level transcripts | Stored in MongoDB | Fast access for RAG/search |

### Migration Script

Backfill raw transcripts for existing videos:

```bash
# Dry run (preview what would be migrated)
docker exec vie-summarizer python /app/scripts/backfill-transcripts.py --dry-run

# Run migration
docker exec vie-summarizer python /app/scripts/backfill-transcripts.py

# Limit batch size
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
