# Implementation Track 3: vie-summarizer (Python HTTP Service)

> **Parallel Track** - Can run simultaneously with other tracks.
> **Prerequisite:** [IMPL-00-SHARED.md](./IMPL-00-SHARED.md) complete.

---

## Overview

| What | Details |
|------|---------|
| **Service** | vie-summarizer |
| **Tech** | Python 3.11 + FastAPI + BackgroundTasks |
| **Port** | 8000 |
| **Role** | YouTube → Transcript → LLM → Summary |

---

## Phase 1: Project Setup

### 1.1 Create Project Structure

```bash
mkdir -p services/summarizer/src/{services,prompts,models}
cd services/summarizer
```

### 1.2 Create Requirements

- [ ] Create `services/summarizer/requirements.txt`

```txt
# Web Framework
fastapi>=0.109.0
uvicorn>=0.27.0

# YouTube
youtube-transcript-api>=0.6.2

# LLM
anthropic>=0.18.0

# Database
pymongo>=4.6.0

# Validation
pydantic>=2.5.0
pydantic-settings>=2.1.0

# Utils
python-dotenv>=1.0.0
httpx>=0.26.0
```

### 1.3 Create pyproject.toml

- [ ] Create `services/summarizer/pyproject.toml`

```toml
[project]
name = "vie-summarizer"
version = "0.1.0"
requires-python = ">=3.11"

[tool.ruff]
line-length = 100
target-version = "py311"

[tool.ruff.lint]
select = ["E", "F", "I"]
```

---

## Phase 2: Configuration

### 2.1 Settings

- [ ] Create `services/summarizer/src/config.py`

```python
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # MongoDB
    MONGODB_URI: str = "mongodb://vie-mongodb:27017/video-insight-engine"

    # Anthropic
    ANTHROPIC_API_KEY: str
    ANTHROPIC_MODEL: str = "claude-sonnet-4-20250514"

    # Limits
    MAX_VIDEO_DURATION_MINUTES: int = 180
    MIN_VIDEO_DURATION_SECONDS: int = 60

    class Config:
        env_file = ".env"


settings = Settings()
```

---

## Phase 3: Models

### 3.1 Pydantic Schemas

- [ ] Create `services/summarizer/src/models/schemas.py`

```python
from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel


class ProcessingStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class ErrorCode(str, Enum):
    NO_TRANSCRIPT = "NO_TRANSCRIPT"
    VIDEO_TOO_LONG = "VIDEO_TOO_LONG"
    VIDEO_TOO_SHORT = "VIDEO_TOO_SHORT"
    VIDEO_UNAVAILABLE = "VIDEO_UNAVAILABLE"
    VIDEO_RESTRICTED = "VIDEO_RESTRICTED"
    LIVE_STREAM = "LIVE_STREAM"
    LLM_ERROR = "LLM_ERROR"
    UNKNOWN_ERROR = "UNKNOWN_ERROR"


class SummarizeRequest(BaseModel):
    videoSummaryId: str
    youtubeId: str
    url: str
    userId: str | None = None


class SummarizeResponse(BaseModel):
    status: str
    videoSummaryId: str


class Section(BaseModel):
    id: str
    timestamp: str
    start_seconds: int
    end_seconds: int
    title: str
    summary: str
    bullets: list[str]


class Concept(BaseModel):
    id: str
    name: str
    definition: Optional[str] = None
    timestamp: Optional[str] = None


class VideoSummary(BaseModel):
    tldr: str
    key_takeaways: list[str]
    sections: list[Section]
    concepts: list[Concept]


class ProcessingResult(BaseModel):
    title: str
    channel: Optional[str] = None
    duration: Optional[int] = None
    thumbnail_url: Optional[str] = None
    transcript: str
    transcript_type: str
    summary: VideoSummary
    token_usage: dict
```

---

## Phase 4: Services

### 4.1 MongoDB Service

- [ ] Create `services/summarizer/src/services/mongodb.py`

```python
from datetime import datetime
from typing import Any, Optional
from bson import ObjectId
from pymongo import MongoClient

from src.config import settings
from src.models.schemas import ProcessingStatus, ErrorCode

client = MongoClient(settings.MONGODB_URI)
db = client.get_default_database()


def get_video_summary(video_summary_id: str) -> Optional[dict]:
    """Get video summary cache entry."""
    return db.videoSummaryCache.find_one({"_id": ObjectId(video_summary_id)})


def update_status(
    video_summary_id: str,
    status: ProcessingStatus,
    error_message: Optional[str] = None,
    error_code: Optional[ErrorCode] = None,
) -> None:
    """Update processing status."""
    update: dict[str, Any] = {
        "status": status.value,
        "updatedAt": datetime.utcnow(),
    }

    if error_message:
        update["errorMessage"] = error_message
    if error_code:
        update["errorCode"] = error_code.value

    db.videoSummaryCache.update_one(
        {"_id": ObjectId(video_summary_id)},
        {"$set": update}
    )


def save_result(video_summary_id: str, result: dict) -> None:
    """Save processing result to cache."""
    db.videoSummaryCache.update_one(
        {"_id": ObjectId(video_summary_id)},
        {
            "$set": {
                "title": result["title"],
                "channel": result.get("channel"),
                "duration": result.get("duration"),
                "thumbnailUrl": result.get("thumbnail_url"),
                "transcript": result["transcript"],
                "transcriptType": result["transcript_type"],
                "summary": {
                    "tldr": result["summary"]["tldr"],
                    "keyTakeaways": result["summary"]["key_takeaways"],
                    "sections": [
                        {
                            "id": s["id"],
                            "timestamp": s["timestamp"],
                            "startSeconds": s["start_seconds"],
                            "endSeconds": s["end_seconds"],
                            "title": s["title"],
                            "summary": s["summary"],
                            "bullets": s["bullets"],
                        }
                        for s in result["summary"]["sections"]
                    ],
                    "concepts": [
                        {
                            "id": c["id"],
                            "name": c["name"],
                            "definition": c.get("definition"),
                            "timestamp": c.get("timestamp"),
                        }
                        for c in result["summary"]["concepts"]
                    ],
                },
                "status": ProcessingStatus.COMPLETED.value,
                "processedAt": datetime.utcnow(),
                "processingTimeMs": result.get("processing_time_ms"),
                "tokenUsage": result.get("token_usage"),
                "updatedAt": datetime.utcnow(),
            }
        }
    )


def increment_retry(video_summary_id: str) -> int:
    """Increment retry count and return new value."""
    result = db.videoSummaryCache.find_one_and_update(
        {"_id": ObjectId(video_summary_id)},
        {"$inc": {"retryCount": 1}},
        return_document=True
    )
    return result.get("retryCount", 1)
```

---

### 4.2 Transcript Service

- [ ] Create `services/summarizer/src/services/transcript.py`

```python
from typing import Optional
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import (
    TranscriptsDisabled,
    NoTranscriptFound,
    VideoUnavailable,
)

from src.models.schemas import ErrorCode


class TranscriptError(Exception):
    def __init__(self, message: str, code: ErrorCode):
        super().__init__(message)
        self.code = code


def get_transcript(video_id: str) -> tuple[list[dict], str, str]:
    """
    Fetch transcript from YouTube.

    Returns:
        (segments, full_text, transcript_type)
    """
    try:
        transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)

        # Prefer manual captions
        transcript = None
        transcript_type = "auto-generated"

        try:
            transcript = transcript_list.find_manually_created_transcript(["en"])
            transcript_type = "manual"
        except Exception:
            try:
                transcript = transcript_list.find_generated_transcript(["en"])
            except Exception:
                # Try any available
                for t in transcript_list:
                    transcript = t
                    break

        if not transcript:
            raise TranscriptError("No transcript available", ErrorCode.NO_TRANSCRIPT)

        segments = transcript.fetch()
        full_text = " ".join([s["text"] for s in segments])

        return segments, full_text, transcript_type

    except TranscriptsDisabled:
        raise TranscriptError("Captions are disabled for this video", ErrorCode.NO_TRANSCRIPT)
    except NoTranscriptFound:
        raise TranscriptError("No English transcript available", ErrorCode.NO_TRANSCRIPT)
    except VideoUnavailable:
        raise TranscriptError("Video is unavailable or private", ErrorCode.VIDEO_UNAVAILABLE)
    except TranscriptError:
        raise
    except Exception as e:
        raise TranscriptError(f"Failed to fetch transcript: {str(e)}", ErrorCode.UNKNOWN_ERROR)


def clean_transcript(text: str) -> str:
    """Clean and normalize transcript text."""
    import re

    # Remove common artifacts
    text = re.sub(r"\[Music\]", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\[Applause\]", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\[Laughter\]", "", text, flags=re.IGNORECASE)

    # Normalize whitespace
    text = re.sub(r"\s+", " ", text)

    return text.strip()
```

---

### 4.3 Metadata Service

- [ ] Create `services/summarizer/src/services/metadata.py`

```python
from typing import Optional
import httpx


async def get_video_metadata(video_id: str) -> dict:
    """Fetch video metadata from YouTube oEmbed API."""
    url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, timeout=10)
            response.raise_for_status()
            data = response.json()

            return {
                "title": data.get("title", "Unknown Title"),
                "channel": data.get("author_name"),
                "thumbnail_url": data.get("thumbnail_url"),
            }
        except Exception:
            return {
                "title": "Unknown Title",
                "channel": None,
                "thumbnail_url": None,
            }


def get_thumbnail_url(video_id: str) -> str:
    """Get high-quality thumbnail URL."""
    return f"https://img.youtube.com/vi/{video_id}/maxresdefault.jpg"
```

---

### 4.4 LLM Service

- [ ] Create `services/summarizer/src/services/llm.py`

```python
import json
import uuid
from pathlib import Path
from typing import Optional

import anthropic

from src.config import settings
from src.models.schemas import Section, Concept, VideoSummary, ErrorCode


client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"


def load_prompt(name: str) -> str:
    """Load prompt template from file."""
    path = PROMPTS_DIR / f"{name}.txt"
    return path.read_text()


def detect_sections(transcript: str, segments: list[dict]) -> list[dict]:
    """Detect logical sections in transcript."""
    prompt = load_prompt("section_detect").format(
        transcript=transcript[:15000]  # Token limit
    )

    response = client.messages.create(
        model=settings.ANTHROPIC_MODEL,
        max_tokens=2000,
        messages=[{"role": "user", "content": prompt}]
    )

    text = response.content[0].text

    # Parse JSON from response
    try:
        # Find JSON in response
        start = text.find("{")
        end = text.rfind("}") + 1
        data = json.loads(text[start:end])
        return data.get("sections", [])
    except json.JSONDecodeError:
        # Fallback: single section
        return [{
            "title": "Full Video",
            "startSeconds": 0,
            "endSeconds": int(segments[-1]["start"] + segments[-1]["duration"]) if segments else 0
        }]


def summarize_section(section_text: str, title: str) -> dict:
    """Generate summary and bullets for a section."""
    prompt = load_prompt("section_summary").format(
        title=title,
        content=section_text[:8000]
    )

    response = client.messages.create(
        model=settings.ANTHROPIC_MODEL,
        max_tokens=1000,
        messages=[{"role": "user", "content": prompt}]
    )

    text = response.content[0].text

    try:
        start = text.find("{")
        end = text.rfind("}") + 1
        return json.loads(text[start:end])
    except json.JSONDecodeError:
        return {"summary": text, "bullets": []}


def extract_concepts(transcript: str) -> list[dict]:
    """Extract key concepts from transcript."""
    prompt = load_prompt("concept_extract").format(
        transcript=transcript[:15000]
    )

    response = client.messages.create(
        model=settings.ANTHROPIC_MODEL,
        max_tokens=2000,
        messages=[{"role": "user", "content": prompt}]
    )

    text = response.content[0].text

    try:
        start = text.find("{")
        end = text.rfind("}") + 1
        data = json.loads(text[start:end])
        return data.get("concepts", [])
    except json.JSONDecodeError:
        return []


def synthesize_summary(sections: list[dict], concepts: list[dict]) -> dict:
    """Generate TLDR and key takeaways."""
    sections_text = "\n".join([
        f"- {s['title']}: {s.get('summary', '')}" for s in sections
    ])
    concepts_text = ", ".join([c["name"] for c in concepts])

    prompt = load_prompt("global_synthesis").format(
        sections=sections_text,
        concepts=concepts_text
    )

    response = client.messages.create(
        model=settings.ANTHROPIC_MODEL,
        max_tokens=1000,
        messages=[{"role": "user", "content": prompt}]
    )

    text = response.content[0].text

    try:
        start = text.find("{")
        end = text.rfind("}") + 1
        return json.loads(text[start:end])
    except json.JSONDecodeError:
        return {"tldr": text[:500], "keyTakeaways": []}


def seconds_to_timestamp(seconds: int) -> str:
    """Convert seconds to MM:SS format."""
    mins = seconds // 60
    secs = seconds % 60
    return f"{mins:02d}:{secs:02d}"


def process_video(
    transcript: str,
    segments: list[dict],
    on_progress: Optional[callable] = None
) -> dict:
    """Full LLM processing pipeline."""

    if on_progress:
        on_progress(10, "Detecting sections...")

    # 1. Detect sections
    raw_sections = detect_sections(transcript, segments)

    if on_progress:
        on_progress(30, "Summarizing sections...")

    # 2. Summarize each section
    sections = []
    for i, raw in enumerate(raw_sections):
        # Get section text from segments
        start = raw.get("startSeconds", 0)
        end = raw.get("endSeconds", start + 300)

        section_segments = [
            s for s in segments
            if start <= s["start"] <= end
        ]
        section_text = " ".join([s["text"] for s in section_segments])

        summary_data = summarize_section(section_text, raw["title"])

        sections.append({
            "id": str(uuid.uuid4()),
            "timestamp": seconds_to_timestamp(start),
            "start_seconds": start,
            "end_seconds": end,
            "title": raw["title"],
            "summary": summary_data.get("summary", ""),
            "bullets": summary_data.get("bullets", []),
        })

        if on_progress:
            progress = 30 + int((i + 1) / len(raw_sections) * 40)
            on_progress(progress, f"Summarizing section {i + 1}/{len(raw_sections)}...")

    if on_progress:
        on_progress(70, "Extracting concepts...")

    # 3. Extract concepts
    raw_concepts = extract_concepts(transcript)
    concepts = [
        {
            "id": str(uuid.uuid4()),
            "name": c["name"],
            "definition": c.get("definition"),
            "timestamp": c.get("timestamp"),
        }
        for c in raw_concepts
    ]

    if on_progress:
        on_progress(90, "Generating summary...")

    # 4. Synthesize
    synthesis = synthesize_summary(sections, concepts)

    return {
        "tldr": synthesis.get("tldr", ""),
        "key_takeaways": synthesis.get("keyTakeaways", []),
        "sections": sections,
        "concepts": concepts,
    }
```

---

## Phase 5: Prompts

### 5.1 Section Detection

- [ ] Create `services/summarizer/src/prompts/section_detect.txt`

```
Analyze this video transcript and identify logical sections.

TRANSCRIPT:
{transcript}

Return JSON only (no other text):
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
- Identify 3-8 sections based on topic changes
- Each section should be a coherent topic
- Use actual timestamps from content flow
- Sections must be sequential with no gaps
- Title should be descriptive (3-6 words)
```

---

### 5.2 Section Summary

- [ ] Create `services/summarizer/src/prompts/section_summary.txt`

```
Summarize this video section.

SECTION: {title}
CONTENT:
{content}

Return JSON only (no other text):
{{
  "summary": "2-3 sentence summary of the section",
  "bullets": ["key point 1", "key point 2", "key point 3"]
}}

Guidelines:
- Summary should capture the main idea
- Bullets should be specific and actionable
- Include 3-5 bullet points
- Use clear, concise language
```

---

### 5.3 Concept Extraction

- [ ] Create `services/summarizer/src/prompts/concept_extract.txt`

```
Extract key concepts, terms, and definitions from this transcript.

TRANSCRIPT:
{transcript}

Return JSON only (no other text):
{{
  "concepts": [
    {{
      "name": "Concept name",
      "definition": "Brief definition from video or null",
      "timestamp": "MM:SS or null"
    }}
  ]
}}

Focus on:
- Technical terms and jargon
- Important concepts explained in the video
- Named frameworks, tools, or methodologies
- Key ideas that a viewer should remember

Include 5-15 concepts maximum.
```

---

### 5.4 Global Synthesis

- [ ] Create `services/summarizer/src/prompts/global_synthesis.txt`

```
Create a high-level summary of this video.

SECTIONS:
{sections}

KEY CONCEPTS: {concepts}

Return JSON only (no other text):
{{
  "tldr": "1-2 sentence overview of the entire video",
  "keyTakeaways": ["takeaway 1", "takeaway 2", "takeaway 3"]
}}

Guidelines:
- TLDR should be understandable without watching the video
- Key takeaways should be actionable insights
- Include 3-5 key takeaways
- Be specific, not generic
```

---

## Phase 6: FastAPI Application

### 6.1 Main Application

- [ ] Create `services/summarizer/src/main.py`

```python
import time
import logging
from datetime import datetime

from fastapi import FastAPI, BackgroundTasks, HTTPException
from bson import ObjectId

from src.config import settings
from src.models.schemas import (
    SummarizeRequest,
    SummarizeResponse,
    ProcessingStatus,
    ErrorCode,
)
from src.services import mongodb, transcript, metadata, llm

app = FastAPI(title="vie-summarizer")
logger = logging.getLogger(__name__)


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "service": "vie-summarizer",
        "model": settings.ANTHROPIC_MODEL,
    }


@app.get("/")
async def root():
    return {"service": "vie-summarizer", "version": "0.1.0"}


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
    start_time = time.time()

    try:
        # Update status to processing
        mongodb.update_status(video_summary_id, ProcessingStatus.PROCESSING)

        logger.info(f"Processing video {youtube_id} (id: {video_summary_id})")

        # 1. Fetch metadata
        meta = await metadata.get_video_metadata(youtube_id)

        # 2. Fetch transcript
        segments, raw_transcript, transcript_type = transcript.get_transcript(youtube_id)

        # Calculate duration
        duration = None
        if segments:
            last = segments[-1]
            duration = int(last["start"] + last.get("duration", 0))

            # Check duration limits
            if duration > settings.MAX_VIDEO_DURATION_MINUTES * 60:
                raise transcript.TranscriptError(
                    f"Video too long ({duration // 60} min)",
                    ErrorCode.VIDEO_TOO_LONG
                )
            if duration < settings.MIN_VIDEO_DURATION_SECONDS:
                raise transcript.TranscriptError(
                    f"Video too short ({duration} sec)",
                    ErrorCode.VIDEO_TOO_SHORT
                )

        # 3. Clean transcript
        clean_text = transcript.clean_transcript(raw_transcript)

        # 4. Process with LLM
        summary = llm.process_video(clean_text, segments)

        # 5. Save result
        processing_time = int((time.time() - start_time) * 1000)

        result = {
            "title": meta["title"],
            "channel": meta.get("channel"),
            "duration": duration,
            "thumbnail_url": meta.get("thumbnail_url") or metadata.get_thumbnail_url(youtube_id),
            "transcript": raw_transcript,
            "transcript_type": transcript_type,
            "summary": summary,
            "processing_time_ms": processing_time,
            "token_usage": {},  # TODO: Track token usage
        }

        mongodb.save_result(video_summary_id, result)

        logger.info(f"✅ Completed video {youtube_id} in {processing_time}ms")

    except transcript.TranscriptError as e:
        mongodb.update_status(video_summary_id, ProcessingStatus.FAILED, str(e), e.code)
        logger.error(f"❌ Failed {youtube_id}: {e}")

    except Exception as e:
        mongodb.update_status(video_summary_id, ProcessingStatus.FAILED, str(e), ErrorCode.UNKNOWN_ERROR)
        logger.error(f"❌ Failed {youtube_id}: {e}")
```

---

## Phase 7: Dockerfile

- [ ] Create `services/summarizer/Dockerfile`

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source
COPY src/ ./src/

# Health endpoint
EXPOSE 8000

# Run FastAPI server
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

### 7.1 Docker Compose Entry

The `docker-compose.yml` should include:

```yaml
vie-summarizer:
  build: ./services/summarizer
  container_name: vie-summarizer
  restart: unless-stopped
  ports:
    - "8000:8000"
  environment:
    PYTHONUNBUFFERED: 1
    MONGODB_URI: mongodb://vie-mongodb:27017/video-insight-engine
    ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
    ANTHROPIC_MODEL: ${ANTHROPIC_MODEL:-claude-sonnet-4-20250514}
  networks:
    - vie-network
  depends_on:
    vie-mongodb:
      condition: service_healthy
```

---

## Verification Checklist

```bash
# 1. Install dependencies
cd services/summarizer
pip install -r requirements.txt

# 2. Start the service
uvicorn src.main:app --reload --port 8000

# 3. Health check
curl http://localhost:8000/health
# Expected: {"status":"healthy","service":"vie-summarizer",...}

# 4. Test transcript fetching (with known video)
python -c "
from src.services.transcript import get_transcript
segments, text, ttype = get_transcript('dQw4w9WgXcQ')
print(f'Got {len(segments)} segments, type: {ttype}')
print(text[:200])
"

# 5. Test metadata fetching
python -c "
import asyncio
from src.services.metadata import get_video_metadata
meta = asyncio.run(get_video_metadata('dQw4w9WgXcQ'))
print(meta)
"

# 6. Test POST /summarize (with MongoDB running)
curl -X POST http://localhost:8000/summarize \
  -H "Content-Type: application/json" \
  -d '{
    "videoSummaryId": "507f1f77bcf86cd799439011",
    "youtubeId": "dQw4w9WgXcQ",
    "url": "https://youtube.com/watch?v=dQw4w9WgXcQ"
  }'
# Expected: {"status":"accepted","videoSummaryId":"..."}
```

---

## Integration Points

| Service | Integration | Status |
|---------|-------------|--------|
| vie-mongodb | Store summaries | ✅ Phase 4 |
| vie-api | Receives HTTP POST | 🔄 Needs API |

---

## Next Steps

After this track:

1. Uncomment `vie-summarizer` in `docker-compose.yml`
2. Run `docker-compose up -d --build vie-summarizer`
3. Test end-to-end with vie-api: submit video → see processing → get summary
