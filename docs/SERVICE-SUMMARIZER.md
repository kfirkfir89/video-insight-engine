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
| anthropic | Claude API |
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
    ├── config.py                 # Settings
    │
    ├── services/
    │   ├── transcript.py         # YouTube transcript fetching
    │   ├── metadata.py           # Video metadata (oEmbed)
    │   ├── cleaner.py            # Text normalization
    │   ├── summarizer.py         # LLM orchestration
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
MONGODB_URI=mongodb://vie-mongodb:27017/video-insight-engine
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-20250514
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

### LLM Summarization

```python
# src/services/summarizer.py

import anthropic
from config import settings

client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

def detect_sections(transcript: str, segments: list[dict]) -> list[dict]:
    """Detect logical sections in transcript."""

    prompt = f"""Analyze this video transcript and identify logical sections.

TRANSCRIPT:
{transcript[:15000]}  # Truncate for token limits

Return JSON only:
{{
  "sections": [
    {{
      "title": "Section title",
      "startSeconds": 0,
      "endSeconds": 180
    }}
  ]
}}

Rules:
- Identify 3-8 sections
- Each section = coherent topic
- Use actual timestamps from content
- Sections must be sequential"""

    response = client.messages.create(
        model=settings.ANTHROPIC_MODEL,
        max_tokens=2000,
        messages=[{"role": "user", "content": prompt}]
    )

    return parse_json_response(response.content[0].text)['sections']

def summarize_section(section_text: str, title: str) -> dict:
    """Generate summary and bullets for a section."""

    prompt = f"""Summarize this video section.

SECTION: {title}
CONTENT:
{section_text}

Return JSON only:
{{
  "summary": "2-3 sentence summary",
  "bullets": ["key point 1", "key point 2", "key point 3"]
}}"""

    response = client.messages.create(
        model=settings.ANTHROPIC_MODEL,
        max_tokens=1000,
        messages=[{"role": "user", "content": prompt}]
    )

    return parse_json_response(response.content[0].text)

def extract_concepts(transcript: str) -> list[dict]:
    """Extract key concepts/terms from transcript."""

    prompt = f"""Extract key concepts, terms, and definitions from this transcript.

TRANSCRIPT:
{transcript[:15000]}

Return JSON only:
{{
  "concepts": [
    {{
      "name": "Concept name",
      "definition": "Brief definition from video",
      "timestamp": "MM:SS or null"
    }}
  ]
}}

Focus on:
- Technical terms
- Important concepts
- Named frameworks/tools"""

    response = client.messages.create(
        model=settings.ANTHROPIC_MODEL,
        max_tokens=2000,
        messages=[{"role": "user", "content": prompt}]
    )

    return parse_json_response(response.content[0].text)['concepts']

def synthesize_summary(sections: list[dict], concepts: list[dict]) -> dict:
    """Generate TLDR and key takeaways."""

    sections_text = "\n".join([
        f"- {s['title']}: {s['summary']}" for s in sections
    ])

    prompt = f"""Create a high-level summary of this video.

SECTIONS:
{sections_text}

CONCEPTS: {', '.join([c['name'] for c in concepts])}

Return JSON only:
{{
  "tldr": "1-2 sentence overview of entire video",
  "keyTakeaways": ["takeaway 1", "takeaway 2", "takeaway 3"]
}}"""

    response = client.messages.create(
        model=settings.ANTHROPIC_MODEL,
        max_tokens=1000,
        messages=[{"role": "user", "content": prompt}]
    )

    return parse_json_response(response.content[0].text)
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
