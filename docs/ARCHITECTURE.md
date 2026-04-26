# Architecture

System overview and data flows.

---

## System Diagram

```
┌───────────────────────────────────────────────────────────────────┐
│                         vie-web (React 19)                         │
│  Tailwind v4 · shadcn/ui · 36 UI components · 16 interactives    │
│  ComposableOutput → COMPONENT_REGISTRY[tab.component] → render    │
│  VideoPlayerContext (seekTo) · SSE stream consumer                 │
└──────────────────────────┬────────────────────────────────────────┘
                           │ SSE (Server-Sent Events)
                           ↓
┌───────────────────────────────────────────────────────────────────┐
│                        vie-api (Node.js · Fastify)                 │
│  Routes · Auth · MongoDB CRUD · Orchestration                      │
└──────────────────────────┬────────────────────────────────────────┘
                           │ HTTP
                           ↓
┌───────────────────────────────────────────────────────────────────┐
│                    vie-summarizer (Python · FastAPI)                │
│  Pipeline: metadata → [transcript + frames] parallel               │
│           → plan (classifier + triage) → extraction                │
│           → synthesis → enrichment → assembly → [translation]      │
│  Storage: MongoDB + Redis (cache) + S3 (frames/transcripts)       │
│  Vector:  Qdrant (background embedding storage)                    │
└───────────────────────────────────────────────────────────────────┘
```

---

## Service Communication

| From           | To             | Protocol       | Purpose                          |
| -------------- | -------------- | -------------- | -------------------------------- |
| vie-web        | vie-api        | HTTP/SSE       | API calls, streaming updates     |
| vie-api        | vie-mongodb    | MongoDB driver | Data operations                  |
| vie-api        | vie-summarizer | HTTP POST      | Trigger summarization            |
| vie-api        | vie-assistant  | HTTP           | Explain + RAG video chat         |
| vie-summarizer | vie-mongodb    | MongoDB driver | Save structured results          |
| vie-summarizer | vie-redis      | Redis          | Response caching                 |
| vie-summarizer | vie-qdrant     | HTTP           | Vector storage (background)      |
| vie-summarizer | S3             | HTTP           | Frame + transcript storage       |
| vie-summarizer | LLM APIs       | HTTP           | LiteLLM (Anthropic/OpenAI/Google)|
| vie-assistant  | vie-mongodb    | MongoDB driver | Cache lookups                    |
| vie-assistant  | vie-qdrant     | HTTP           | RAG vector search                |
| vie-assistant  | LLM APIs       | HTTP           | LLM generation                   |

---

## Data Flows

### 1. Video Summarization

```
User submits YouTube URL
         │
         ▼
┌─────────────────────┐
│ vie-api checks      │
│ videoSummaryCache    │
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
    │    ┌────────────────────┐
    │    │ vie-summarizer     │
    │    │                    │
    │    │ 1. Redis cache chk │
    │    │    HIT → instant   │
    │    │    MISS → continue │
    │    │ 2. Transcript      │
    │    │ 3. Plan + extract  │
    │    │ 4. Assemble        │
    │    │ 5. Save cache      │
    │    └───────┬────────────┘
    │            │
    │     Status: done
    │     (DB + Redis update)
    │            │
    └─────┬──────┘
          │
          ▼
    User sees summary
    (via SSE stream)
```

### 2. Explain Auto (Cached)

```
User clicks "Explain" on section
         │
         ▼
┌─────────────────────┐
│ vie-api calls       │
│ vie-assistant HTTP  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ vie-assistant checks│
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

### 3. Video Chat (Ephemeral)

```
User sends message about video
         │
         ▼
┌─────────────────────┐
│ vie-api calls       │
│ vie-assistant HTTP  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ vie-assistant:       │
│ 1. RAG vector search│
│ 2. Build context    │
│ 3. Call LLM         │
└──────────┬──────────┘
           │
           ▼
     Return response
     (ephemeral, no persistence)
     Chat history in React state
```

---

## Pipeline Flow

Content type is determined by a **plan phase** that runs a classifier (fast model) concurrently with a plan LLM call to pick content tags and design tab layout.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PIPELINE FLOW                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. METADATA (yt-dlp, ~1-3s)                                              │
│     └── Title, channel, thumbnail, duration, chapters                      │
│                                                                             │
│  2. TRANSCRIPT + FRAMES (parallel, ~10-30s)                                │
│     ├── Transcript: S3 cache → yt-dlp → API → Gemini → Whisper           │
│     └── Frames: FFmpeg scene detect → score → select ~25 → S3 upload      │
│                                                                             │
│  2.5 VISUAL CONTEXT INJECTION (~0-1s)                                      │
│     └── [VISUAL at M:SS] annotations injected into transcript              │
│                                                                             │
│  3. CLASSIFIER + PLAN (concurrent, ~2-5s)                                  │
│     ├── Classifier: fast model, domain + format detection (non-blocking)   │
│     └── Plan: Sonnet call → contentTags, tab layout, extractionGuidance   │
│     ├── 10 primary tags: learning, tech, fitness, food, music, travel,    │
│     │   review, project, language, science                                 │
│     ├── 2 modifier tags: narrative, finance                                │
│     └── Classifier overrides category_hint when confidence > 0.6          │
│                                                                             │
│  4. EXTRACTION (1-5+ LLM calls, ~10-60s)                                  │
│     ├── Schema-injected: base_extraction.txt + schemas/{tag}.txt           │
│     ├── Short: single call; Long (>30min): chunked by chapters             │
│     ├── Pydantic validation + count check                                  │
│     └── Quality check: synthesis-fed retry if coverage < 0.6               │
│                                                                             │
│  5. SYNTHESIS (1 LLM call, ~5-10s)                                        │
│     └── TLDR, takeaways, master summary (fast model)                       │
│                                                                             │
│  6. ENRICHMENT (0-1 LLM call, ~5-10s)                                     │
│     └── Quiz + flashcards + scenarios (domains with enrichment mapping)    │
│                                                                             │
│  7. ASSEMBLY (pure code, <10ms)                                            │
│     ├── 17 assemblers in ASSEMBLER_REGISTRY                                │
│     ├── Extraction → TabEntry[] with component-addressed props             │
│     ├── Frame thumbnail injection                                          │
│     └── Cross-tab link resolution                                          │
│                                                                             │
│  8. TRANSLATION (non-English only, 1-2 LLM calls)                         │
│     ├── Translates assembled tabs + synthesis to English                   │
│     ├── Stores dual-language data (original + English)                     │
│     └── English Qdrant embeddings for cross-language RAG search            │
│                                                                             │
│  9. SAVE + STREAM COMPLETE                                                 │
│     ├── SSE: tab_ready events (progressive rendering)                      │
│     ├── Store to MongoDB (meta + tabs + language + isRTL)                  │
│     ├── Store to Redis (response cache)                                    │
│     └── SSE: complete + done + [DONE]                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Content Tag → Domain Schema

| ContentTag | Schema File | Example Tabs |
|------------|-------------|-------------|
| `learning` | `schemas/learning.txt` | key_points, concepts, takeaways, timestamps |
| `tech` | `schemas/tech.txt` | overview, setup, code, patterns, cheat_sheet |
| `food` | `schemas/food.txt` | overview, ingredients, steps, tips |
| `fitness` | `schemas/fitness.txt` | overview, exercises, timer, tips |
| `travel` | `schemas/travel.txt` | overview, itinerary, packing, budget |
| `review` | `schemas/review.txt` | overview, verdict, pros_cons, specs |
| `music` | `schemas/music.txt` | overview, analysis, structure, lyrics |
| `project` | `schemas/project.txt` | overview, materials, tools, steps |
| `language` | `schemas/language.txt` | phrases, rules, drills, vocabulary |
| `science` | `schemas/science.txt` | concepts, key_facts, experiments |

---

## SSE Streaming Pipeline (v2)

The pipeline uses Server-Sent Events (SSE) to stream results progressively with component-addressed tabs.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    STREAMING PHASES (SSE Events)                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  PHASE 1: METADATA (~1-3s, no LLM)                                        │
│    Events: metadata, chapters                                               │
│                                                                             │
│  PHASE 2: TRANSCRIPT + FRAMES (parallel, ~10-30s)                          │
│    Events: transcript_ready, sponsor_segments, frames                       │
│                                                                             │
│  PHASE 2.5: VISUAL CONTEXT INJECTION (~0-1s, no LLM)                      │
│    Injects [VISUAL at M:SS] annotations into transcript                     │
│                                                                             │
│  PHASE 3: CLASSIFIER + PLAN (concurrent, ~2-5s)                            │
│    Events: triage_complete (contentTags, tabs, confidence)                   │
│    → Classifier (fast model) runs concurrently with plan (Sonnet)          │
│    → Frontend shows tab skeleton immediately                                │
│                                                                             │
│  PHASE 4: EXTRACTION (1-5+ LLM calls, ~10-60s)                            │
│    Events: extraction_progress, extraction_complete                          │
│    → Short: single call; Long >30min: chunked by chapters                  │
│                                                                             │
│  PHASE 5: SYNTHESIS (1 LLM call, ~5-10s)                                  │
│    Events: synthesis_complete                                                │
│                                                                             │
│  PHASE 6: ENRICHMENT (0-1 LLM call, ~5-10s)                               │
│    Events: enrichment_complete (if applicable)                               │
│                                                                             │
│  PHASE 7: ASSEMBLY (pure code, <10ms)                                      │
│    Events: meta, tab_ready[] (progressive)                                   │
│    → Each tab_ready event renders one tab immediately                       │
│                                                                             │
│  PHASE 7.5: TRANSLATION (non-English only, ~5-15s)                         │
│    → Translates tabs + synthesis to English for bilingual storage           │
│    → Whisper translate for English Qdrant embeddings                        │
│    → Stores language/isRTL metadata on document                             │
│                                                                             │
│  PHASE 8: SAVE + DONE                                                      │
│    Events: complete (tabCount, processingTimeMs), done, [DONE]              │
│    → MongoDB: meta + tabs + language + isRTL saved                          │
│    → Redis: full response cached for instant re-serve                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### LLM Calls Summary

For a typical video (< 30 min):

| Stage | Model | Calls | Timeout |
|-------|-------|-------|---------|
| Classifier | Fast (Haiku/mini/flash-lite) | 1 | 10s |
| Plan | Sonnet | 1 | 30s |
| Extraction | Sonnet | 1-2 | 240s |
| Synthesis | Fast (Haiku/mini/flash-lite) | 1 | 30s |
| Enrichment | Fast (Haiku/mini/flash-lite) | 0-1 | 90s |
| Assembly | None (pure code) | 0 | <10ms |

**Total: 4-6 LLM calls, ~20-50 seconds, ~$0.09/video**

Classifier and Plan run concurrently. Plan produces `PlanResult` (identity, tabs, contentTags, extractionGuidance) which flows to all downstream phases for creator-aware, context-rich output.

For long videos (>30 min), extraction uses chunked batching (2-5 additional calls).

---

## Network Topology

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        vie-network (Docker bridge)                           │
│                                                                              │
│  ┌───────────┐  ┌───────────┐  ┌──────────────┐  ┌─────────────┐           │
│  │ vie-web   │  │ vie-api   │  │vie-summarizer│  │vie-assistant│           │
│  │  :5173    │  │  :3000    │  │   :8000      │  │   :8001     │           │
│  └─────┬─────┘  └─────┬─────┘  └──────┬───────┘  └──────┬──────┘           │
│        │              │               │                  │                  │
│        └──────────────┼───────────────┼──────────────────┘                  │
│                       │               │                                     │
│                       ▼               │                                     │
│                ┌─────────────┐        │                                     │
│                │ vie-mongodb │◄───────┤                                     │
│                │   :27017    │        │                                     │
│                └─────────────┘        │                                     │
│                                       │                                     │
│                ┌─────────────┐        │                                     │
│                │  vie-redis  │◄───────┤                                     │
│                │   :6379     │        │                                     │
│                └─────────────┘        │                                     │
│                                       │                                     │
│                ┌─────────────┐        │                                     │
│                │ vie-qdrant  │◄───────┘                                     │
│                │   :6333     │                                               │
│                └─────────────┘                                               │
│                                                                              │
│  ┌───────────┐                                                              │
│  │ vie-admin │                                                              │
│  │  :8002    │                                                              │
│  └───────────┘                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

Exposed ports:
  - 5173  → Frontend
  - 3000  → API
  - 8002  → Admin
```
