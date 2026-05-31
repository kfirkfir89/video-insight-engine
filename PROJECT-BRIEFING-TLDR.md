# Video Insight Engine (VIE) — TL;DR Briefing

> Paste this into a fresh LLM chat for quick context. For the full version (data model, every endpoint, gotchas), use `PROJECT-BRIEFING.md`.

## What it is
**VIE turns any YouTube URL into a custom interactive web app** — not a summary, an *app built from the video's content*. An AI pipeline analyzes transcript + frames + structure, **classifies** the video, and generates a tailored set of **interactive tabs** (a cooking video → checkable ingredients + timed step player; a coding tutorial → code explorer + tool checklist). Classification drives generation, so the same pipeline yields different output per video. Same video re-serves to any user instantly at **$0.00** via caching.

## Services (Docker-Compose monorepo)
| Service | Tech | Port | Role |
|---|---|---|---|
| vie-web | React 19 + Vite + TS | 5173 | Frontend SPA (SSE/WS) |
| vie-api | Node + Fastify + TS | 3000 | Gateway: auth, REST, MongoDB, orchestration |
| vie-summarizer | Python + FastAPI + LiteLLM | 8000 | The AI pipeline |
| vie-assistant | Python + FastAPI + Qdrant | 8001 | RAG chat + tools |
| vie-admin | Python + React | 8002 | Ops dashboard |
| + worker | (shares summarizer img) | — | RabbitMQ queue consumer |

Stores: MongoDB 7 (records), Redis 7 (cache + locks), Qdrant (RAG vectors), RabbitMQ (optional queue), S3 (frames/transcripts). Shared config: `packages/shared/src/config/domains.json` (one config, read by Python + TS). **API gateway lives at top-level `api/`** (not `services/api`).

## The pipeline (3–6 LLM calls, ~$0.09, ~20–50s, streamed over SSE)
```
metadata → [transcript ‖ frames] → visual injection
→ classifier(fast) ‖ plan(Sonnet)   ← "Plan" stage (replaced Manifest+Triage; SSE event still triage_complete)
→ extraction (chunked for >15min) → quality check (retry if <0.6 coverage)
→ [synthesis ‖ assembly] → enrichment (learning/tech only) → assembly (pure code, no LLM)
→ [translation] (non-English only) → save + complete
```
- **10 domains** (learning, tech, fitness, food, music, travel, review, project, language, science) + **2 modifiers** (narrative, finance) → 12 schemas. 8 `ContentTraits` booleans route components.
- **16 interactive components** (MomentTrack, StepPlayer, CodeExplorer, SpotExplorer, FlashDeck, Checklist, Gallery, LyricsPlayer, ComparisonTable, ProConList, RatingBreakdown, BudgetCalculator, GearList, QuizChallenge, ScenarioExplorer, ResourceHub).
- **Frames:** yt-dlp 360p → FFmpeg scene-detect (~200) → OpenCV scoring → ~25 to S3 → Tesseract OCR + Sonnet vision → `[VISUAL at M:SS]` injected into transcript.
- **LLM:** LiteLLM multi-provider (default Sonnet 4.6 / fast Haiku 4.5). Anthropic prompt caching on static prompt halves.

## Output shape
`VIEResponse = { meta, tabs[] }`. Each tab = `{ id, label, emoji, component, props, crossTabLinks? }`. Frontend does `COMPONENT_REGISTRY[tab.component]` → render. Every timestamp is clickable → seeks a collapsible YouTube player. Tabs stream in progressively (`tab_ready` events).

## Caching & "never pay twice" (the defining concern)
- **3 dedup layers:** per-user idempotency hash → cross-user content-addressed `dedupKey` (no userId) → Redis dispatch guard. Backstop = summarizer pipeline lock.
- **`PIPELINE_VERSION`** is baked into the hash + dedupKey; bump it on any output-changing change to invalidate caches. Versioned, not time-based.
- MongoDB `videoSummaryCache` (one row per video) stores **both** v1 (`triage`/`output`) and v2 (`assembledMeta`/`assembledTabs`); non-English nests the original under `sourceLanguage` (omitted, not null, for English).

## Assistant / RAG
One Qdrant collection `transcript_chunks` (384-dim, English-only embeddings `all-MiniLM-L6-v2`; non-EN translated first). Chat = embed query → retrieve top-k → LLM → stream. Also `/library/search` (cross-video, no LLM) and `/action` (save_note, quiz_me, find_moment, explain).

## Auth & security
Two-token JWT (15-min access in memory + 7-day HttpOnly refresh cookie, different secrets). Per-request ownership checks at the data layer. Zod/Pydantic validation at boundaries. Rate limits, helmet CSP, SSRF/XSS guards. GDPR Art.17 = soft-delete (30-day grace) → cascade-delete saga + indefinite hashed audit.

## Conventions
React 19 (compiler auto-memoizes), Tailwind v4 CSS-first + OKLCH tokens (no hardcoded colors, No-Inter Rule), shadcn/ui. Layered code (routes→services→repositories), no `any`/no sync-in-async, files <500 lines. **`git stash` is banned; never mutate the working tree without explicit permission; never commit to `main`.**
