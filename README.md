# 🎬 VIE — Video Insight Engine

> **Stop losing knowledge from videos you watch.**

You watch a 2-hour tutorial, learn amazing things, and a week later... it's gone. You can't remember the exact steps, you can't find that one explanation that clicked, and you definitely can't explain it to someone else.
**Video Insight Engine fixes this.**

---

## The Problem

📺 You watch educational YouTube videos all the time.

😤 But videos are **terrible for knowledge retention**:

- Can't search inside them
- Can't highlight or save key parts
- Can't quickly review what you learned
- Rewatching wastes hours

**Result:** 90% of video knowledge evaporates within a week.

## The Solution

> **Turn any YouTube video into an interactive app.**

You paste a URL. VIE analyzes the video — transcript, frames, structure — and generates a custom interactive experience with the right components for that content. A cooking video becomes a recipe with timed steps and ingredient checklist. A tech tutorial becomes a code explorer with runnable snippets. A travel vlog becomes a spot explorer with a visual timeline.

Not a summary. Not a transcript. An **app built from the video's content.**

---

## What VIE Produces

Every video gets a unique set of **interactive tabs** — chosen automatically based on what the video is about.

```
📺 YouTube URL
      ↓
🤖 AI Pipeline (triage → extract → assemble)
      ↓
🎯 Knowledge Base Interactive Tabs (tailored to content type)
```

### A cooking video might get:

| Tab               | Component  | What it does                                          |
| ----------------- | ---------- | ----------------------------------------------------- |
| 🛒 Ingredients    | Checklist   | Checkable shopping list with quantities               |
| 👨‍🍳 Steps          | StepPlayer  | Timed cooking steps with "Watch this step" video seek |
| 🔪 Tips           | FlashDeck   | Swipeable chef tips and storage advice                |
| ⏰ Moments        | MomentTrack | Chapter markers + replayable highlight spans, both seekable |
| 🖼️ Visual Moments | Gallery     | Key frames from the video with lightbox               |

### A tech tutorial might get:

| Tab         | Component    | What it does                             |
| ----------- | ------------ | ---------------------------------------- |
| 💻 Code     | CodeExplorer | Syntax-highlighted code blocks with copy |
| 📋 Steps    | StepPlayer   | Setup instructions with timestamps       |
| 🔧 Tools    | Checklist    | Required tools and dependencies          |
| 📚 Concepts | FlashDeck    | Key concept flashcards                   |
| ⏰ Moments  | MomentTrack  | Video navigation with thumbnails         |

### 16 interactive components available:

MomentTrack, StepPlayer, CodeExplorer, SpotExplorer, FlashDeck, Checklist, Gallery, LyricsPlayer, ComparisonTable, ProConList, RatingBreakdown, BudgetCalculator, GearList, QuizChallenge, ScenarioExplorer, ResourceHub

The AI picks which components to use based on the video's content — not a template.

---

## How It Works

### The Pipeline

```
URL → Metadata → Transcript → Triage → Extraction → Synthesis → Enrichment → Assembly → SSE Stream → React UI
```

Each stage is a separate async phase. The pipeline streams results to the frontend via Server-Sent Events — the user sees tabs appearing progressively as they're assembled.

### Key Architecture Decisions

**Triage-driven:** A fast LLM call classifies the video (content tags like "food", "tech", "travel") and picks which tabs/components to generate. This means a 10-min recipe and a 10-min code tutorial produce completely different output — same pipeline, different components.

**Domain-specific extraction:** 12 domain schemas (learning, tech, fitness, food, music, travel, review, project, language, science + narrative, finance modifiers) define exactly what data to extract per content type. A food video extracts ingredients, steps, tips. A tech video extracts code snippets, tools, concepts.

**Component-addressed assembly:** Extraction output is transformed into props for specific React components. The frontend just does `INTERACTIVE_REGISTRY[tab.component]` — one lookup, one render.

**Frame extraction with smart scoring:** FFmpeg scene detection produces ~200 candidates. Each frame is scored locally (color saturation, face detection, text density, visual uniqueness). Only ~25 winners are uploaded to S3. ~12 curated frames go in the Gallery tab. All 200 are available in-memory for thumbnail matching.

**Chunked extraction for long videos:** Videos over 30 minutes are split by YouTube chapters (or AI-detected chapters, or 5-minute time splits). Chapters are batched into LLM calls up to the context window limit. A 9-hour video needs ~10 LLM calls total, not 100+.

**Collapsible video player with seekTo:** Click any timestamp in any tab → collapsible YouTube player opens and seeks to that moment. Timeline moments, step instructions, gallery frames, clip segments — everything is clickable and connected to the video.

### Response Shape

```json
{
  "meta": {
    "contentTags": ["food", "learning"],
    "primaryTag": "food",
    "userGoal": "Cook a chicken stir fry",
    "tldr": "...",
    "masterSummary": "...",
    "keyTakeaways": ["..."]
  },
  "tabs": [
    {
      "id": "ingredients",
      "label": "🛒 11 Ingredients",
      "emoji": "🛒",
      "component": "checklist",
      "props": { "items": [...] },
      "goal": "Checkable shopping list",
      "crossTabLinks": []
    }
  ]
}
```

---

## Architecture

```
┌───────────────────────────────────────────────────────────────────┐
│                         vie-web (React 19)                         │
│  Tailwind v4 · shadcn/ui · 36 UI components · 16 interactives    │
│  OutputShell → INTERACTIVE_REGISTRY[tab.component] → render       │
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
│                                                                    │
│  Pipeline Phases:                                                  │
│  metadata → [transcript + frames] parallel                         │
│           → triage → [extraction + synthesis] parallel              │
│           → enrichment → assembly                                  │
│                                                                    │
│  Services:                                                         │
│  ├── LiteLLM (multi-provider: Anthropic, OpenAI, Google)          │
│  ├── FFmpeg + OpenCV + Tesseract (frame extraction + OCR)         │
│  ├── yt-dlp (video download + subtitles)                          │
│  ├── SponsorBlock (ad filtering)                                  │
│  ├── spaCy (transcript cleaning)                                  │
│  └── S3 (frame + transcript storage)                              │
│                                                                    │
│  Storage:                                                          │
│  ├── MongoDB (video records, structured results)                  │
│  ├── Redis (response cache — same video = instant serve)          │
│  └── S3 (frames, transcripts, audio)                              │
└───────────────────────────────────────────────────────────────────┘
```

### SSE Event Flow

```
meta → tab_ready × N → synthesis → frames → complete
```

Each `tab_ready` event carries one assembled tab. The frontend renders tabs progressively — the user sees results appearing in real-time as the pipeline processes.

---

## Pipeline Phases (Detail)

### 1. Metadata

Fetch video info via yt-dlp: title, duration, creator, chapters, description, thumbnails, category.

### 2. Transcript (parallel with frames)

Fetch YouTube captions (yt-dlp subtitles → S3 cache → youtube-transcript-api fallback). Clean with spaCy (filler removal, TF-IDF repetition collapse). Filter sponsor segments via SponsorBlock API.

### 3. Frame Extraction (parallel with transcript)

Download lowest quality video via yt-dlp (~15-20s). FFmpeg scene detection at threshold 0.3 (~200 candidates). Score each frame locally with OpenCV: color saturation, face detection (Haar cascades), text density (Canny edges), visual uniqueness (perceptual hashing). Select ~25 evenly distributed across video duration. Upload only winners to S3. OCR on text-heavy frames (Tesseract, ~22% of frames).

### 4. Triage

Fast LLM call. Input: video metadata + chapter titles + transcript sample. Output: contentTags, primaryTag, userGoal, tab definitions with component names and goals. This decides what the entire extraction phase will look for.

### 5. Extraction (parallel with synthesis)

Domain-specific LLM call using schemas from `domains.json`. For short videos (<30 min): single call with full transcript. For long videos (30+ min): split by chapters, batch into calls, merge results. Output: structured data per domain (ingredients, steps, code snippets, locations, etc.).

### 6. Synthesis (parallel with extraction)

Fast LLM call. Produces: TLDR, masterSummary, keyTakeaways, seoDescription. For long videos: uses chapter summaries instead of full transcript (hierarchical).

### 7. Enrichment

LLM call for learning-oriented content. Produces: quiz questions, flashcards, scenario explorations. Only runs when contentTags include "learning".

### 8. Assembly

No LLM. Transforms extraction output into component props for each tab. Injects frame thumbnails (nearest-timestamp matching). Auto-adds Gallery tab when frames are available. Auto-adds Timeline tab from YouTube chapters. Validates all props against component schemas.

---

## Domain Configuration

Single source of truth: `packages/shared/src/config/domains.json`

```json
{
  "food": {
    "label": "Food & Cooking",
    "schemas": ["food"],
    "components": ["checklist", "step_player", "flash_deck", "moment_track"],
    "enrichment": true
  },
  "tech": {
    "label": "Tech & Coding",
    "schemas": ["tech"],
    "components": ["code_explorer", "step_player", "checklist", "flash_deck"],
    "enrichment": true
  }
}
```

12 domains: learning, tech, fitness, food, music, travel, review, project, language, science (+ narrative, finance modifiers). Each domain defines which extraction schemas to use and which components are available for triage to pick from.

Python reads this via `domain_config.py`. TypeScript reads via `@vie/shared/config`. One config, two runtimes.

---

## Long Video Support

Videos over 30 minutes use chunked extraction:

```
SHORT (<30 min):   Full transcript → single extraction call
MEDIUM (30-120 min): Chapters → 1-2 batch extraction calls → merge
LONG (2+ hours):   Chapters → 3-5 batch calls → hierarchical synthesis → merge
```

Chapter detection fallback chain: YouTube creator chapters → AI-detected chapters (fast model) → time-based splits (~5 min each) → single chunk.

Multiple chapters are batched into a single LLM call up to the context limit (~50K tokens per batch). A 9-hour video needs ~10 LLM calls total, processing in ~8 minutes.

---

## Frame Pipeline

```
yt-dlp (360p) → FFmpeg scene detect (0.3) → ~200 candidates on disk
    ↓
Score locally (OpenCV, no network):
  - Color saturation (HSV) → catches final dishes, landscapes
  - Face detection (Haar cascade) → catches author close-ups
  - Text density (Canny edges) → catches slides, code
  - Visual uniqueness (perceptual hash) → catches real scene changes
    ↓
Select ~25 evenly distributed across video duration
Upload only winners to S3 (~2s vs 50s for all 200)
    ↓
Gallery tab: top ~12 by score
Thumbnail injection: all 200 available for nearest-timestamp matching
```

---

## Smart Caching

Redis caches the full VIEResponse keyed by `youtube_id`. Same video = instant serve from cache ($0.00). No re-processing, no LLM calls.

S3 stores frames and transcripts per video. If frames already exist in S3 for a video, skip extraction entirely.

| Scenario                    | LLM Calls            | Cost       |
| --------------------------- | -------------------- | ---------- |
| First processing of a video | 5-10                 | $0.02-0.12 |
| Same video, any user        | 0 (cache hit)        | $0.00      |
| Same video, cache expired   | 0 (S3 frames reused) | $0.01      |

---

## Cost Per Video

| Component                                                | Cost           |
| -------------------------------------------------------- | -------------- |
| Transcript (YouTube captions)                            | $0.00 (free)   |
| Frame extraction (FFmpeg + OpenCV)                       | ~$0.001        |
| OCR on ~22% of frames (Tesseract)                        | ~$0.001        |
| S3 storage (~25 frames × 28KB)                           | ~$0.002        |
| LLM calls (triage + extraction + synthesis + enrichment) | $0.02-0.10     |
| **Total**                                                | **$0.02-0.10** |

Scales with video length: 15 min = ~$0.02, 2 hours = ~$0.05, 9 hours = ~$0.12.

---

## Tech Stack

| Layer                | Technology                                               |
| -------------------- | -------------------------------------------------------- |
| **Frontend**         | React 19 · TypeScript · Tailwind v4 · shadcn/ui          |
| **Backend API**      | Node.js · Fastify                                        |
| **AI Pipeline**      | Python · FastAPI · LiteLLM (Anthropic / OpenAI / Google) |
| **Frame Processing** | FFmpeg · OpenCV · Tesseract · yt-dlp                     |
| **NLP**              | spaCy (transcript cleaning) · SponsorBlock API           |
| **Database**         | MongoDB (records) · Redis (cache)                        |
| **Storage**          | AWS S3 (frames, transcripts, audio)                      |
| **Shared Config**    | `domains.json` → Python + TypeScript                     |

---

## LLM Provider Support

VIE uses LiteLLM for multi-provider support with automatic fallback:

```
Primary: configurable (Anthropic / OpenAI / Google)
Fast model: configurable (used for triage, manifest, synthesis)
Fallback: automatic on rate limit or error
```

| Provider  | Default Model     | Fast Model            | Context Window |
| --------- | ----------------- | --------------------- | -------------- |
| Anthropic | Claude Sonnet 4.6 | Claude Haiku 3.5      | 200K tokens    |
| OpenAI    | GPT-4o            | GPT-4o-mini           | 128K tokens    |
| Google    | Gemini 2.5 Flash  | Gemini 2.5 Flash Lite | 1M tokens      |

Per-phase model routing: fast models for classification tasks (triage, manifest, synthesis), default models for quality-sensitive tasks (extraction, enrichment).

---

## Quick Start

```bash
# Clone
git clone https://github.com/kfirkfir89/video-insight-engine.git
cd video-insight-engine

# Configure
cp .env.example .env
# Add at least one LLM API key:
#   ANTHROPIC_API_KEY=sk-ant-...
#   OPENAI_API_KEY=sk-...
#   GEMINI_API_KEY=AIza...

# Launch
docker-compose up -d

# Open
open http://localhost:5173
```

Paste a YouTube URL and watch tabs appear in real-time as the pipeline processes.

---

## Project Structure

```
video-insight-engine/
├── apps/
│   └── web/                          # React 19 frontend
│       └── src/
│           ├── components/
│           │   ├── interactives/     # 16 interactive components
│           │   └── video-detail/     # Detail page, OutputShell
│           ├── contexts/             # VideoPlayerContext (seekTo)
│           ├── lib/                  # SSE stream processor
│           └── pages/
├── packages/
│   └── shared/
│       └── src/config/
│           └── domains.json          # Single source of truth
├── services/
│   ├── api/                          # Node.js API (Fastify)
│   └── summarizer/                   # Python AI pipeline
│       └── src/
│           ├── prompts/              # LLM prompts (triage, extraction, etc.)
│           │   ├── schemas/          # 12 domain extraction schemas
│           │   └── enrich/           # 8 enrichment prompt variants
│           ├── services/
│           │   ├── pipeline/         # Phase orchestration
│           │   │   └── phases/       # metadata, transcript, triage, extraction, etc.
│           │   ├── media/            # FFmpeg, frame scoring, OCR, S3
│           │   ├── extraction/       # LLM extraction + chunking + merge
│           │   └── transcription/    # Transcript fetch, clean, chunk
│           └── config.py             # Model map, thresholds, settings
└── docker-compose.yml
```

---

## Use Cases

**Cooking** — Ingredient checklists, timed step-by-step instructions, chef tips as flashcards, frame thumbnails on each cooking step.

**Tech tutorials** — Code blocks with syntax highlighting, tool/dependency checklists, concept flashcards, moment track with code-on-screen frame detection.

**Travel vlogs** — Spot explorer with locations and frame images, budget calculators, itinerary timelines, tips as flashcards.

**Lectures & courses** — Quiz challenges, concept flashcards, scenario explorations, chapter-based navigation, hierarchical summaries for long content.

**Music** — Lyrics player with synced timestamps, song structure as a moment track with replayable section highlights.

**Product reviews** — Pro/con lists, rating breakdowns, comparison tables, gear lists.

**Fitness** — Exercise step players with timers, equipment checklists, workout timelines.

### Who Uses VIE

**Students** — Process a 3-hour lecture into quiz challenges, concept flashcards, and chapter-based navigation. Review before exams with scenario explorations instead of rewatching. Every timestamp is clickable — jump to exactly the explanation you need.

**Developers** — Turn conference talks and tutorials into code explorers with syntax-highlighted snippets, tool/dependency checklists, and concept flashcards. Frame intelligence detects code-on-screen moments and links them to the moment track.

**Home Cooks** — Cooking mode with timed step-by-step instructions, checkable ingredient lists, and chef tip flashcards. Click any step to seek the video to that exact moment. Never pause-and-scroll again.

**Researchers & Creators** — Organize processed videos into folders. Memorize key sections into a personal collection. Ask questions about saved content via RAG chat. Share interactive summaries with a public link.

**Teams** — Share processed training videos as interactive knowledge bases. New hires get quiz challenges and scenario explorations instead of "watch these 40 hours of recordings."

---

## What Makes This Different

| Feature                           | YouTube       | Notion | ChatGPT           | VIE                           |
| --------------------------------- | ------------- | ------ | ----------------- | ----------------------------- |
| Interactive components from video | ❌            | ❌     | ❌                | 16 domain-aware components    |
| Click timestamp → video seeks     | Chapters only | ❌     | ❌                | Every element is clickable    |
| Domain-specific extraction        | ❌            | Manual | Generic summary   | 12 domain schemas             |
| Quiz / flashcards / scenarios     | ❌            | Manual | On request        | Auto-generated per domain     |
| Frame intelligence (OCR + vision) | ❌            | ❌     | ❌                | Scored frames with thumbnails |
| Progressive streaming UI          | ❌            | ❌     | Token stream      | Tabs appear as assembled      |
| Multi-language + RTL support      | Captions only | Manual | English-only      | Auto-detect, translate, RTL   |
| Same video = instant ($0.00)      | N/A           | N/A    | Costs per request | Redis + S3 cache              |
| Organize & share                  | Playlists     | Pages  | Chat history      | Folders + public links        |

---

## Documentation

📖 **[Full Documentation →](./CLAUDE.md)**

🧠 **LLM onboarding briefing:** paste **[PROJECT-BRIEFING.md](./PROJECT-BRIEFING.md)** (full) or **[PROJECT-BRIEFING-TLDR.md](./PROJECT-BRIEFING-TLDR.md)** (quick) into any LLM chat to give it full project context in one shot.

---

## Roadmap

- [x] Triage-driven pipeline with 16 interactive components
- [x] Domain-specific extraction (12 domains)
- [x] Frame extraction with smart scoring
- [x] Collapsible video player with seekTo wiring
- [x] SSE streaming with progressive tab rendering
- [x] Redis caching (same video = instant)
- [x] Multi-provider LLM support (Anthropic / OpenAI / Google)
- [x] SponsorBlock filtering
- [x] Chunked extraction for long videos
- [x] Multi-language support with RTL and translation
- [ ] Whisper fallback for videos without captions
- [ ] Playlist processing with cross-video connections
- [ ] Assistant chat with RAG (Qdrant vector search)
- [ ] Collections with drag-and-drop organization
- [ ] Speaker diarization
- [ ] Browser extension
- [ ] Mobile app

---

## Contributing

This project uses **Claude Code** for AI-assisted development.

1. Read [CLAUDE.md](./CLAUDE.md) for project context
2. Follow patterns in existing pipeline phases
3. Domain additions: update `domains.json` + add schema in `prompts/schemas/` + add enrichment prompt in `prompts/enrich/`
4. Follow patterns in `.claude/skills/`

---

## License

MIT

---

<p align="center">
  <b>Stop losing knowledge from videos. Turn them into apps.</b>
</p>
