# Service: vie-assistant

Python service providing video-aware conversational AI with RAG-powered context retrieval and tool routing.

**Type:** HTTP service (FastAPI + SSE streaming)

---

## Tech Stack

| Technology | Purpose |
|------------|---------|
| Python 3.12+ | Runtime |
| FastAPI | Web framework + SSE streaming |
| LiteLLM | Multi-provider LLM abstraction (Anthropic, OpenAI, Gemini) |
| sentence-transformers | Embedding model for RAG search |
| Qdrant | Vector database for transcript chunk retrieval |
| Motor (MongoDB) | Async MongoDB driver for video context + notes |
| Pydantic | Request/response validation + settings |
| structlog | Structured logging |

---

## Architecture

```
                    ┌──────────────────────────────────────────┐
                    │              vie-api (gateway)            │
                    │   POST /api/assistant/chat → proxy        │
                    └────────────────┬─────────────────────────┘
                                     │ X-Internal-Secret
                                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        vie-assistant (:8001)                        │
│                                                                     │
│  ┌─────────────┐   ┌──────────────┐   ┌──────────────────────────┐ │
│  │ Intent      │──▶│ Tool Router  │──▶│ Tools                    │ │
│  │ Detection   │   │              │   │  video_qa                │ │
│  │ (keywords)  │   │ detect_intent│   │  navigator               │ │
│  └──────┬──────┘   │ → route      │   │  concept_explain         │ │
│         │no match  └──────────────┘   │  quiz_generator          │ │
│         ▼                             │  note_taker              │ │
│  ┌──────────────┐                     │  cross_reference         │ │
│  │ RAG Chat     │                     └──────────────────────────┘ │
│  │ (default)    │                                                   │
│  │ search→LLM   │                                                   │
│  │ stream tokens │                                                   │
│  └──────────────┘                                                   │
│         │                                                           │
│         ▼                                                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                         │
│  │ Qdrant   │  │ MongoDB  │  │ LiteLLM  │                         │
│  │ (vectors)│  │ (context)│  │ (LLM)    │                         │
│  └──────────┘  └──────────┘  └──────────┘                         │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
services/assistant/
├── Dockerfile
├── requirements.txt
├── pyproject.toml
└── src/
    ├── server.py                 # FastAPI app, routes, lifespan
    ├── config.py                 # Settings + model mapping
    ├── exceptions.py             # AppError hierarchy
    ├── logging_config.py         # structlog setup
    │
    ├── models/
    │   ├── requests.py           # ChatRequest, ActionRequest, ChatMessage
    │   └── responses.py          # RAGSource, ChatEvent, ActionResponse
    │
    ├── services/
    │   ├── assistant.py          # AssistantService (orchestrator)
    │   ├── llm_provider.py       # LiteLLM multi-provider abstraction
    │   ├── rag.py                # RAGService (embed + Qdrant search + dedup)
    │   ├── context_builder.py    # System prompt assembly
    │   └── tool_router.py        # Intent detection + tool dispatch
    │
    ├── repositories/
    │   ├── video_repository.py   # VideoContext from MongoDB
    │   ├── notes_repository.py   # Notes CRUD
    │   └── qdrant_repository.py  # Qdrant vector search
    │
    ├── tools/
    │   ├── base.py               # BaseTool protocol
    │   ├── video_qa.py           # RAG + LLM Q&A with citations
    │   ├── navigator.py          # Tab/section fuzzy search
    │   ├── concept_explain.py    # Deep concept explanations (Sonnet)
    │   ├── quiz_generator.py     # Quiz generation (fast model)
    │   ├── note_taker.py         # Save notes to MongoDB
    │   └── cross_reference.py    # Cross-video comparison
    │
    └── utils/
        ├── prompt_templates.py   # Prompt template strings
        ├── content_extractor.py  # Content extraction helpers
        └── language_detect.py    # User language detection for query translation
```

---

## Endpoints

### `GET /health`

Health check. No authentication required.

**Response** `200`:
```json
{
  "status": "healthy",
  "service": "vie-assistant",
  "model": "anthropic/claude-sonnet-4-6"
}
```

### `POST /chat`

Stream a conversational response about a video via SSE. Requires `X-Internal-Secret` header.

**Request:**
```json
{
  "video_id": "dQw4w9WgXcQ",
  "message": "What are the key points about attention?",
  "conversation_history": [
    { "role": "user", "content": "Tell me about this video" },
    { "role": "assistant", "content": "This video covers..." }
  ]
}
```

**Response** `200` (`text/event-stream`):
```
data: {"type":"source","sources":[{"text":"...","timestamp":"1:23","score":0.92}]}

data: {"type":"text","content":"The"}

data: {"type":"text","content":" video"}

data: {"type":"done","metadata":{"video_id":"dQw4w9WgXcQ","sources_count":3}}

```

### `POST /library/search`

Semantic search across a library of videos. Pure retrieval — no LLM call. Requires `X-Internal-Secret` header. Trusts the caller (vie-api gateway) to verify that the requesting user owns or has access to every `video_id` in the list.

**Request:**
```json
{
  "video_ids": ["dQw4w9WgXcQ", "abc123", "xyz789"],
  "query": "React coding with hooks",
  "top_k": 10,
  "sources": ["transcript", "default_output"]
}
```

| Field | Type | Constraints |
|---|---|---|
| `video_ids` | `string[]` | 1–200 items; each matches `^[A-Za-z0-9_\-]+$`, max 64 chars |
| `query` | `string` | 1–500 chars |
| `top_k` | `int` | 1–50 (default 10) |
| `sources` | `string[]` \| `null` | Optional. Subset of `["transcript", "default_output"]`. `null` returns all sources. |

**Response** `200`:
```json
{
  "results": [
    {
      "text": "Hooks are functions that let you tap into React's state and lifecycle features...",
      "video_id": "dQw4w9WgXcQ",
      "score": 0.741,
      "chunk_index": 1,
      "timestamp": null,
      "source": "transcript",
      "tab_id": null,
      "tab_component": null,
      "prop_path": null
    },
    {
      "text": "Use useState for local component state with simple value-and-setter destructuring patterns.",
      "video_id": "dQw4w9WgXcQ",
      "score": 0.684,
      "chunk_index": 0,
      "source": "default_output",
      "tab_id": "overview_tab",
      "tab_component": "overview",
      "prop_path": "keyTakeaways[0]"
    }
  ]
}
```

**Errors:**
- `403` — invalid or missing `X-Internal-Secret`
- `422` — validation error (empty `video_ids`, invalid char in id, oversized `top_k`, missing `query`)
- `429` — rate limit exceeded (60/min/caller — keyed on `X-User-Id` forwarded by vie-api; falls back to a shared `anonymous` bucket if the header is absent. Separate bucket from `/chat`.)
- `503` — RAG service not initialized (lifespan hasn't completed)

### `POST /action`

Structured action endpoint. Returns `501 Not Implemented` (Phase 2).

---

## SSE Event Types

| Type | Description | Payload |
|------|-------------|---------|
| `text` | Streamed LLM token | `content: string` |
| `source` | RAG sources used for context | `sources: RAGSource[]` |
| `tool_result` | Result from a routed tool | `metadata: { tool, result }` |
| `error` | Error during processing | `content: string` |
| `done` | Stream complete | `metadata: { video_id, ... }` |

---

## Tool Routing

Intent detection uses keyword matching on the user message. First match wins.

| Tool | Trigger Keywords | Model | Description |
|------|-----------------|-------|-------------|
| `note_taker` | "save note", "bookmark this", "take note" | None (DB only) | Save notes to MongoDB |
| `quiz_generator` | "quiz me", "test me", "generate quiz" | Fast (Haiku) | Generate multiple-choice questions |
| `concept_explain` | "what is a/an", "define", "explain the concept" | Default (Sonnet) | Deep concept explanations with RAG |
| `navigator` | "find in video", "navigate to", "show me where" | None (local) | Fuzzy search through video tabs |
| `cross_reference` | "compare with", "cross-reference" | Default (Sonnet) | Compare content across videos |

If no intent matches, the message falls through to the default RAG chat path (search Qdrant, build context, stream LLM response).

---

## RAG Pipeline

1. **Detect** user language (`language_detect.py`)
2. **Translate** non-English queries to English for RAG search (LLM translation)
3. **Encode** query via sentence-transformers (model name from `EMBEDDING_MODEL_NAME` setting, default `all-MiniLM-L6-v2`, lazy-loaded at startup)
4. **Search** Qdrant for top-k chunks filtered by `video_ids` (single-video uses `MatchValue`; multi-video uses `MatchAny`) and optionally by `sources` (subset of `transcript`/`default_output`)
5. **Deduplicate** near-identical chunks using cosine similarity (threshold: 0.95)
6. **Build** system prompt with video metadata + RAG chunks + conversation history
   - Uses `text_original` when user language matches video language (non-English)
   - Uses `synthesis_en` for English users on non-English videos
   - Appends language instruction for non-English responses
7. **Stream** LLM response token by token via SSE

### Retrieval payload schema

Each result carries enough metadata for the UI to render a deep link back into a specific tab:

| Field | Description |
|---|---|
| `text` | Natural-language chunk used for retrieval |
| `text_original` | Original-language text (only set for non-English transcripts) |
| `video_id` | Source video — populated for multi-video / library queries |
| `score` | Cosine similarity score |
| `source` | `"transcript"` or `"default_output"` |
| `tab_id` / `tab_component` / `prop_path` | Set when `source == "default_output"`. Identify the originating tab and prop (e.g. `tab_component="quiz"`, `prop_path="questions[2]"`) |
| `chunk_index` | Position within the (video_id, source, tab_id) group |

### Two retrieval entry points

| Method | Scope | Used by |
|---|---|---|
| `RAGService.search(query, video_id, top_k, sources)` | Single video | `/chat`, all tools |
| `RAGService.search_library(query, video_ids, top_k, sources)` | Many videos at once; populates `video_id` on every result so the UI can group | `POST /library/search` |

---

## Environment Variables

```bash
# Server
ASSISTANT_PORT=8001

# MongoDB
MONGODB_URI=mongodb://vie-mongodb:27017/video-insight-engine

# Qdrant
QDRANT_URL=http://vie-qdrant:6333
QDRANT_COLLECTION=transcript_chunks

# Internal auth (service-to-service)
INTERNAL_SECRET=dev-internal-secret-change-me

# LLM Provider
LLM_PROVIDER=anthropic          # anthropic | openai | gemini
LLM_FAST_PROVIDER=              # Optional: separate provider for fast model
LLM_FALLBACK_PROVIDER=          # Optional: fallback provider
LLM_MODEL=                      # Override default model
LLM_FAST_MODEL=                 # Override fast model
LLM_TIMEOUT_SECONDS=60.0
LLM_NUM_RETRIES=2

# Provider API Keys
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=
GEMINI_API_KEY=

# Assistant limits
MAX_CONTEXT_CHUNKS=8
MAX_CONVERSATION_TURNS=20

# Logging
LOG_LEVEL=INFO
LOG_FORMAT=console              # console | json
```

---

## Dependencies

| Service | Purpose | Required |
|---------|---------|----------|
| MongoDB | Video context, notes storage | Yes |
| Qdrant | Transcript chunk vector search | Yes |
| LiteLLM | LLM completion (Anthropic/OpenAI/Gemini) | Yes |
| sentence-transformers | Query embedding for RAG | Yes |
| vie-api | Gateway proxy (forwards requests) | Yes (production) |

---

## Docker

```bash
# Build
docker build -f services/assistant/Dockerfile -t vie-assistant .

# Run
docker run -p 8001:8001 \
  -e MONGODB_URI=mongodb://host:27017/video-insight-engine \
  -e QDRANT_URL=http://host:6333 \
  -e ANTHROPIC_API_KEY=sk-ant-... \
  -e INTERNAL_SECRET=your-secret \
  vie-assistant
```

The service runs via uvicorn: `uvicorn src.server:app --host 0.0.0.0 --port 8001`

---

## Development

```bash
cd services/assistant

# Install dependencies
pip install -r requirements.txt

# Run tests
python3 -m pytest tests/ -v

# Run specific tool tests
python3 -m pytest tests/test_tools/ -v

# Run with auto-reload
uvicorn src.server:app --reload --port 8001
```

Test configuration in `pyproject.toml`: `asyncio_mode = "auto"` (all async tests run automatically).

---

## Error Handling

Exception hierarchy rooted in `AppError`:

| Exception | Status | Code | When |
|-----------|--------|------|------|
| `AppError` | 500 | `INTERNAL_ERROR` | Base class |
| `NotFoundError` | 404 | `NOT_FOUND` | Video not in MongoDB |
| `LLMError` | 502 | `LLM_ERROR` | LLM provider failure (timeout, rate limit, auth) |
| `ValidationError` | 400 | `VALIDATION_ERROR` | Invalid input (empty note, bad params) |
| `ServiceUnavailableError` | 503 | `SERVICE_UNAVAILABLE` | External service down |

All exceptions return JSON: `{ "error": "message", "code": "ERROR_CODE" }`.

Unhandled exceptions are caught by a generic handler and return 500 with `INTERNAL_ERROR`. Stack traces are logged but never exposed to clients.
