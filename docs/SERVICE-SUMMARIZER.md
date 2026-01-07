# Service: vie-summarizer

Python worker that processes YouTube videos into structured summaries.

**Type:** Traditional service (RabbitMQ consumer)

---

## Tech Stack

| Technology | Purpose |
|------------|---------|
| Python 3.11+ | Runtime |
| FastAPI | Health endpoint |
| youtube-transcript-api | Fetch transcripts |
| anthropic | Claude API |
| pymongo | MongoDB driver |
| pika | RabbitMQ client |
| Pydantic | Validation |

---

## Project Structure

```
summarizer/
├── Dockerfile
├── requirements.txt
├── pyproject.toml
└── src/
    ├── __init__.py
    ├── main.py                   # FastAPI health endpoint
    ├── worker.py                 # RabbitMQ consumer (entry)
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
RABBITMQ_URI=amqp://guest:guest@vie-rabbitmq:5672
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-20250514
LOG_LEVEL=debug
```

---

## Processing Pipeline

```
 1. CONSUME JOB
    └─▶ Read from summarize.jobs queue
    └─▶ { videoSummaryId, youtubeId, url, userId }

 2. UPDATE STATUS
    └─▶ Set videoSummaryCache.status = "processing"
    └─▶ Publish status event (WebSocket)

 3. FETCH METADATA
    └─▶ YouTube oEmbed API
    └─▶ Get: title, channel, thumbnail

 4. FETCH TRANSCRIPT
    └─▶ youtube-transcript-api
    └─▶ Handle: manual > auto-generated
    └─▶ Output: list of segments with timestamps

 5. CLEAN TRANSCRIPT
    └─▶ Remove [Music], [Applause], etc.
    └─▶ Merge fragmented sentences
    └─▶ Normalize spacing

 6. DETECT SECTIONS (LLM)
    └─▶ Identify 3-8 logical sections
    └─▶ Output: boundaries + titles

 7. SUMMARIZE SECTIONS (LLM)
    └─▶ One call per section
    └─▶ Generate: summary + bullets

 8. EXTRACT CONCEPTS (LLM)
    └─▶ Identify key terms
    └─▶ Extract definitions
    └─▶ Map to timestamps

 9. SYNTHESIZE (LLM)
    └─▶ Generate TLDR
    └─▶ Identify key takeaways

10. SAVE TO CACHE
    └─▶ Update videoSummaryCache
    └─▶ Set status = "completed"

11. PUBLISH STATUS
    └─▶ Send to job.status exchange
```

---

## Key Implementations

### Worker Entry Point

```python
# src/worker.py

import pika
import json
from config import settings
from services.summarizer import process_video
from services.mongodb import db, update_status
from services.rabbitmq import publish_status

def callback(ch, method, properties, body):
    job = json.loads(body)
    video_summary_id = job['videoSummaryId']
    user_id = job.get('userId')
    
    try:
        # Update status
        update_status(video_summary_id, 'processing')
        publish_status('video.status', {
            'videoSummaryId': video_summary_id,
            'userId': user_id,
            'status': 'processing',
            'progress': 0
        })
        
        # Process video
        result = process_video(
            video_summary_id=video_summary_id,
            youtube_id=job['youtubeId'],
            url=job['url'],
            on_progress=lambda p, m: publish_status('video.status', {
                'videoSummaryId': video_summary_id,
                'userId': user_id,
                'status': 'processing',
                'progress': p,
                'message': m
            })
        )
        
        # Save result
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
        
        # Notify completion
        publish_status('video.status', {
            'videoSummaryId': video_summary_id,
            'userId': user_id,
            'status': 'completed',
            'progress': 100
        })
        
        ch.basic_ack(delivery_tag=method.delivery_tag)
        
    except Exception as e:
        update_status(video_summary_id, 'failed', str(e))
        publish_status('video.status', {
            'videoSummaryId': video_summary_id,
            'userId': user_id,
            'status': 'failed',
            'error': str(e)
        })
        ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)

def main():
    connection = pika.BlockingConnection(
        pika.URLParameters(settings.RABBITMQ_URI)
    )
    channel = connection.channel()
    channel.queue_declare(queue='summarize.jobs', durable=True)
    channel.basic_qos(prefetch_count=1)
    channel.basic_consume(
        queue='summarize.jobs',
        on_message_callback=callback
    )
    print('Summarizer worker started')
    channel.start_consuming()

if __name__ == '__main__':
    main()
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

# Run worker by default
CMD ["python", "-m", "src.worker"]
```

---

## Commands

```bash
# Run worker
python -m src.worker

# Run health endpoint
uvicorn src.main:app --port 8000

# Development
pip install -e ".[dev]"
pytest
```
