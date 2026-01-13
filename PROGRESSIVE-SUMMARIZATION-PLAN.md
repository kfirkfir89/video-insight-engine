# Progressive Video Summarization Implementation Plan

**Last Updated:** 2026-01-12

## Executive Summary

Refactor the video summarization pipeline to deliver content in 1-3 seconds (vs 30-60 seconds), reduce costs by ~40%, and extract richer metadata using yt-dlp. Key changes: use creator's chapters instead of AI-guessing sections, parallel processing with Haiku for extraction and Sonnet for analysis, and progressive streaming to frontend.

### Key Decisions
- **Haiku Model:** `claude-3-5-haiku-20241022` (newer, better at structured extraction)
- **Migration:** Optional fields only - new fields null for existing videos, only new videos get full data
- **Implementation:** Sequential phases - Phase 1-2 first (yt-dlp + Haiku), then parallel processing, then frontend

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER SUBMITS URL                          │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                 PHASE 1: INSTANT (~1 second)                     │
│                                                                  │
│  yt-dlp extracts (ONE call, no LLM):                            │
│  • Title, duration, thumbnail                                   │
│  • Chapters (creator's timestamps + titles)                     │
│  • Full description text                                        │
│  • Captions/transcript                                          │
│                                                                  │
│  → Return immediately to frontend                               │
└─────────────────────────────┬───────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
          ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│   PARALLEL A    │ │   PARALLEL B    │ │   PARALLEL C    │
│                 │ │                 │ │                 │
│ Description     │ │ TLDR + Takeways │ │ First Section   │
│ Analysis        │ │                 │ │ Summary         │
│                 │ │                 │ │                 │
│ Model: HAIKU    │ │ Model: SONNET   │ │ Model: SONNET   │
│ Time: ~1-2 sec  │ │ Time: ~2-3 sec  │ │ Time: ~3-5 sec  │
│                 │ │                 │ │                 │
│ Extract:        │ │ Input:          │ │ Input:          │
│ • Links/URLs    │ │ • Title         │ │ • Chapter title │
│ • Resources     │ │ • Description   │ │ • Transcript    │
│ • Related vids  │ │ • Chapter names │ │   segment       │
│ • Timestamps    │ │                 │ │                 │
└────────┬────────┘ └────────┬────────┘ └────────┬────────┘
         │                   │                   │
         │                   │                   │
         ▼                   ▼                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                    STREAM TO FRONTEND                            │
│                                                                  │
│  As each completes → Send via WebSocket/SSE                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              PHASE 3: REMAINING SECTIONS (Background)            │
│                                                                  │
│  Process sections 2, 3, 4... in parallel (2-3 at a time)        │
│  Stream each as it completes                                    │
│  Model: SONNET                                                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Current State Analysis

### What We Have Today

| Component | Current Implementation | Limitation |
|-----------|----------------------|------------|
| **Metadata** | oEmbed API (separate call) | Limited: title, channel, thumbnail only |
| **Transcript** | youtube-transcript-api | No chapters, no description, duration sometimes wrong |
| **Sections** | AI-detected via LLM | Slow (~10 sec), guesses boundaries, unreliable |
| **Description** | Not used | Missing links, resources, related videos |
| **Processing** | Sequential phases | 30-60 sec before meaningful content |
| **Models** | All Sonnet | Expensive for simple extraction tasks |

### Current Flow (`services/summarizer/`)
```
POST /summarize → Background task
  1. Fetch metadata (oEmbed)
  2. Fetch transcript (youtube-transcript-api)
  3. Detect sections (Sonnet LLM) ~10 sec
  4. Summarize each section (Sonnet) ~20 sec
  5. Extract concepts (Sonnet) ~5 sec
  6. Synthesize TLDR (Sonnet) ~5 sec
  → Total: 30-60 seconds
```

---

## Proposed Architecture

### New Flow with yt-dlp

```
Phase 1: INSTANT (~1 sec)
├── yt-dlp extracts everything in ONE call:
│   • Title, duration (exact), thumbnail
│   • Creator's chapters (timestamps + titles)
│   • Full description text
│   • Captions/transcript with timestamps
└── Return immediately to frontend

Phase 2: PARALLEL (~2-3 sec)
├── A: Description Analysis (HAIKU) ~1-2 sec
│   └── Extract links, resources, related videos
├── B: TLDR + Takeaways (SONNET) ~2-3 sec
│   └── From title + description + chapter names only
└── C: First Section Summary (SONNET) ~3-5 sec
    └── Chapter 1 transcript segment

Phase 3: BACKGROUND (stream as ready)
└── Remaining sections processed in parallel (2-3 at a time)
    └── Each streamed to frontend as completed
```

### Cost Comparison

| Task | Before | After | Savings |
|------|--------|-------|---------|
| Description extraction | N/A | Haiku ~$0.0005 | N/A |
| TLDR | Sonnet (full transcript) | Sonnet (metadata only) | ~70% |
| Sections | AI-detect + summarize | Just summarize chapters | ~30% |
| **Total per video** | ~$0.09 | ~$0.06 | **~35%** |

---

## Model Usage Strategy

| Task | Model | Why | Time |
|------|-------|-----|------|
| Extract links from description | **Haiku** | Pattern matching, structured output | ~1 sec |
| Parse resources/references | **Haiku** | Simple extraction | ~1 sec |
| Identify related videos in description | **Haiku** | Find YouTube URLs/titles | ~1 sec |
| TLDR generation | **Sonnet** | Needs understanding | ~2-3 sec |
| Key takeaways | **Sonnet** | Needs synthesis | ~2-3 sec |
| Section summaries | **Sonnet** | Needs context analysis | ~3-5 sec |
| Concept extraction | **Sonnet** | Needs deep understanding | ~3-5 sec |

---

## Data Extraction with yt-dlp

### What yt-dlp Gives Us (One Call)

| Field | Use |
|-------|-----|
| `title` | Video title |
| `duration` | Exact length in seconds (fixes timestamp bug!) |
| `thumbnail` | Best quality thumbnail URL |
| `description` | Full description text |
| `chapters` | Array of {start_time, end_time, title} |
| `subtitles` | Captions with timestamps |
| `channel` | Channel name |
| `upload_date` | When published |

### Chapters Format from yt-dlp

```python
chapters: [
  { "start_time": 0, "end_time": 150, "title": "Introduction" },
  { "start_time": 150, "end_time": 480, "title": "Getting Started" },
  { "start_time": 480, "end_time": 900, "title": "Advanced Topics" }
]
```

**Use these directly as sections!** No AI guessing needed.

### yt-dlp Proxy Configuration

```python
# Use existing Webshare proxy credentials from config.py
ydl_opts = {
    'proxy': f'http://{settings.WEBSHARE_PROXY_USERNAME}:{settings.WEBSHARE_PROXY_PASSWORD}@proxy.webshare.io:80',
    'skip_download': True,
    'writesubtitles': True,
    'writeautomaticsub': True,
    # ... other options
}
```

**Important:** Use existing proxy credentials from `config.py`:
- `WEBSHARE_PROXY_USERNAME`
- `WEBSHARE_PROXY_PASSWORD`

Same Webshare account already configured for youtube-transcript-api.

---

## Description Analysis (Haiku)

### Input to Haiku

Send only the description text.

### Output Structure

```json
{
  "links": [
    { "url": "https://github.com/...", "type": "github", "label": "Source Code" },
    { "url": "https://docs.example.com", "type": "documentation", "label": "Docs" }
  ],
  "resources": [
    { "name": "React Documentation", "url": "..." },
    { "name": "Course materials", "url": "..." }
  ],
  "relatedVideos": [
    { "title": "Part 2: Advanced Patterns", "url": "youtube.com/..." },
    { "title": "Previous video", "url": "..." }
  ],
  "timestamps": [
    { "time": "0:00", "label": "Intro" },
    { "time": "2:30", "label": "Setup" }
  ],
  "socialLinks": [
    { "platform": "twitter", "url": "..." },
    { "platform": "discord", "url": "..." }
  ]
}
```

---

## TLDR Generation (Sonnet)

### Input

Minimal context (saves tokens):
- Title
- Description (first 500 chars or summary from Haiku)
- Chapter titles only (not full transcript)

### Output

```json
{
  "tldr": "2-3 sentence summary",
  "keyTakeaways": ["Point 1", "Point 2", "Point 3"]
}
```

**Fast because:** No transcript processing, just metadata

---

## Section Summaries (Sonnet)

### For Each Chapter

**Input:**
- Chapter title (from yt-dlp)
- Transcript segment (only text between start_time and end_time)
- Video context (title, what came before)

**Output:**
```json
{
  "summary": "Paragraph summary",
  "bullets": ["Key point 1", "Key point 2"],
  "concepts": [{ "name": "...", "definition": "..." }]
}
```

### Parallel Processing

Process 2-3 sections at a time. Don't wait for one to finish before starting next.

---

## Progressive Frontend Updates

### WebSocket/SSE Events

| Event | When | Data |
|-------|------|------|
| `metadata` | Immediately | Title, duration, thumbnail, chapters |
| `description_analysis` | ~1 sec | Links, resources, related videos |
| `tldr` | ~2-3 sec | TLDR + takeaways |
| `section_ready` | ~3-5 sec each | Section summary (by index) |
| `complete` | When all done | Final status |

### Frontend Rendering

```
1. Show video card with title, thumbnail, duration (instant)
2. Show chapter list with timestamps (instant)
3. Fill in resources/links (1 sec)
4. Fill in TLDR section (2-3 sec)
5. Fill in section summaries one by one (3-5 sec each)
```

---

## Implementation Phases

### Phase 1: yt-dlp Integration
**Goal:** Replace youtube-transcript-api with yt-dlp for richer metadata

**Files to modify:**
- `services/summarizer/requirements.txt` - Add yt-dlp
- `services/summarizer/src/services/youtube.py` - NEW: yt-dlp extraction
- `services/summarizer/src/services/transcript.py` - Adapt to use yt-dlp output

**Key changes:**
```python
# New youtube.py service
async def extract_video_data(video_id: str) -> VideoData:
    """
    Single yt-dlp call returns:
    - title, channel, duration (exact seconds)
    - thumbnailUrl (best quality)
    - chapters: [{start_time, end_time, title}]
    - description: full text
    - subtitles: captions with timestamps
    """
```

---

### Phase 2: Description Analyzer (Haiku)
**Goal:** Fast extraction of structured data from description

**Files to modify:**
- `services/summarizer/src/services/description_analyzer.py` - NEW
- `services/summarizer/src/prompts/description_analysis.txt` - NEW

---

### Phase 3: Parallel Processing Pipeline
**Goal:** Run description analysis, TLDR, and first section in parallel

**Files to modify:**
- `services/summarizer/src/services/llm.py` - Add parallel orchestration
- `services/summarizer/src/services/summarizer_service.py` - Refactor for phases

**New processing flow:**
```python
async def process_video_progressive(video_id: str):
    # Phase 1: Instant metadata
    video_data = await youtube.extract_video_data(video_id)
    yield StreamEvent("metadata", video_data.metadata)
    yield StreamEvent("chapters", video_data.chapters)

    # Phase 2: Parallel processing
    tasks = [
        description_analyzer.analyze(video_data.description),  # Haiku
        llm.generate_tldr(video_data.metadata_only),           # Sonnet
        llm.summarize_section(video_data.sections[0]),         # Sonnet
    ]

    for coro in asyncio.as_completed(tasks):
        result = await coro
        yield StreamEvent(result.type, result.data)

    # Phase 3: Remaining sections
    for section in video_data.sections[1:]:
        summary = await llm.summarize_section(section)
        yield StreamEvent("section_ready", summary)
```

---

### Phase 4: Database Schema Updates
**Goal:** Store new fields for chapters, resources, description analysis

**Files to modify:**
- `docs/DATA-MODELS.md` - Document new fields
- `services/summarizer/src/repositories/mongodb_repository.py` - Update save logic

**New fields in videoSummaryCache:**
```javascript
{
  // Existing fields...

  // NEW: Raw chapter data from yt-dlp
  chapters: [{
    startSeconds: number,
    endSeconds: number,
    title: string,
    isCreatorChapter: boolean  // vs AI-generated
  }],

  // NEW: Description analysis (from Haiku)
  descriptionAnalysis: {
    links: [{url, type, label}],
    resources: [{name, url}],
    relatedVideos: [{title, url}],
    timestamps: [{time, label}],
    socialLinks: [{platform, url}]
  },

  // NEW: Processing status per phase
  processingStatus: {
    metadata: "completed",
    descriptionAnalysis: "completed",
    tldr: "completed",
    sections: {
      "0": "completed",
      "1": "processing",
      "2": "pending"
    }
  }
}
```

---

### Phase 5: API SSE Updates
**Goal:** New event types for progressive streaming

**Files to modify:**
- `api/src/routes/stream.routes.ts` - Handle new event types
- `api/src/services/video.service.ts` - Update response structure

**New SSE events:**
```javascript
// Phase 1: Instant
data: {"event": "metadata", "data": {title, duration, thumbnail, channel}}
data: {"event": "chapters", "data": [{start, end, title}]}

// Phase 2: Parallel results
data: {"event": "description_analysis", "data": {links, resources, ...}}
data: {"event": "tldr", "data": {tldr, keyTakeaways}}
data: {"event": "section_ready", "data": {index: 0, ...section}}

// Phase 3: Remaining sections
data: {"event": "section_ready", "data": {index: 1, ...section}}
data: {"event": "section_ready", "data": {index: 2, ...section}}

// Done
data: {"event": "complete", "data": {processingTimeMs}}
data: [DONE]
```

---

### Phase 6: Frontend Progressive UI
**Goal:** Display content progressively as it arrives

**Files to modify:**
- `apps/web/src/hooks/use-summary-stream.ts` - Handle new events
- `apps/web/src/pages/VideoDetailPage.tsx` - Progressive rendering
- `apps/web/src/components/video-detail/ChapterList.tsx` - NEW
- `apps/web/src/components/video-detail/ResourcesPanel.tsx` - NEW

**UI progression:**
```
0 sec: Video card with title, thumbnail, duration (instant)
1 sec: Chapter list with timestamps (clickable)
2 sec: Resources/links panel populated
3 sec: TLDR + key takeaways appear
5 sec: First section summary fills in
8 sec: Second section...
...continues until complete
```

**New StreamState fields:**
```typescript
interface StreamState {
  // Existing...
  chapters: Chapter[];           // From yt-dlp
  descriptionAnalysis: {
    links: Link[];
    resources: Resource[];
    relatedVideos: RelatedVideo[];
  };
  sectionStatuses: Map<number, 'pending' | 'processing' | 'completed'>;
}
```

---

## Fallback: Videos Without Chapters

If yt-dlp returns no chapters:

1. **Check description for timestamps** (Haiku extracts these)
2. **If found** → Convert to chapters
3. **If not found** → Fall back to AI section detection (Sonnet, slower)
4. **Mark source**: `isCreatorChapter: false` for AI-generated

---

## Critical Files Summary

### Summarizer Service
| File | Action | Priority |
|------|--------|----------|
| `requirements.txt` | Add yt-dlp | P0 |
| `src/services/youtube.py` | NEW: yt-dlp extraction | P0 |
| `src/services/transcript.py` | Adapt for yt-dlp | P0 |
| `src/services/description_analyzer.py` | NEW: Haiku extraction | P1 |
| `src/prompts/description_analysis.txt` | NEW: Haiku prompt | P1 |
| `src/services/llm.py` | Parallel orchestration | P1 |
| `src/services/summarizer_service.py` | Progressive phases | P1 |
| `src/routes/stream.py` | New event types | P1 |

### API Service
| File | Action | Priority |
|------|--------|----------|
| `src/routes/stream.routes.ts` | Handle new events | P2 |
| `src/services/video.service.ts` | Updated response | P2 |

### Frontend
| File | Action | Priority |
|------|--------|----------|
| `src/hooks/use-summary-stream.ts` | New event handlers | P2 |
| `src/pages/VideoDetailPage.tsx` | Progressive rendering | P2 |
| `src/components/video-detail/ChapterList.tsx` | NEW component | P2 |
| `src/components/video-detail/ResourcesPanel.tsx` | NEW component | P2 |

---

## Implementation Order (Sequential)

### Sprint 1: yt-dlp Foundation
1. Add yt-dlp to requirements.txt
2. Create `youtube.py` service with `extract_video_data()`
3. Configure Webshare proxy (same creds as youtube-transcript-api)
4. Update `transcript.py` to use yt-dlp subtitles
5. Test: Verify chapters, duration, description extraction
6. Update SSE to stream metadata + chapters immediately

### Sprint 2: Haiku Description Analyzer
1. Create `description_analyzer.py` service
2. Create `description_analysis.txt` prompt
3. Add Haiku model configuration
4. Integrate into streaming pipeline (parallel with existing flow)
5. Test: Verify links/resources extraction

### Sprint 3: Parallel Processing
1. Refactor `summarizer_service.py` for parallel phases
2. Update LLM service for metadata-only TLDR
3. Implement `asyncio.gather()` for Phase 2 tasks
4. Test: Verify parallel execution, error isolation

### Sprint 4: Database & API Updates
1. Add new fields to MongoDB schema (optional/nullable)
2. Update repository save logic
3. Add new SSE event types to API
4. Test: Verify backward compatibility

### Sprint 5: Frontend Progressive UI
1. Update `use-summary-stream.ts` for new events
2. Create `ChapterList.tsx` component
3. Create `ResourcesPanel.tsx` component
4. Update `VideoDetailPage.tsx` for progressive rendering
5. E2E test: Full flow from URL to progressive display

---

## Verification Plan

### Unit Tests
- [ ] yt-dlp extraction returns expected fields
- [ ] Haiku description analysis produces valid JSON
- [ ] Parallel processing completes all tasks
- [ ] Fallback triggers when no chapters

### Integration Tests
- [ ] SSE stream includes all new event types
- [ ] Frontend receives and displays progressive updates
- [ ] Database stores new fields correctly
- [ ] Cached videos return all new fields

### E2E Tests
- [ ] Video with chapters: instant display, progressive fill
- [ ] Video without chapters: fallback to AI detection
- [ ] Video with rich description: resources extracted
- [ ] Video with no description: graceful handling

### Manual Verification
1. Add video with known chapters → Verify chapters display instantly
2. Add video with links in description → Verify resources panel populates
3. Compare processing time: before vs after
4. Verify cost tracking shows Haiku vs Sonnet usage

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| yt-dlp rate limiting | Respect YouTube TOS, add delays if needed |
| yt-dlp output format changes | Pin version, add schema validation |
| Haiku output inconsistency | Add JSON parsing fallback |
| Parallel processing failures | Independent error handling per task |
| Migration of existing data | Backward compatible schema (new fields optional) |

---

## Success Metrics

| Metric | Before | Target | How to Measure |
|--------|--------|--------|----------------|
| Time to first content | 30-60 sec | 1-3 sec | Frontend timestamp logs |
| Cost per video | ~$0.09 | ~$0.06 | Token usage tracking |
| Section accuracy | AI-guessed | Creator-defined | Manual review |
| Resource extraction | 0% | 80%+ descriptions | Spot checks |
