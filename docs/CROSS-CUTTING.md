# Cross-Cutting Concerns

Guidelines for work that spans multiple services.

---

## When Does This Apply?

Use this guide when your task involves:

- Frontend + Backend changes (new API endpoint + UI)
- vie-api + vie-summarizer (HTTP calls, status updates)
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
- All API contracts → `docs/API-REFERENCE.md` (REST, WebSocket, MCP, SSE)

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

### vie-api ↔ vie-summarizer (Async via HTTP)

```
┌─────────┐    POST /summarize    ┌──────────────┐
│ vie-api │──────────────────────▶│vie-summarizer│
└─────────┘                       └──────┬───────┘
     │                                   │
     │ Returns to user                   │
     │ immediately                       │ Background
     ▼                                   │ task runs
  User sees                              │
  "processing"                           │
                                         │ Updates DB
     Frontend polls ◀────────────────────┘
```

**Pattern:**
1. vie-api sends POST request to vie-summarizer with job details
2. vie-summarizer immediately returns 202 Accepted
3. vie-summarizer processes in background (FastAPI BackgroundTasks)
4. vie-summarizer updates MongoDB status directly
5. Frontend polls for status or receives WebSocket update

**Key files:**
- `api/src/services/summarizer-client.ts`
- `services/summarizer/src/main.py`
- `docs/API-REFERENCE.md`

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
- `services/explainer/src/server.py`
- `docs/API-REFERENCE.md`

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
# services/summarizer/src/models/schemas.py
class SummarizeRequest(BaseModel):
    videoSummaryId: str
    youtubeId: str
    url: str
    userId: str | None = None
```

### VIEResponse Contract (v2)

The pipeline produces two output formats stored side-by-side for backward compatibility:

| Field            | Format | Description                              |
| ---------------- | ------ | ---------------------------------------- |
| `triage`         | v1     | Content tags + tab layout (legacy)       |
| `output`         | v1     | Extraction + synthesis + enrichment      |
| `assembledMeta`  | v2     | VIEResponseMeta (domain, title, etc.)    |
| `assembledTabs`  | v2     | TabEntry[] (component-addressed tabs)    |

The frontend checks for `assembledTabs` first (v2 path). If absent, it falls back to building a VIEResponse from `triage` + `output` (v1 path).

### Assembly Stage as Cross-Cutting Concern

The assembly stage (`services/summarizer/src/services/pipeline/assembly.py`) produces `TabEntry[]` that must be understood by both:

- **Python (summarizer)**: Produces and stores the assembled tabs
- **TypeScript (web)**: Renders tabs via `COMPONENT_REGISTRY` in `ComposableOutput.tsx`

Each `TabEntry` has: `{ id, label, emoji, component, props, crossTabLinks? }`

The `component` field maps to a React renderer. Adding a new component requires updates in both the Python assembler registry and the TypeScript component registry.

### Type Sync Checklist

When adding a new type:
- [ ] Define in `packages/types` (TypeScript)
- [ ] Define in Python service schemas
- [ ] Update API docs with examples
- [ ] Verify JSON serialization matches
- [ ] If TabEntry-related: update both assembly.py and ComposableOutput.tsx

---

## Error Handling Across Services

### Error Flow

```
vie-web          vie-api           vie-summarizer
   │                │                    │
   │   request      │                    │
   ├───────────────▶│    HTTP POST       │
   │                ├───────────────────▶│
   │                │                    │ error occurs
   │                │    (updates DB)    │
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
vie-web tests        vie-api + Summarizer      vie-summarizer +
vie-summarizer                                 MongoDB
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
2. vie-summarizer   # Service can start
3. vie-explainer    # MCP server ready
4. vie-api          # API connects to all
5. vie-web          # Frontend last
```

### Health Checks

Each service should verify its dependencies:

```typescript
// vie-api health check
fastify.get('/health', async () => {
  const mongoOk = await checkMongo();
  const mcpOk = await checkMcp();

  if (!mongoOk || !mcpOk) {
    return reply.code(503).send({ status: 'unhealthy', mongo: mongoOk, mcp: mcpOk });
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
| API contracts (REST, WebSocket, MCP, SSE) | [docs/API-REFERENCE.md](./API-REFERENCE.md) |
| Error codes | [docs/ERROR-HANDLING.md](./ERROR-HANDLING.md) |
| Data models | [docs/DATA-MODELS.md](./DATA-MODELS.md) |
