# Transcript Storage System

> **Priority:** Should be implemented before PLAN-MEMORIZE-COLLECTIONS-RAG.md
> **Services:** `api/` (vie-api), `services/summarizer/` (vie-summarizer), `packages/types/`
> **Dependencies:** None - this is foundational infrastructure

---

## Executive Summary

Implement transcript persistence at two levels:
1. **Chapter-level transcripts** — Store the raw transcript slice for each chapter in MongoDB
2. **Full raw transcript in S3** — Store the complete transcript for regeneration without re-fetching from YouTube

This enables:
- Block regeneration when prompts improve (without calling YouTube again)
- Transcript display alongside generated content
- Debug/audit trail for LLM input vs output

---

## Prerequisites

Before starting this plan, verify:

- [ ] Summarizer outputs `chapters[]` with `startSeconds` and `endSeconds`
- [ ] Each block has `blockId: string`
- [ ] AWS credentials configured (or S3-compatible storage)

---

## Current State Analysis

### Current Chapter Structure

**File:** `packages/types/src/index.ts`

```typescript
interface SummaryChapter {
  id: string;
  timestamp: string;
  startSeconds: number;
  endSeconds: number;
  title: string;
  originalTitle?: string;
  generatedTitle?: string;
  isCreatorChapter: boolean;
  content?: ContentBlock[];    // LLM output (blocks)
  summary: string;             // Legacy
  bullets: string[];           // Legacy
  // MISSING: transcript (LLM input)
}
```

### Current VideoSummary Structure

**File:** `packages/types/src/index.ts`

```typescript
interface VideoSummary {
  tldr: string;
  keyTakeaways: string[];
  chapters: SummaryChapter[];
  concepts: Concept[];
  masterSummary?: string;
  // MISSING: rawTranscriptRef, generation metadata
}
```

### Current videoSummaryCache Schema

**File:** `docs/DATA-MODELS.md`

```typescript
{
  // ... existing fields ...
  transcript: string | null,           // Full transcript text (flattened)
  transcriptSegments: [{               // Already has segments with timestamps!
    text: string,
    startMs: number,
    endMs: number
  }] | null,
  // MISSING: rawTranscriptRef, generation metadata
}
```

**Good news:** `transcriptSegments` already exists with timestamps, so we can slice per chapter.

---

## Data Model Updates

### 1. Update SummaryChapter Type

**File:** `packages/types/src/index.ts`

```typescript
export interface SummaryChapter {
  id: string;
  timestamp: string;
  startSeconds: number;
  endSeconds: number;
  title: string;
  originalTitle?: string;
  generatedTitle?: string;
  isCreatorChapter: boolean;
  content?: ContentBlock[];
  summary: string;
  bullets: string[];

  // NEW: Raw transcript for this chapter's time range
  transcript: string;
}
```

### 2. Add RawTranscript Types

**File:** `packages/types/src/index.ts`

```typescript
/**
 * Full transcript stored in S3 for regeneration
 */
export interface RawTranscript {
  youtubeId: string;
  fetchedAt: string;           // ISO date
  source: TranscriptSource;    // 'ytdlp' | 'api' | 'proxy' | 'whisper'
  language: string | null;
  segments: TranscriptSegment[];
}

/**
 * Generation metadata for tracking prompt versions
 */
export interface GenerationMetadata {
  model: string;               // "anthropic/claude-sonnet-4-20250514"
  promptVersion: string;       // "v2.3"
  generatedAt: string;         // ISO date
}
```

### 3. Update VideoSummary Type

**File:** `packages/types/src/index.ts`

```typescript
export interface VideoSummary {
  tldr: string;
  keyTakeaways: string[];
  chapters: SummaryChapter[];
  concepts: Concept[];
  masterSummary?: string;

  // NEW: Reference to full transcript in S3
  rawTranscriptRef: string | null;  // "transcripts/{youtubeId}.json"

  // NEW: Generation metadata for tracking/regeneration
  generation?: GenerationMetadata;
}
```

### 4. Update videoSummaryCache MongoDB Schema

**File:** MongoDB schema (if using Mongoose, update the schema file)

Add these fields to the existing schema:

```javascript
{
  // ... existing fields ...

  // S3 reference for full raw transcript
  rawTranscriptRef: { type: String, default: null },

  // Generation metadata
  generation: {
    model: { type: String },
    promptVersion: { type: String },
    generatedAt: { type: Date }
  },

  // Update chapters subdocument to include transcript
  'summary.chapters.$.transcript': { type: String }
}
```

---

## New Utilities

### 1. Transcript Slicer

**File:** `packages/utils/src/transcript-slicer.ts`

```typescript
import type { TranscriptSegment } from '@vie/types';

/**
 * Slices transcript segments for a specific time range.
 *
 * @param segments - Full transcript segments with ms timestamps
 * @param startSeconds - Chapter start time (seconds)
 * @param endSeconds - Chapter end time (seconds)
 * @returns Joined text for that range
 */
export function sliceTranscriptForChapter(
  segments: TranscriptSegment[],
  startSeconds: number,
  endSeconds: number
): string {
  const startMs = startSeconds * 1000;
  const endMs = endSeconds * 1000;

  return segments
    .filter(seg => seg.startMs >= startMs && seg.startMs < endMs)
    .map(seg => seg.text)
    .join(' ')
    .trim();
}

/**
 * Slices transcript segments for multiple chapters in one pass.
 * More efficient than calling sliceTranscriptForChapter repeatedly.
 */
export function sliceTranscriptForChapters(
  segments: TranscriptSegment[],
  chapters: Array<{ startSeconds: number; endSeconds: number }>
): string[] {
  // Sort segments once
  const sorted = [...segments].sort((a, b) => a.startMs - b.startMs);

  return chapters.map(chapter => {
    const startMs = chapter.startSeconds * 1000;
    const endMs = chapter.endSeconds * 1000;

    return sorted
      .filter(seg => seg.startMs >= startMs && seg.startMs < endMs)
      .map(seg => seg.text)
      .join(' ')
      .trim();
  });
}
```

---

## New Services

### 1. S3 Client Service

**File:** `api/src/services/s3.service.ts`

```typescript
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand
} from '@aws-sdk/client-s3';
import { injectable } from 'tsyringe';
import type { FastifyBaseLogger } from 'fastify';

@injectable()
export class S3Service {
  private client: S3Client;
  private bucket: string;

  constructor(private readonly logger: FastifyBaseLogger) {
    this.client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
    });
    this.bucket = process.env.TRANSCRIPT_S3_BUCKET || 'vie-transcripts';
  }

  /**
   * Upload JSON to S3
   */
  async putJson<T>(key: string, data: T): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: JSON.stringify(data),
      ContentType: 'application/json',
    });

    await this.client.send(command);
    this.logger.info({ key }, 'Uploaded JSON to S3');
  }

  /**
   * Download JSON from S3. Returns null if not found.
   */
  async getJson<T>(key: string): Promise<T | null> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const response = await this.client.send(command);
      const body = await response.Body?.transformToString();

      if (!body) return null;
      return JSON.parse(body) as T;

    } catch (error: any) {
      if (error.name === 'NoSuchKey') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Check if a key exists in S3
   */
  async exists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });
      await this.client.send(command);
      return true;
    } catch (error: any) {
      if (error.name === 'NotFound') {
        return false;
      }
      throw error;
    }
  }
}
```

### 2. Transcript Store Service

**File:** `api/src/services/transcript-store.service.ts`

```typescript
import { injectable } from 'tsyringe';
import type { FastifyBaseLogger } from 'fastify';
import type { RawTranscript, TranscriptSegment, TranscriptSource } from '@vie/types';
import { S3Service } from './s3.service';

@injectable()
export class TranscriptStoreService {
  constructor(
    private readonly s3: S3Service,
    private readonly logger: FastifyBaseLogger
  ) {}

  /**
   * Get the S3 key for a transcript
   */
  private getKey(youtubeId: string): string {
    return `transcripts/${youtubeId}.json`;
  }

  /**
   * Store a transcript in S3 after fetching from YouTube.
   * Called by the summarizer after successful transcript fetch.
   */
  async store(
    youtubeId: string,
    segments: TranscriptSegment[],
    source: TranscriptSource,
    language: string | null
  ): Promise<string> {
    const key = this.getKey(youtubeId);

    const rawTranscript: RawTranscript = {
      youtubeId,
      fetchedAt: new Date().toISOString(),
      source,
      language,
      segments,
    };

    await this.s3.putJson(key, rawTranscript);
    this.logger.info({ youtubeId, key, segmentCount: segments.length }, 'Stored raw transcript');

    return key;
  }

  /**
   * Get a stored transcript from S3.
   * Returns null if not found.
   */
  async get(youtubeId: string): Promise<RawTranscript | null> {
    const key = this.getKey(youtubeId);
    return this.s3.getJson<RawTranscript>(key);
  }

  /**
   * Check if a transcript exists in S3
   */
  async exists(youtubeId: string): Promise<boolean> {
    const key = this.getKey(youtubeId);
    return this.s3.exists(key);
  }

  /**
   * Get transcript by S3 ref (the rawTranscriptRef stored in MongoDB)
   */
  async getByRef(ref: string): Promise<RawTranscript | null> {
    return this.s3.getJson<RawTranscript>(ref);
  }
}
```

### 3. Video Regeneration Service

**File:** `api/src/services/video-regenerator.service.ts`

```typescript
import { injectable } from 'tsyringe';
import type { FastifyBaseLogger } from 'fastify';
import type { SummaryChapter, GenerationMetadata } from '@vie/types';
import { sliceTranscriptForChapters } from '@vie/utils';
import { TranscriptStoreService } from './transcript-store.service';
import { VideoSummaryCacheRepository } from '../repositories/video-summary-cache.repository';

@injectable()
export class VideoRegeneratorService {
  constructor(
    private readonly transcriptStore: TranscriptStoreService,
    private readonly cacheRepo: VideoSummaryCacheRepository,
    private readonly logger: FastifyBaseLogger
  ) {}

  /**
   * Regenerates all blocks for a video using stored transcript from S3.
   * Does NOT call YouTube API.
   */
  async regenerateVideo(
    videoSummaryId: string,
    promptVersion: string
  ): Promise<void> {
    // 1. Load video summary from MongoDB
    const cache = await this.cacheRepo.findById(videoSummaryId);
    if (!cache) {
      throw new Error(`Video summary ${videoSummaryId} not found`);
    }

    // 2. Get raw transcript from S3
    if (!cache.rawTranscriptRef) {
      throw new Error(`No transcript ref for video ${videoSummaryId}`);
    }

    const rawTranscript = await this.transcriptStore.getByRef(cache.rawTranscriptRef);
    if (!rawTranscript) {
      throw new Error(`Transcript not found in S3: ${cache.rawTranscriptRef}`);
    }

    // 3. Slice transcript per chapter
    const chapters = cache.summary?.chapters || [];
    const transcriptSlices = sliceTranscriptForChapters(
      rawTranscript.segments,
      chapters.map(ch => ({ startSeconds: ch.startSeconds, endSeconds: ch.endSeconds }))
    );

    // 4. Call summarizer to regenerate blocks
    // This would call the vie-summarizer service with the transcript slices
    // Implementation depends on how summarizer exposes regeneration endpoint

    const regeneratedChapters = await this.callSummarizerRegenerate(
      chapters,
      transcriptSlices,
      cache.context,
      promptVersion
    );

    // 5. Update MongoDB with new chapters
    const generation: GenerationMetadata = {
      model: 'anthropic/claude-sonnet-4-20250514', // from summarizer response
      promptVersion,
      generatedAt: new Date().toISOString(),
    };

    await this.cacheRepo.updateSummary(videoSummaryId, {
      chapters: regeneratedChapters,
      generation,
    });

    this.logger.info(
      { videoSummaryId, promptVersion },
      'Regenerated video from stored transcript'
    );
  }

  /**
   * Bulk regenerate all videos with stored transcripts.
   */
  async regenerateAll(
    promptVersion: string,
    options?: { batchSize?: number; delayMs?: number }
  ): Promise<{ succeeded: string[]; failed: { id: string; error: string }[] }> {
    const { batchSize = 5, delayMs = 1000 } = options || {};

    const succeeded: string[] = [];
    const failed: { id: string; error: string }[] = [];

    // Get all videos with rawTranscriptRef
    const videos = await this.cacheRepo.findWithTranscriptRef();

    this.logger.info({ count: videos.length, promptVersion }, 'Starting bulk regeneration');

    for (let i = 0; i < videos.length; i += batchSize) {
      const batch = videos.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (video) => {
          try {
            await this.regenerateVideo(video._id.toString(), promptVersion);
            succeeded.push(video._id.toString());
          } catch (error: any) {
            failed.push({ id: video._id.toString(), error: error.message });
            this.logger.error(
              { videoId: video._id.toString(), error: error.message },
              'Failed to regenerate video'
            );
          }
        })
      );

      // Delay between batches to avoid rate limits
      if (i + batchSize < videos.length) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    this.logger.info(
      { succeeded: succeeded.length, failed: failed.length },
      'Bulk regeneration complete'
    );

    return { succeeded, failed };
  }

  private async callSummarizerRegenerate(
    chapters: SummaryChapter[],
    transcriptSlices: string[],
    context: any,
    promptVersion: string
  ): Promise<SummaryChapter[]> {
    // TODO: Implement call to vie-summarizer regenerate endpoint
    // This endpoint needs to be created in the summarizer service
    throw new Error('Not implemented - need summarizer regenerate endpoint');
  }
}
```

---

## Summarizer Pipeline Updates

### Update Processing Flow

**File:** `services/summarizer/src/services/llm.py`

The summarizer already has `transcriptSegments`. We need to:

1. After generating chapters, slice the transcript per chapter
2. Include the sliced transcript in each chapter object
3. Store the full transcript to S3 and save the ref

```python
# In the summarization pipeline

async def process_video(self, video_summary_id: str, youtube_id: str) -> VideoSummary:
    # 1. Fetch transcript (existing code)
    transcript = await self.transcript_service.fetch(youtube_id)

    # 2. Store raw transcript to S3 (NEW)
    s3_key = await self.transcript_store.store(
        youtube_id=youtube_id,
        segments=transcript.segments,
        source=transcript.source,
        language=transcript.language
    )

    # 3. Detect chapters (existing code)
    chapters = await self.detect_chapters(transcript.text)

    # 4. Summarize each chapter (existing code)
    # ... generate blocks ...

    # 5. Attach transcript slice to each chapter (NEW)
    for chapter in chapters:
        chapter.transcript = slice_transcript_for_chapter(
            transcript.segments,
            chapter.start_seconds,
            chapter.end_seconds
        )

    # 6. Save to MongoDB with rawTranscriptRef (NEW)
    await self.cache_repo.update(
        video_summary_id,
        {
            'summary': summary,
            'rawTranscriptRef': s3_key,
            'generation': {
                'model': self.model_name,
                'promptVersion': PROMPT_VERSION,
                'generatedAt': datetime.utcnow()
            }
        }
    )
```

### Add S3 Client to Summarizer

**File:** `services/summarizer/src/services/s3_client.py`

```python
import boto3
import json
from datetime import datetime
from typing import Optional
from pydantic import BaseModel

from src.config import settings
from src.models.schemas import TranscriptSegment, TranscriptSource


class RawTranscript(BaseModel):
    youtube_id: str
    fetched_at: str
    source: TranscriptSource
    language: Optional[str]
    segments: list[TranscriptSegment]


class S3Client:
    def __init__(self):
        self.client = boto3.client(
            's3',
            region_name=settings.aws_region or 'us-east-1'
        )
        self.bucket = settings.transcript_s3_bucket or 'vie-transcripts'

    def _get_key(self, youtube_id: str) -> str:
        return f"transcripts/{youtube_id}.json"

    async def store_transcript(
        self,
        youtube_id: str,
        segments: list[TranscriptSegment],
        source: TranscriptSource,
        language: Optional[str]
    ) -> str:
        """Store raw transcript to S3. Returns the S3 key."""
        key = self._get_key(youtube_id)

        raw_transcript = RawTranscript(
            youtube_id=youtube_id,
            fetched_at=datetime.utcnow().isoformat(),
            source=source,
            language=language,
            segments=segments
        )

        self.client.put_object(
            Bucket=self.bucket,
            Key=key,
            Body=raw_transcript.model_dump_json(),
            ContentType='application/json'
        )

        return key

    async def get_transcript(self, youtube_id: str) -> Optional[RawTranscript]:
        """Get raw transcript from S3."""
        key = self._get_key(youtube_id)

        try:
            response = self.client.get_object(Bucket=self.bucket, Key=key)
            body = response['Body'].read().decode('utf-8')
            return RawTranscript.model_validate_json(body)
        except self.client.exceptions.NoSuchKey:
            return None

    async def exists(self, youtube_id: str) -> bool:
        """Check if transcript exists in S3."""
        key = self._get_key(youtube_id)

        try:
            self.client.head_object(Bucket=self.bucket, Key=key)
            return True
        except:
            return False
```

### Add Transcript Slicer to Summarizer

**File:** `services/summarizer/src/utils/transcript_slicer.py`

```python
from src.models.schemas import TranscriptSegment


def slice_transcript_for_chapter(
    segments: list[TranscriptSegment],
    start_seconds: int,
    end_seconds: int
) -> str:
    """
    Slices transcript segments for a specific time range.

    Args:
        segments: Full transcript segments with ms timestamps
        start_seconds: Chapter start time (seconds)
        end_seconds: Chapter end time (seconds)

    Returns:
        Joined text for that range
    """
    start_ms = start_seconds * 1000
    end_ms = end_seconds * 1000

    texts = [
        seg.text
        for seg in segments
        if seg.startMs >= start_ms and seg.startMs < end_ms
    ]

    return ' '.join(texts).strip()


def slice_transcript_for_chapters(
    segments: list[TranscriptSegment],
    chapters: list[dict]
) -> list[str]:
    """
    Slices transcript for multiple chapters efficiently.

    Args:
        segments: Full transcript segments
        chapters: List of dicts with startSeconds and endSeconds

    Returns:
        List of transcript slices, one per chapter
    """
    # Sort segments once
    sorted_segments = sorted(segments, key=lambda s: s.startMs)

    return [
        slice_transcript_for_chapter(sorted_segments, ch['startSeconds'], ch['endSeconds'])
        for ch in chapters
    ]
```

---

## Infrastructure

### Environment Variables

Add to `.env` and Docker Compose:

```bash
# S3 Transcript Storage
TRANSCRIPT_S3_BUCKET=vie-transcripts
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=xxx         # Or use IAM roles
AWS_SECRET_ACCESS_KEY=xxx     # Or use IAM roles
```

### Docker Compose (LocalStack for Development)

For local development, use LocalStack to simulate S3:

```yaml
# docker-compose.yml
services:
  vie-localstack:
    image: localstack/localstack:latest
    container_name: vie-localstack
    restart: unless-stopped
    ports:
      - "4566:4566"
    environment:
      - SERVICES=s3
      - DEFAULT_REGION=us-east-1
    volumes:
      - vie_localstack_data:/var/lib/localstack
    networks:
      - vie-network

volumes:
  vie_localstack_data:
```

Update services to use LocalStack in dev:

```bash
# Development
AWS_ENDPOINT_URL=http://vie-localstack:4566
TRANSCRIPT_S3_BUCKET=vie-transcripts-dev
```

### Install Dependencies

**API (Node.js):**
```bash
npm install @aws-sdk/client-s3
```

**Summarizer (Python):**
```bash
pip install boto3
```

---

## Implementation Phases

### Phase 1: Types & Utilities (1 day)

1. [ ] Update `SummaryChapter` type to add `transcript: string`
2. [ ] Add `RawTranscript` and `GenerationMetadata` types to `@vie/types`
3. [ ] Update `VideoSummary` type to add `rawTranscriptRef` and `generation`
4. [ ] Create `transcript-slicer.ts` in `@vie/utils`
5. [ ] Create `transcript_slicer.py` in summarizer

### Phase 2: S3 Infrastructure (1 day)

1. [ ] Add LocalStack to docker-compose for local dev
2. [ ] Create `S3Service` in API
3. [ ] Create `S3Client` in summarizer
4. [ ] Test S3 upload/download works

### Phase 3: Transcript Storage (2 days)

1. [ ] Create `TranscriptStoreService` in API
2. [ ] Update summarizer pipeline to store transcripts to S3
3. [ ] Update summarizer to slice and attach transcript to chapters
4. [ ] Update MongoDB save to include `rawTranscriptRef` and `generation`
5. [ ] Test end-to-end: process video → verify transcript in S3 and chapters

### Phase 4: Regeneration Service (2 days)

1. [ ] Create summarizer `/regenerate` endpoint
2. [ ] Create `VideoRegeneratorService` in API
3. [ ] Create API endpoint for single video regeneration
4. [ ] Create bulk regeneration script
5. [ ] Test regeneration from stored transcript

### Phase 5: Migration & Backfill (1 day)

1. [ ] Create migration script to backfill existing videos
2. [ ] For each existing video with `transcriptSegments`:
   - Store to S3
   - Slice per chapter
   - Update MongoDB
3. [ ] Verify migration success

---

## Migration Script

```typescript
// scripts/backfill-transcripts.ts

async function backfillTranscripts() {
  const db = await getDb();
  const s3 = new S3Service(logger);
  const transcriptStore = new TranscriptStoreService(s3, logger);

  // Find all videos with transcriptSegments but no rawTranscriptRef
  const videos = await db.collection('videoSummaryCache').find({
    transcriptSegments: { $exists: true, $ne: null },
    rawTranscriptRef: { $exists: false }
  }).toArray();

  console.log(`Found ${videos.length} videos to backfill`);

  for (const video of videos) {
    try {
      // 1. Store to S3
      const key = await transcriptStore.store(
        video.youtubeId,
        video.transcriptSegments,
        video.transcriptSource || 'api',
        video.language
      );

      // 2. Slice per chapter
      const chapters = video.summary?.chapters || [];
      const slices = sliceTranscriptForChapters(
        video.transcriptSegments,
        chapters.map(ch => ({ startSeconds: ch.startSeconds, endSeconds: ch.endSeconds }))
      );

      // 3. Update chapters with transcript slices
      const updatedChapters = chapters.map((ch, i) => ({
        ...ch,
        transcript: slices[i]
      }));

      // 4. Update MongoDB
      await db.collection('videoSummaryCache').updateOne(
        { _id: video._id },
        {
          $set: {
            rawTranscriptRef: key,
            'summary.chapters': updatedChapters,
            generation: {
              model: 'unknown',
              promptVersion: 'pre-v1',
              generatedAt: video.processedAt || new Date()
            }
          }
        }
      );

      console.log(`✓ Backfilled ${video.youtubeId}`);

    } catch (error) {
      console.error(`✗ Failed ${video.youtubeId}:`, error.message);
    }
  }
}
```

---

## Verification Checklist

- [ ] Types updated in `@vie/types`
- [ ] `transcript-slicer` utility works correctly
- [ ] S3 client can upload/download JSON
- [ ] Summarizer stores full transcript to S3
- [ ] Summarizer attaches sliced transcript to each chapter
- [ ] MongoDB chapters include `transcript` field
- [ ] MongoDB VideoSummary includes `rawTranscriptRef`
- [ ] Regeneration service can regenerate from S3 transcript
- [ ] Migration script backfills existing videos
- [ ] LocalStack works for local development

---

## File Changes Summary

### New Files

```
packages/types/src/index.ts              # Update: add RawTranscript, GenerationMetadata
packages/utils/src/transcript-slicer.ts  # NEW: transcript slicing utility

api/src/services/s3.service.ts           # NEW: S3 client wrapper
api/src/services/transcript-store.service.ts  # NEW: transcript storage
api/src/services/video-regenerator.service.ts # NEW: regeneration service

services/summarizer/src/services/s3_client.py      # NEW: S3 client for Python
services/summarizer/src/utils/transcript_slicer.py # NEW: transcript slicing

scripts/backfill-transcripts.ts          # NEW: migration script
```

### Modified Files

```
packages/types/src/index.ts              # Add transcript to SummaryChapter
docker-compose.yml                       # Add LocalStack for dev S3
services/summarizer/src/services/llm.py  # Store transcript, attach to chapters
api/src/container.ts                     # Register new services
```

---

## Relationship to RAG Plan

This plan is a **prerequisite** for `PLAN-MEMORIZE-COLLECTIONS-RAG.md`:

- RAG needs chapter transcripts for embedding
- RAG can embed both blocks (LLM output) AND transcript (LLM input) for better search
- The vector embedding of transcripts is defined in the RAG plan

**Order of implementation:**
1. This plan (PLAN-TRANSCRIPT-STORAGE.md) - transcript persistence
2. PLAN-MEMORIZE-COLLECTIONS-RAG.md - vector embedding + RAG chat
