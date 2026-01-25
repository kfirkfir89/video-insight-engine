# Service: vie-summarizer

Python service that processes YouTube videos into structured summaries.

**Type:** HTTP service (FastAPI + BackgroundTasks)

---

## Tech Stack

| Technology | Purpose |
|------------|---------|
| Python 3.11+ | Runtime |
| FastAPI | Web framework + background tasks |
| youtube-transcript-api | Fetch transcripts |
| LiteLLM | Multi-provider LLM abstraction (Anthropic, OpenAI, Gemini) |
| pymongo | MongoDB driver |
| Pydantic | Validation |

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
    ├── dependencies.py           # DI for LLMProvider
    │
    ├── services/
    │   ├── transcript.py         # YouTube transcript fetching
    │   ├── metadata.py           # Video metadata (oEmbed)
    │   ├── cleaner.py            # Text normalization
    │   ├── llm.py                # LLM service (prompts + orchestration)
    │   ├── llm_provider.py       # LiteLLM abstraction layer
    │   ├── usage_tracker.py      # LLM usage tracking
    │   └── mongodb.py            # Database operations
    │
    ├── prompts/
    │   ├── section_detect.txt
    │   ├── section_summary.txt
    │   ├── concept_extract.txt
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

LOG_LEVEL=debug
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

 5. FETCH TRANSCRIPT
    └─▶ youtube-transcript-api
    └─▶ Handle: manual > auto-generated
    └─▶ Output: list of segments with timestamps

 6. CLEAN TRANSCRIPT
    └─▶ Remove [Music], [Applause], etc.
    └─▶ Merge fragmented sentences
    └─▶ Normalize spacing

 7. DETECT SECTIONS (LLM)
    └─▶ Identify 3-8 logical sections
    └─▶ Output: boundaries + titles

 8. SUMMARIZE SECTIONS (LLM)
    └─▶ One call per section
    └─▶ Generate: summary + bullets

 9. EXTRACT CONCEPTS (LLM)
    └─▶ Identify key terms
    └─▶ Extract definitions
    └─▶ Map to timestamps

10. SYNTHESIZE (LLM)
    └─▶ Generate TLDR
    └─▶ Identify key takeaways

11. SAVE TO CACHE
    └─▶ Update videoSummaryCache
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

    async def detect_sections(self, transcript: str, segments: list) -> list[dict]:
        """Detect logical sections using configured LLM provider."""
        prompt = load_prompt("section_detect").format(transcript=transcript[:15000])
        response = await self._provider.complete(prompt, max_tokens=2000)
        return parse_json_response(response)['sections']

    async def summarize_section(self, section_text: str, title: str) -> dict:
        """Generate summary and bullets for a section."""
        prompt = load_prompt("section_summary").format(
            title=title, section_text=section_text
        )
        response = await self._provider.complete(prompt, max_tokens=1000)
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

class Section(BaseModel):
    id: str                    # UUID
    timestamp: str             # "03:45"
    startSeconds: int
    endSeconds: int
    title: str
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
    sections: list[Section]
    concepts: list[Concept]
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

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "service": "summarizer"
}
```
