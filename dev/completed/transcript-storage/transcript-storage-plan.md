# Transcript Storage System - Implementation Plan

> **Last Updated:** 2026-02-05
> **Priority:** High - Prerequisite for PLAN-MEMORIZE-COLLECTIONS-RAG.md
> **Services:** `api/` (vie-api), `services/summarizer/` (vie-summarizer), `packages/types/`

---

## Executive Summary

Implement transcript persistence at two levels:
1. **Chapter-level transcripts** — Store the raw transcript slice for each chapter in MongoDB
2. **Full raw transcript in S3** — Store the complete transcript for regeneration without re-fetching from YouTube

This enables:
- Block regeneration when prompts improve (without calling YouTube again)
- Transcript display alongside generated content
- Debug/audit trail for LLM input vs output
- Future RAG integration with chapter-level embedding

---

## Current State Analysis

### What Already Exists (Good News!)

| Component | Status | Location |
|-----------|--------|----------|
| `TranscriptSegment` type | ✅ Ready | `packages/types/src/index.ts:29-35` |
| `TranscriptSource` type | ✅ Ready | `packages/types/src/index.ts:29` |
| `transcriptSegments` in MongoDB | ✅ Stored | `videoSummaryCache` collection |
| Segment normalization to ms | ✅ Working | `services/summarizer/src/services/transcript.py` |
| Chapter with startSeconds/endSeconds | ✅ Ready | `SummaryChapter` type |

### What's Missing

| Component | Needed For |
|-----------|------------|
| `transcript` field in `SummaryChapter` | Display transcript per chapter |
| `RawTranscript` type | S3 storage structure |
| `GenerationMetadata` type | Track prompt versions |
| `rawTranscriptRef` in `VideoSummary` | Reference to S3 transcript |
| S3 client service | Transcript persistence |
| Transcript slicer utility | Per-chapter transcript extraction |
| Regeneration service | Regenerate from stored transcripts |

---

## Proposed Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                      Transcript Flow                              │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  1. YouTube API                                                   │
│       │                                                           │
│       ▼                                                           │
│  2. vie-summarizer fetches transcript                             │
│       │                                                           │
│       ├──────────────────────┐                                    │
│       │                      │                                    │
│       ▼                      ▼                                    │
│  3a. Store in S3         3b. Normalize segments                   │
│      (full transcript)       (to milliseconds)                    │
│       │                      │                                    │
│       │                      ▼                                    │
│       │              4. Slice per chapter                         │
│       │                      │                                    │
│       │                      ▼                                    │
│       │              5. Generate summary                          │
│       │                 (LLM processing)                          │
│       │                      │                                    │
│       ▼                      ▼                                    │
│  6. Save rawTranscriptRef + chapters with transcript to MongoDB   │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                    Regeneration Flow                              │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  1. Request regeneration (video_id, prompt_version)               │
│       │                                                           │
│       ▼                                                           │
│  2. Load rawTranscriptRef from MongoDB                            │
│       │                                                           │
│       ▼                                                           │
│  3. Fetch full transcript from S3                                 │
│       │                                                           │
│       ▼                                                           │
│  4. Slice per chapter (using existing startSeconds/endSeconds)    │
│       │                                                           │
│       ▼                                                           │
│  5. Re-run LLM with new prompts                                   │
│       │                                                           │
│       ▼                                                           │
│  6. Update MongoDB (new chapters, new generation metadata)        │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

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
  transcript?: string;
}
```

### 2. Add New Types

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
  rawTranscriptRef?: string | null;  // "transcripts/{youtubeId}.json"

  // NEW: Generation metadata for tracking/regeneration
  generation?: GenerationMetadata;
}
```

---

## Implementation Phases

### Phase 1: Types & Utilities (Effort: S)

**Goal:** Add type definitions and utility functions without changing runtime behavior.

**Tasks:**
1. Update `SummaryChapter` type to add optional `transcript` field
2. Add `RawTranscript` type
3. Add `GenerationMetadata` type
4. Update `VideoSummary` type with `rawTranscriptRef` and `generation`
5. Create transcript slicer utility in summarizer
6. Export new types from `@vie/types`

**Acceptance Criteria:**
- [ ] Types compile without errors
- [ ] No breaking changes to existing code
- [ ] Utility function has unit tests

### Phase 2: S3 Infrastructure (Effort: M)

**Goal:** Set up S3 client for transcript storage with LocalStack for dev.

**Tasks:**
1. Add LocalStack to docker-compose for local S3
2. Add S3 config to summarizer settings
3. Create S3 client service in summarizer (Python with aioboto3)
4. Add health check for S3 connectivity
5. Test S3 upload/download with LocalStack

**Acceptance Criteria:**
- [ ] LocalStack starts with docker-compose
- [ ] S3 client can upload/download JSON
- [ ] Config supports both LocalStack (dev) and real S3 (prod)
- [ ] Connection errors are handled gracefully

### Phase 3: Transcript Storage Integration (Effort: L)

**Goal:** Integrate transcript storage into summarizer pipeline.

**Tasks:**
1. Update transcript service to store full transcript in S3 after fetch
2. Create transcript slicer to extract chapter-specific text
3. Update summarization pipeline to attach sliced transcript to chapters
4. Update MongoDB save to include `rawTranscriptRef` and `generation`
5. Add error handling for S3 failures (graceful degradation)

**Acceptance Criteria:**
- [ ] New videos have `rawTranscriptRef` pointing to S3
- [ ] Each chapter has `transcript` field with relevant text
- [ ] `generation` metadata tracks model and prompt version
- [ ] S3 failure doesn't block summarization (warns, continues)

### Phase 4: Regeneration Service (Effort: L)

**Goal:** Enable regenerating summaries from stored transcripts.

**Tasks:**
1. Create regeneration endpoint in summarizer (`POST /regenerate`)
2. Implement single video regeneration from S3 transcript
3. Create bulk regeneration service with batching
4. Add API endpoint in vie-api to trigger regeneration
5. Add rate limiting and progress tracking

**Acceptance Criteria:**
- [ ] Can regenerate single video without calling YouTube
- [ ] Bulk regeneration processes in batches with delays
- [ ] Progress is trackable (succeeded/failed counts)
- [ ] New `generation` metadata reflects new prompt version

### Phase 5: Migration & Backfill (Effort: M)

**Goal:** Backfill existing videos with transcript storage.

**Tasks:**
1. Create migration script to identify videos with `transcriptSegments`
2. Upload existing transcripts to S3
3. Slice and attach transcripts to existing chapters
4. Update MongoDB with `rawTranscriptRef` and `generation`
5. Verify migration success with spot checks

**Acceptance Criteria:**
- [ ] All existing videos with segments have S3 reference
- [ ] All chapters have transcript field populated
- [ ] Migration is idempotent (safe to re-run)
- [ ] Logging shows progress and any failures

---

## Technical Decisions

### Why S3 for Full Transcripts?

| Option | Pros | Cons | Decision |
|--------|------|------|----------|
| MongoDB | Single data store, simpler | Large documents, memory pressure | ❌ |
| S3 | Cheap, scalable, good for large blobs | Additional infrastructure | ✅ |
| Filesystem | Simplest | Not scalable, no redundancy | ❌ |

**Decision:** S3 with LocalStack for dev. Transcripts can be large (10-100KB+ each), and S3 is designed for this workload.

### Why LocalStack for Development?

- No AWS account needed for local dev
- Same API as real S3
- Easy docker-compose integration
- Free and fast

### Why Optional Fields?

Making `transcript`, `rawTranscriptRef`, and `generation` optional ensures:
- Backward compatibility with existing data
- Graceful handling of S3 failures
- Gradual migration without downtime

### Transcript Slicing Strategy

**Approach:** Use segment `startMs`/`endMs` to filter segments within chapter boundaries.

```python
def slice_transcript_for_chapter(
    segments: list[TranscriptSegment],
    start_seconds: int,
    end_seconds: int
) -> str:
    start_ms = start_seconds * 1000
    end_ms = end_seconds * 1000

    return ' '.join(
        seg.text for seg in segments
        if seg.startMs >= start_ms and seg.startMs < end_ms
    ).strip()
```

This preserves natural speech boundaries while ensuring complete chapter coverage.

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| S3 unavailable during summarization | Low | Medium | Graceful degradation - continue without S3, log warning |
| Large transcripts cause memory issues | Low | High | Stream to S3, don't load full transcript in memory |
| Migration corrupts existing data | Low | High | Run in dry-run mode first, backup before migration |
| LocalStack differs from real S3 | Medium | Low | Test against real S3 in staging |
| Prompt version tracking becomes complex | Medium | Medium | Start simple (string version), enhance later if needed |

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| S3 upload success rate | >99.9% | Count failures in logs |
| Regeneration time per video | <30s | Measure end-to-end |
| Migration completion | 100% | Count videos with `rawTranscriptRef` |
| No regression in summarization | 0 failures | Compare before/after |

---

## Dependencies

### External
- AWS S3 (or LocalStack for dev)
- aioboto3 (Python async S3 client)

### Internal
- Existing transcript normalization in summarizer
- MongoDB repository layer
- Docker Compose infrastructure

### Downstream (What This Enables)
- **PLAN-MEMORIZE-COLLECTIONS-RAG.md** - Needs chapter transcripts for embedding
- Future transcript search feature
- Debugging and audit capabilities

---

## File Changes Summary

### New Files

| File | Purpose |
|------|---------|
| `services/summarizer/src/services/s3_client.py` | S3 client for Python |
| `services/summarizer/src/services/transcript_store.py` | Transcript storage service |
| `services/summarizer/src/utils/transcript_slicer.py` | Slicing utility |
| `services/summarizer/src/routes/regenerate.py` | Regeneration endpoint |
| `scripts/backfill-transcripts.ts` | Migration script |

### Modified Files

| File | Changes |
|------|---------|
| `packages/types/src/index.ts` | Add new types, update existing |
| `docker-compose.yml` | Add LocalStack service |
| `services/summarizer/src/config.py` | Add S3 config |
| `services/summarizer/src/services/llm.py` | Store transcript, attach to chapters |
| `services/summarizer/src/main.py` | Register regenerate router |
| `docs/DATA-MODELS.md` | Document new fields |

---

## Relationship to RAG Plan

This plan is a **prerequisite** for `PLAN-MEMORIZE-COLLECTIONS-RAG.md`:

```
PLAN-TRANSCRIPT-STORAGE.md (THIS)
        │
        │ Provides chapter transcripts
        │
        ▼
PLAN-MEMORIZE-COLLECTIONS-RAG.md
        │
        │ Embeds transcripts + blocks
        │
        ▼
    RAG Chat Feature
```

RAG needs:
- Chapter transcripts for semantic embedding
- Both blocks (LLM output) AND transcript (LLM input) for comprehensive search
- `rawTranscriptRef` for full-text retrieval
