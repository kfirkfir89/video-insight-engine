# Cross-Cutting Concerns

Guidelines for work that spans multiple services.

---

## When Does This Apply?

Use this guide when your task involves:

- Frontend + Backend changes (new API endpoint + UI)
- vie-api + vie-summarizer (queue jobs, status updates)
- vie-api + vie-explainer (MCP tool calls)
- Any change affecting multiple services

---

## The Golden Rule

**Define the contract first, build in dependency order.**

```
1. CONTRACT   →   2. BACKEND   →   3. FRONTEND
   (API spec)      (Provider)       (Consumer)
```

Why this order?
- Backend defines what's possible
- Frontend consumes what exists
- Contract prevents miscommunication

---

## Cross-Service Development Flow

### Step 1: Define the Contract

Before writing any code, document the interface:

```markdown
## New Feature: Retry Failed Video

### API Endpoint
POST /api/videos/:id/retry

### Request
None (empty body)

### Response (200)
{
  "video": {
    "id": "...",
    "status": "pending",
    "retryCount": 1
  }
}

### Errors
- 404: VIDEO_NOT_FOUND
- 400: INVALID_STATE (not in failed state)
- 400: NOT_RETRYABLE (permanent error like NO_TRANSCRIPT)

### WebSocket Event
{
  "type": "video.status",
  "payload": { "videoSummaryId": "...", "status": "pending" }
}
```

**Where to document:**
- REST endpoints → `docs/API-REST.md`
- WebSocket events → `docs/API-WEBSOCKET.md`
- MCP tools → `docs/API-MCP-EXPLAINER.md`

### Step 2: Build Backend First

```
vie-api                    vie-summarizer/explainer
  │                              │
  ├── Add route                  │
  ├── Add service method         │
  ├── Add validation             ├── Add handler (if needed)
  ├── Add tests                  ├── Add tests
  └── Verify with curl           └── Verify integration
```

**Verification before frontend:**
```bash
# Test the endpoint directly
curl -X POST http://localhost:3000/api/videos/123/retry \
  -H "Authorization: Bearer $TOKEN"
```

### Step 3: Build Frontend Last

Only after backend is working:

```
vie-web
  │
  ├── Add API client method
  ├── Add React Query hook
  ├── Add UI component
  ├── Handle loading/error states
  └── Test full flow
```

---

## Service Communication Patterns

### vie-api ↔ vie-summarizer (Async via RabbitMQ)

```
┌─────────┐    publish    ┌──────────┐    consume    ┌──────────────┐
│ vie-api │──────────────▶│ RabbitMQ │──────────────▶│vie-summarizer│
└─────────┘               └──────────┘               └──────┬───────┘
     ▲                          │                          │
     │         publish          │        consume           │
     └──────────────────────────┼──────────────────────────┘
                            status updates
```

**Pattern:**
1. vie-api publishes job to `summarize.jobs` queue
2. vie-summarizer consumes and processes
3. vie-summarizer publishes status to `job.status` exchange
4. vie-api broadcasts via WebSocket to user

**Key files:**
- `api/src/plugins/rabbitmq.ts`
- `workers/summarizer/src/services/rabbitmq.py`
- `docs/API-WEBSOCKET.md`

### vie-api ↔ vie-explainer (Sync via MCP)

```
┌─────────┐    MCP call    ┌──────────────┐
│ vie-api │───────────────▶│ vie-explainer│
└─────────┘◀───────────────└──────────────┘
            MCP response
```

**Pattern:**
1. vie-api is MCP client
2. vie-explainer is MCP server with tools
3. Calls are synchronous (request/response)
4. Results may be cached in MongoDB

**Key files:**
- `api/src/plugins/mcp.ts`
- `workers/explainer/src/server.py`
- `docs/API-MCP-EXPLAINER.md`

---

## Shared Types Strategy

### TypeScript (vie-api, vie-web)

Use `packages/types` for shared interfaces:

```typescript
// packages/types/src/video.ts
export interface VideoSummary {
  id: string;
  youtubeId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  // ...
}

// Import in both vie-api and vie-web
import { VideoSummary } from '@vie/types';
```

### Python (vie-summarizer, vie-explainer)

Define Pydantic models, generate JSON schema if needed:

```python
# workers/summarizer/src/models/schemas.py
class SummarizeJob(BaseModel):
    video_summary_id: str
    youtube_id: str
    url: str
    user_id: str
```

### Type Sync Checklist

When adding a new type:
- [ ] Define in `packages/types` (TypeScript)
- [ ] Define in Python service schemas
- [ ] Update API docs with examples
- [ ] Verify JSON serialization matches

---

## Error Handling Across Services

### Error Flow

```
vie-web          vie-api           vie-summarizer
   │                │                    │
   │   request      │                    │
   ├───────────────▶│    queue job       │
   │                ├───────────────────▶│
   │                │                    │ error occurs
   │                │    error status    │
   │                │◀───────────────────┤
   │   websocket    │                    │
   │◀───────────────┤                    │
   │                │                    │
   show error       │                    │
```

### Error Code Consistency

All services must use the same error codes (from `docs/ERROR-HANDLING.md`):

| Code | HTTP | Service |
|------|------|---------|
| `NO_TRANSCRIPT` | 422 | vie-summarizer detects, vie-api returns |
| `VIDEO_TOO_LONG` | 422 | vie-summarizer detects, vie-api returns |
| `LLM_ERROR` | 500 | vie-summarizer/explainer detects |

### Error Translation

Each service translates errors at its boundary:

```typescript
// vie-api: Translate MCP errors to HTTP
try {
  const result = await mcp.explainAuto(...);
  return result;
} catch (error) {
  if (error.code === 'NOT_FOUND') {
    throw new HttpError(404, 'VIDEO_NOT_FOUND', 'Video not found');
  }
  throw new HttpError(500, 'INTERNAL_ERROR', 'Something went wrong');
}
```

---

## Testing Cross-Service Features

### Integration Test Strategy

```
Unit Tests           Integration Tests           E2E Tests
(per service)        (service pairs)             (full flow)
     │                     │                         │
     │                     │                         │
vie-api tests        vie-api + MongoDB         vie-web + vie-api +
vie-web tests        vie-api + RabbitMQ        vie-summarizer +
vie-summarizer       vie-api + MCP             MongoDB + RabbitMQ
tests
```

### What to Test Where

| Test Type | What to Test | Tools |
|-----------|--------------|-------|
| Unit | Service logic in isolation | Jest, pytest |
| Integration | API + Database | Supertest, TestClient |
| Contract | API response shapes | Zod, Pydantic |
| E2E | Full user flow | Playwright, Cypress |

### Integration Test Example

```typescript
// Test vie-api with mocked MCP
describe('POST /api/explain/:id/section/:sectionId', () => {
  it('returns expansion from MCP', async () => {
    // Mock MCP client
    mockMcp.explainAuto.mockResolvedValue('# Expansion content');
    
    const response = await app.inject({
      method: 'GET',
      url: '/api/explain/123/section/456',
      headers: { Authorization: `Bearer ${token}` },
    });
    
    expect(response.statusCode).toBe(200);
    expect(response.json().expansion).toContain('# Expansion');
  });
});
```

---

## Deployment Considerations

### Service Dependencies

```yaml
# Startup order matters!
1. vie-mongodb      # Database first
2. vie-rabbitmq     # Queue second
3. vie-summarizer   # Workers can start
4. vie-explainer    # MCP server ready
5. vie-api          # API connects to all
6. vie-web          # Frontend last
```

### Health Checks

Each service should verify its dependencies:

```typescript
// vie-api health check
fastify.get('/health', async () => {
  const mongoOk = await checkMongo();
  const rabbitOk = await checkRabbit();
  const mcpOk = await checkMcp();
  
  if (!mongoOk || !rabbitOk || !mcpOk) {
    return reply.code(503).send({ status: 'unhealthy', mongo: mongoOk, rabbit: rabbitOk, mcp: mcpOk });
  }
  
  return { status: 'healthy' };
});
```

---

## Quick Reference

### Which Skill to Load?

| Working on... | Primary Skill | Also Consider |
|---------------|---------------|---------------|
| vie-api route + vie-web component | backend-node, react-vite | This doc |
| vie-api + vie-summarizer | backend-node, backend-python | This doc |
| vie-api + vie-explainer | backend-node, backend-python | This doc |
| Full feature (all services) | All three + This doc | - |

### Key Documentation

| Need | Document |
|------|----------|
| REST endpoint spec | [docs/API-REST.md](./API-REST.md) |
| WebSocket events | [docs/API-WEBSOCKET.md](./API-WEBSOCKET.md) |
| MCP tool spec | [docs/API-MCP-EXPLAINER.md](./API-MCP-EXPLAINER.md) |
| Error codes | [docs/ERROR-HANDLING.md](./ERROR-HANDLING.md) |
| Data models | [docs/DATA-MODELS.md](./DATA-MODELS.md) |
