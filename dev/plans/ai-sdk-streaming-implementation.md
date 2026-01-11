# AI SDK Integration & Streaming Implementation Plan

## Executive Summary

Add real-time LLM streaming to the Video Insight Engine so users see AI responses character-by-character (like ChatGPT). This requires changes across all 4 services and documentation updates.

---

## Current State

```
User → vie-web → vie-api → vie-summarizer/explainer → Anthropic
                    ↓
              WebSocket (status only, no streaming)
```

**Current Flow:**
1. User submits video URL
2. API triggers summarizer in background
3. Summarizer makes 4-5 LLM calls, waits for each to complete
4. WebSocket sends progress updates (10%, 30%, 50%...)
5. User sees final result after ALL processing completes

**Problem:** User waits 30-60 seconds seeing only "Processing..." with no visible progress.

---

## Target State

```
User → vie-web → vie-api → vie-summarizer/explainer → Anthropic
           ↑                                              ↓
           └────────────── SSE Stream ──────────────────┘
                     (tokens stream in real-time)
```

**New Flow:**
1. User submits video URL
2. Summarizer streams each section's summary character-by-character
3. User sees text appearing in real-time (like ChatGPT)
4. Each LLM response streams separately with clear section labels

---

## Implementation Phases

### Phase 1: Add Vercel AI SDK to Frontend

**Files to Modify:**
- `apps/web/package.json` - Add `ai` package
- `apps/web/src/hooks/use-streaming-chat.ts` - NEW: Streaming hook
- `apps/web/src/components/ui/streaming-text.tsx` - NEW: Streaming component

**Steps:**

1. Install Vercel AI SDK:
```bash
cd apps/web
npm install ai
```

2. Create streaming hook for explainer chat:
```tsx
// apps/web/src/hooks/use-streaming-chat.ts
import { useChat } from 'ai/react';

export function useExplainerChat(memorizedItemId: string) {
  return useChat({
    api: `${import.meta.env.VITE_API_URL}/api/explain/chat/stream`,
    body: { memorizedItemId },
  });
}
```

3. Create streaming text component:
```tsx
// apps/web/src/components/ui/streaming-text.tsx
interface StreamingTextProps {
  content: string;
  isLoading?: boolean;
  className?: string;
}

export function StreamingText({ content, isLoading, className }: StreamingTextProps) {
  return (
    <div className={className}>
      {content}
      {isLoading && <span className="animate-pulse">▊</span>}
    </div>
  );
}
```

---

### Phase 2: Add SSE Streaming to vie-api

**Files to Modify:**
- `api/package.json` - Add `ai` package (for streaming helpers)
- `api/src/routes/explain.routes.ts` - Add `/chat/stream` endpoint
- `api/src/routes/summarize.routes.ts` - NEW: Streaming summarize endpoint
- `api/src/services/explainer-client.ts` - Add streaming method

**Steps:**

1. Add streaming endpoint for chat:
```typescript
// api/src/routes/explain.routes.ts
fastify.post('/chat/stream', {
  preHandler: [fastify.authenticate],
}, async (req, reply) => {
  const { memorizedItemId, message, chatId } = req.body;

  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  // Proxy SSE from explainer service
  const response = await fetch(`${EXPLAINER_URL}/explain/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ memorizedItemId, userId: req.user.userId, message, chatId }),
  });

  // Pipe the SSE stream to client
  for await (const chunk of response.body) {
    reply.raw.write(chunk);
  }
  reply.raw.end();
});
```

2. Add streaming endpoint for summarization status:
```typescript
// api/src/routes/videos.routes.ts - Add SSE endpoint
fastify.get('/stream/:videoSummaryId', {
  preHandler: [fastify.authenticate],
}, async (req, reply) => {
  // Stream progress + partial results from summarizer
});
```

---

### Phase 3: Add Streaming to vie-explainer (Python)

**Files to Modify:**
- `services/explainer/requirements.txt` - Already has anthropic
- `services/explainer/src/main.py` - Add `/explain/chat/stream` endpoint
- `services/explainer/src/services/llm.py` - Add streaming method

**Steps:**

1. Add streaming LLM method:
```python
# services/explainer/src/services/llm.py
async def stream_message(self, messages: list[dict]):
    """Stream LLM response tokens."""
    with self._client.messages.stream(
        model=self._model,
        max_tokens=2000,
        messages=messages,
    ) as stream:
        for text in stream.text_stream:
            yield text
```

2. Add SSE endpoint:
```python
# services/explainer/src/main.py
from fastapi.responses import StreamingResponse

@app.post("/explain/chat/stream")
async def explain_chat_stream(request: ExplainChatRequest):
    """Stream chat response via SSE."""
    async def generate():
        async for token in explain_chat_stream_impl(
            memorized_item_id=request.memorizedItemId,
            user_id=request.userId,
            message=request.message,
            chat_id=request.chatId,
        ):
            yield f"data: {json.dumps({'token': token})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")
```

---

### Phase 4: Add Streaming to vie-summarizer (Python)

**Files to Modify:**
- `services/summarizer/src/main.py` - Add streaming endpoints
- `services/summarizer/src/services/llm.py` - Add streaming method
- `services/summarizer/src/services/summarizer_service.py` - Use streaming

**Steps:**

1. Add streaming LLM method:
```python
# services/summarizer/src/services/llm.py
async def stream_llm(self, prompt: str):
    """Stream LLM response tokens."""
    with self._client.messages.stream(
        model=self._model,
        max_tokens=2000,
        messages=[{"role": "user", "content": prompt}],
    ) as stream:
        for text in stream.text_stream:
            yield text
```

2. Add SSE endpoint for summarization:
```python
# services/summarizer/src/main.py
@app.post("/summarize/stream")
async def summarize_stream(request: SummarizeRequest):
    """Stream summarization progress and partial results."""
    async def generate():
        # Stream each step as it happens
        yield f"data: {json.dumps({'step': 'sections', 'progress': 10})}\n\n"

        async for token in llm.stream_section_detection(...):
            yield f"data: {json.dumps({'token': token, 'section': 'detection'})}\n\n"

        # Continue for each section...

    return StreamingResponse(generate(), media_type="text/event-stream")
```

---

### Phase 5: Update WebSocket for Better UX

**Files to Modify:**
- `apps/web/src/hooks/use-websocket.ts` - Improve reconnection
- `apps/web/src/stores/ui-store.ts` - Add connection state

**Improvements:**

1. Exponential backoff reconnection:
```typescript
// Reconnect with exponential backoff: 1s, 2s, 4s, 8s, max 30s
const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
```

2. Expose connection state:
```typescript
export function useWebSocket() {
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  // ...
  return { connectionState, connect, disconnect };
}
```

3. Add UI indicator:
```tsx
// components/layout/Header.tsx
{connectionState !== 'connected' && (
  <Badge variant="outline" className="text-yellow-500">
    {connectionState === 'connecting' ? 'Reconnecting...' : 'Offline'}
  </Badge>
)}
```

---

## Documentation Updates

### 1. CLAUDE.md Updates

**Location:** `/CLAUDE.md`

**Add to Tech Stack section:**
```markdown
| **vie-web**        | React + Vite + Vercel AI SDK  | 5173  |
```

**Add to Key Design Decisions:**
```markdown
| LLM Streaming   | SSE + AI SDK | Real-time UX, like ChatGPT     |
```

### 2. docs/ARCHITECTURE.md Updates

**Add new section:**
```markdown
## Streaming Architecture

### Data Flow for Streaming

┌─────────────┐    SSE     ┌─────────────┐    SSE     ┌─────────────┐
│   vie-web   │◄──────────│   vie-api   │◄──────────│ summarizer  │
│  (AI SDK)   │           │  (proxy)    │           │  (stream)   │
└─────────────┘           └─────────────┘           └─────────────┘

### Streaming Endpoints

| Endpoint | Service | Purpose |
|----------|---------|---------|
| `/api/explain/chat/stream` | vie-api | Stream chat responses |
| `/api/videos/summarize/stream` | vie-api | Stream summarization |
| `/explain/chat/stream` | vie-explainer | Stream from LLM |
| `/summarize/stream` | vie-summarizer | Stream from LLM |
```

### 3. docs/SERVICE-WEB.md Updates

**Add new section:**
```markdown
## AI Integration

### Vercel AI SDK

We use the Vercel AI SDK for streaming LLM responses:

```tsx
import { useChat } from 'ai/react';

function ChatComponent() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: '/api/explain/chat/stream',
  });

  return (
    <div>
      {messages.map(m => <Message key={m.id} message={m} />)}
      <form onSubmit={handleSubmit}>
        <input value={input} onChange={handleInputChange} />
      </form>
    </div>
  );
}
```

### Streaming Components

| Component | Purpose |
|-----------|---------|
| `StreamingText` | Display streaming text with cursor |
| `useExplainerChat` | Hook for explainer chat with streaming |
```

### 4. docs/SERVICE-SUMMARIZER.md Updates

**Add streaming section:**
```markdown
## Streaming API

### POST /summarize/stream

Stream summarization progress and partial results via SSE.

**Request:**
```json
{
  "videoSummaryId": "...",
  "youtubeId": "...",
  "url": "...",
  "userId": "..."
}
```

**Response (SSE):**
```
data: {"step": "sections", "progress": 10}

data: {"token": "The", "section": "tldr"}

data: {"token": " video", "section": "tldr"}

data: [DONE]
```
```

### 5. docs/SERVICE-EXPLAINER.md Updates

**Add streaming section:**
```markdown
## Streaming Chat API

### POST /explain/chat/stream

Stream chat response via SSE.

**Request:**
```json
{
  "memorizedItemId": "...",
  "userId": "...",
  "message": "...",
  "chatId": "..."
}
```

**Response (SSE):**
```
data: {"token": "Based"}

data: {"token": " on"}

data: {"token": " the"}

data: [DONE]
```
```

### 6. docs/API-REST.md Updates

**Add streaming endpoints:**
```markdown
## Streaming Endpoints (SSE)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/explain/chat/stream` | Stream chat response |
| GET | `/api/videos/summarize/stream/:id` | Stream summarization progress |
```

### 7. README.md Updates

**Add to Features section:**
```markdown
### Real-time AI Streaming

- **Live Summarization**: Watch AI generate summaries in real-time
- **Streaming Chat**: Get instant responses character-by-character
- **Progress Visibility**: See exactly what the AI is doing
```

---

## Files Summary

### New Files (6)

| File | Purpose |
|------|---------|
| `apps/web/src/hooks/use-streaming-chat.ts` | AI SDK chat hook |
| `apps/web/src/hooks/use-streaming-summary.ts` | Streaming summary hook |
| `apps/web/src/components/ui/streaming-text.tsx` | Streaming text display |
| `api/src/routes/stream.routes.ts` | SSE proxy routes |
| `services/explainer/src/tools/explain_chat_stream.py` | Streaming chat impl |
| `services/summarizer/src/services/streaming.py` | Streaming LLM wrapper |

### Modified Files (14)

| File | Changes |
|------|---------|
| `apps/web/package.json` | Add `ai` package |
| `apps/web/src/hooks/use-websocket.ts` | Improve reconnection |
| `apps/web/src/stores/ui-store.ts` | Add connection state |
| `api/package.json` | Add `ai` package |
| `api/src/routes/explain.routes.ts` | Add stream endpoint |
| `api/src/routes/videos.routes.ts` | Add stream endpoint |
| `services/explainer/src/main.py` | Add stream endpoint |
| `services/explainer/src/services/llm.py` | Add streaming method |
| `services/summarizer/src/main.py` | Add stream endpoint |
| `services/summarizer/src/services/llm.py` | Add streaming method |
| `CLAUDE.md` | Update tech stack |
| `docs/ARCHITECTURE.md` | Add streaming section |
| `docs/SERVICE-WEB.md` | Add AI integration section |
| `docs/SERVICE-SUMMARIZER.md` | Add streaming API |
| `docs/SERVICE-EXPLAINER.md` | Add streaming API |
| `docs/API-REST.md` | Add streaming endpoints |
| `README.md` | Add streaming features |

---

## Verification Plan

### 1. Unit Tests

```bash
# Frontend
cd apps/web
npm test -- --grep "streaming"

# API
cd api
npm test -- --grep "stream"

# Python services
cd services/summarizer
pytest tests/test_streaming.py

cd services/explainer
pytest tests/test_streaming.py
```

### 2. Integration Test

```bash
# 1. Start all services
docker-compose up -d

# 2. Test explainer streaming
curl -N -X POST http://localhost:3000/api/explain/chat/stream \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"memorizedItemId": "...", "message": "Explain this concept"}'
# Should see: data: {"token": "..."} streaming

# 3. Test summarizer streaming
curl -N http://localhost:3000/api/videos/summarize/stream/VIDEO_ID \
  -H "Authorization: Bearer $TOKEN"
# Should see: data: {"step": "...", "progress": ...} streaming
```

### 3. Frontend Manual Test

1. Open http://localhost:5173
2. Navigate to a memorized item
3. Open chat
4. Send a message
5. **Verify**: Response appears character-by-character, not all at once

### 4. WebSocket Test

1. Disable network briefly
2. **Verify**: UI shows "Reconnecting..."
3. Re-enable network
4. **Verify**: Connection restores automatically

---

## Implementation Order

1. **Phase 1**: Frontend AI SDK setup (1 hour)
2. **Phase 2**: API streaming proxy (2 hours)
3. **Phase 3**: Explainer streaming (2 hours)
4. **Phase 4**: Summarizer streaming (3 hours)
5. **Phase 5**: WebSocket improvements (1 hour)
6. **Phase 6**: Documentation updates (1 hour)
7. **Phase 7**: Testing & verification (2 hours)

**Total Estimated Effort**: 12 hours

---

## Rollback Plan

If streaming causes issues:

1. Keep non-streaming endpoints as fallback
2. Add feature flag: `VITE_ENABLE_STREAMING=true`
3. Frontend can fall back to polling if SSE fails

---

## Architecture Review Summary

### Current Stack Assessment (from earlier review)

| Technology | Status | Notes |
|------------|--------|-------|
| React 19.2 | ✅ Excellent | Latest |
| Vite 7.2 | ✅ Excellent | Fast builds |
| shadcn/ui + Radix | ✅ Correct | This IS shadcn (Radix is the underlying primitive) |
| React Query + Zustand | ✅ Best practice | Server + client state |
| Tailwind 4.1 | ✅ Latest | CSS-first config |

### Key Clarification

**shadcn/ui uses Radix UI internally** - this is correct architecture, not a conflict.

```
Your Components (Button, Dialog, etc.)
    └── shadcn/ui styling (Tailwind + cva)
        └── Radix UI primitives (accessibility, behavior)
```

### Recommended Addition

```bash
npm install ai  # Vercel AI SDK - adds streaming capabilities
```
