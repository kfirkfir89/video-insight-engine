# Architecture

System overview and data flows.

---

## System Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                vie-web                                       │
│                          React + Vite + TypeScript                           │
│                               Port: 5173                                     │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │ HTTP / WebSocket
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                                vie-api                                       │
│                        Node.js + Fastify + TypeScript                        │
│                               Port: 3000                                     │
│                                                                              │
│  • REST API for frontend                                                     │
│  • MCP Client (connects to vie-explainer)                                    │
│  • HTTP calls to vie-summarizer                                              │
│  • WebSocket for real-time updates                                           │
└──────────┬─────────────────────────────────────────────────┬────────────────┘
           │                                                  │
           │ HTTP POST                                        │ MCP Protocol
           ▼                                                  ▼
┌────────────────────┐  ┌───────────────────┐  ┌─────────────────────────────┐
│   vie-summarizer   │  │   vie-mongodb     │  │      vie-explainer           │
│  Python + FastAPI  │  │    MongoDB 7      │  │    Python + MCP SDK         │
│    Port: 8000      │  │   Port: 27017     │  │      Port: 8001             │
│                    │  │                   │  │                             │
│ • Receive HTTP req │  │ System Cache:     │  │ MCP Tools:                  │
│ • Fetch transcript │  │ • videoSummaryCache│ │ • explain_auto (cached)      │
│ • Process with LLM │  │ • systemExpansion │  │ • explain_chat (per-user)    │
│ • Save to cache    │  │   Cache           │  │                             │
│                    │  │                   │  │                             │
└─────────┬──────────┘  │ User Data:        │  └─────────────────────────────┘
          │             │ • users           │
          │             │ • folders         │
          │             │ • userVideos      │
          │             │ • memorizedItems  │
          │             │ • userChats       │
          └────────────►└───────────────────┘
```

---

## Service Communication

| From           | To             | Protocol       | Purpose                     |
| -------------- | -------------- | -------------- | --------------------------- |
| vie-web        | vie-api        | HTTP/WS        | API calls, status updates   |
| vie-api        | vie-mongodb    | MongoDB driver | Data operations             |
| vie-api        | vie-summarizer | HTTP POST      | Trigger summarization       |
| vie-api        | vie-explainer  | **MCP**        | Call explain tools          |
| vie-summarizer | vie-mongodb    | MongoDB driver | Save to cache               |
| vie-summarizer | Claude API     | HTTP           | LLM generation              |
| vie-explainer  | vie-mongodb    | MongoDB driver | Cache + chats               |
| vie-explainer  | Claude API     | HTTP           | LLM generation              |

---

## Data Flows

### 1. Video Summarization

```
User submits YouTube URL
         │
         ▼
┌─────────────────────┐
│ vie-api checks      │
│ videoSummaryCache   │
└──────────┬──────────┘
           │
    ┌──────┴──────┐
    │             │
  HIT           MISS
    │             │
    ▼             ▼
 Create      POST /summarize
 userVideo   to vie-summarizer
 reference        │
    │             ▼
    │    ┌────────────────┐
    │    │ vie-summarizer │
    │    │                │
    │    │ 1. Transcript  │
    │    │ 2. LLM process │
    │    │ 3. Save cache  │
    │    └───────┬────────┘
    │            │
    │     Status: done
    │     (DB update)
    │            │
    └─────┬──────┘
          │
          ▼
    User sees summary
    (via polling or WebSocket)
```

### 2. Explain Auto (Cached)

```
User clicks "Explain" on section
         │
         ▼
┌─────────────────────┐
│ vie-api calls MCP   │
│ explain_auto tool    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ vie-explainer checks │
│ systemExpansionCache│
└──────────┬──────────┘
           │
    ┌──────┴──────┐
    │             │
  HIT           MISS
    │             │
    ▼             ▼
 Return       Generate
 cached       with LLM
    │             │
    │        Save to cache
    │             │
    └──────┬──────┘
           │
           ▼
     Return expansion
```

### 3. Explain Chat (Not Cached)

```
User sends message on memorized item
         │
         ▼
┌─────────────────────┐
│ vie-api calls MCP   │
│ explain_chat tool    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ vie-explainer:       │
│ 1. Load context     │
│ 2. Load chat history│
│ 3. Call Claude API  │
│ 4. Save to userChats│
└──────────┬──────────┘
           │
           ▼
     Return response
     (never cached)
```

### 4. Memorize

```
User clicks "Memorize"
         │
         ▼
┌─────────────────────┐
│ vie-api:            │
│ 1. Load from cache  │
│ 2. Copy content     │
│ 3. Create item      │
└──────────┬──────────┘
           │
           ▼
   Item in Memorized tab
   (independent copy)
```

---

## Persona Detection Flow

Persona is determined **immediately from yt-dlp metadata** (NOT from LLM). This is fast, consistent, and free.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PERSONA DETECTION FLOW                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. yt-dlp extracts video metadata                                         │
│     │                                                                       │
│     ├── title: "React Tutorial for Beginners"                              │
│     ├── description: "#react #javascript #webdev..."                       │
│     ├── categories: ["Science & Technology"]                               │
│     └── tags: ["react", "javascript", "tutorial", "coding"]                │
│                                                                             │
│  2. extract_video_context() is called                                      │
│     │                                                                       │
│     ├── _extract_hashtags(description) → ["react", "javascript", "webdev"] │
│     │                                                                       │
│     └── _determine_persona(category, tags, hashtags)                       │
│         │                                                                   │
│         ├── Load rules from: prompts/detection/persona_rules.json          │
│         │                                                                   │
│         ├── Check CODE persona:                                            │
│         │   - Category "Science & Technology" matches? ✓                   │
│         │   - Tags/hashtags match keywords? ✓ ("react", "javascript")      │
│         │   - RESULT: "code" persona                                       │
│         │                                                                   │
│         └── Return: "code"                                                  │
│                                                                             │
│  3. VideoContext created and passed to LLM prompts                         │
│     VideoContext(persona="code", displayTags=["React", "JavaScript"...])   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Persona Mapping Rules

| Category | Keywords | Persona |
|----------|----------|---------|
| Science & Technology | programming, coding, react, python, api, github... | `code` |
| Science & Technology | (no code keywords) | `tech` |
| Howto & Style | recipe, cooking, food, chef, meal, kitchen... | `recipe` |
| Education | (any) | `educational` |
| (other) | (any) | `standard` |

---

## SSE Streaming Pipeline

The summarization pipeline uses Server-Sent Events (SSE) to stream results progressively.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    STREAMING PHASES (SSE Events)                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  PHASE 1: INSTANT (~1-3 seconds)                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  yt-dlp Extraction (single call, no LLM)                            │   │
│  │                                                                      │   │
│  │  Output events:                                                      │   │
│  │    - metadata (title, channel, thumbnail, duration)                 │   │
│  │    - chapters (if creator chapters exist)                            │   │
│  │    - sponsor_segments (SponsorBlock API)                             │   │
│  │    - transcript_ready                                                │   │
│  │    - VideoContext with PERSONA (code/recipe/standard)                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  PHASE 2: PARALLEL ANALYSIS (~2-5 seconds)                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Three tasks run simultaneously using asyncio.gather():              │   │
│  │                                                                      │   │
│  │  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐     │   │
│  │  │ Task A: Desc     │ │ Task B: TLDR     │ │ Task C: First    │     │   │
│  │  │ Analysis         │ │ Generation       │ │ Section          │     │   │
│  │  │ (Haiku ~1-2s)    │ │ (Sonnet ~2-3s)   │ │ (Sonnet ~3-5s)   │     │   │
│  │  └──────────────────┘ └──────────────────┘ └──────────────────┘     │   │
│  │                                                                      │   │
│  │  Output events: description_analysis, synthesis_complete,            │   │
│  │                 section_ready (index 0)                              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  PHASE 3: SECTION SUMMARIES (progressive, ~3-5s per batch)                 │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Process remaining sections in batches (SECTION_BATCH_SIZE = 3)     │   │
│  │                                                                      │   │
│  │  Batch 1: Sections 2-4 (parallel) → section_ready events            │   │
│  │  Batch 2: Sections 5-7 (parallel) → section_ready events            │   │
│  │  ...                                                                 │   │
│  │                                                                      │   │
│  │  Each section uses PERSONA for content block styling                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  PHASE 4: CONCEPTS (~3-5 seconds)                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Extract key concepts from timestamped transcript                   │   │
│  │  Output event: concepts_complete                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  PHASE 5: SAVE & DONE                                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  - Save complete result to MongoDB                                  │   │
│  │  - Emit "done" event with processingTimeMs                          │   │
│  │  - Emit "[DONE]" to close SSE stream                                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### LLM Calls Summary

For a typical 10-section video:

| Phase | Model | Calls | Parallel? |
|-------|-------|-------|-----------|
| Phase 2 | Haiku | 1 (description) | Yes |
| Phase 2 | Sonnet | 1 (TLDR) | Yes |
| Phase 2 | Sonnet | 1 (first section) | Yes |
| Phase 3 | Sonnet | 9 (remaining sections) | Batched (3) |
| Phase 4 | Sonnet | 1 (concepts) | No |

**Total: ~13 LLM calls, ~20-30 seconds**

---

## Network Topology

```
┌─────────────────────────────────────────────────────────────────┐
│                   vie-network (Docker bridge)                    │
│                                                                  │
│  ┌───────────┐  ┌───────────┐  ┌─────────────┐  ┌────────────┐ │
│  │ vie-web   │  │ vie-api   │  │vie-summarizer│ │vie-explainer│ │
│  │  :5173    │  │  :3000    │  │   :8000     │  │   :8001    │ │
│  └─────┬─────┘  └─────┬─────┘  └──────┬──────┘  └─────┬──────┘ │
│        │              │               │                │        │
│        └──────────────┼───────────────┼────────────────┘        │
│                       │               │                         │
│                       ▼               │                         │
│                ┌─────────────┐        │                         │
│                │ vie-mongodb │◄───────┘                         │
│                │   :27017    │                                   │
│                └─────────────┘                                   │
└─────────────────────────────────────────────────────────────────┘

Exposed ports:
  - 5173  → Frontend
  - 3000  → API
```
