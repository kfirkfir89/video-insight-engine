# vie-explainer Context

**Last Updated:** 2026-01-08

---

## Key Files Reference

### Documentation
| File | Purpose |
|------|---------|
| `docs/SERVICE-EXPLAINER.md` | Service specification and code examples |
| `docs/API-MCP-EXPLAINER.md` | MCP tool schemas and usage |
| `docs/DATA-MODELS.md` | MongoDB collection schemas |
| `docs/Implementation /IMPL-04-EXPLAINER.md` | Step-by-step implementation guide |

### Implementation Target
| File | Purpose |
|------|---------|
| `services/explainer/src/server.py` | MCP entry point |
| `services/explainer/src/tools/explain_auto.py` | Cached expansion tool |
| `services/explainer/src/tools/explain_chat.py` | Interactive chat tool |
| `services/explainer/src/services/mongodb.py` | Database operations |
| `services/explainer/src/services/llm.py` | Claude API wrapper |

### Configuration
| File | Purpose |
|------|---------|
| `docker-compose.yml` | Service configuration (lines 84-105) |
| `.env` | Environment variables |

---

## Dependencies

### Python Packages
```
mcp>=1.0.0              # MCP Server SDK
anthropic>=0.40.0       # Claude API client
pymongo>=4.6.0          # MongoDB driver
pydantic>=2.0.0         # Data validation
pydantic-settings>=2.0.0  # Settings management
python-dotenv>=1.0.0    # .env file loading
```

### External Services
- **vie-mongodb** - MongoDB 7 database
- **Anthropic API** - Claude LLM (requires ANTHROPIC_API_KEY)

---

## MongoDB Collections Used

### systemExpansionCache (write)
```javascript
{
  _id: ObjectId,
  videoSummaryId: ObjectId,
  targetType: "section" | "concept",
  targetId: string,       // UUID
  context: { ... },       // Source data
  content: string,        // Generated markdown
  status: "completed",
  version: 1,
  model: string,
  generatedAt: Date,
  createdAt: Date
}
```
**Index:** `{ videoSummaryId: 1, targetType: 1, targetId: 1 }` (unique)

### videoSummaryCache (read)
```javascript
{
  _id: ObjectId,
  youtubeId: string,
  title: string,
  summary: {
    sections: [{ id, timestamp, title, summary, bullets }],
    concepts: [{ id, name, definition }]
  }
}
```

### memorizedItems (read)
```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  title: string,
  source: {
    videoTitle: string,
    youtubeUrl: string,
    content: { sections?, concept?, expansion? }
  },
  notes: string | null
}
```

### userChats (read/write)
```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  memorizedItemId: ObjectId,
  messages: [{ role, content, createdAt }],
  title: string | null,
  createdAt: Date,
  updatedAt: Date
}
```

---

## Environment Variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `MONGODB_URI` | No | `mongodb://vie-mongodb:27017/video-insight-engine` | Database connection |
| `ANTHROPIC_API_KEY` | Yes | - | Claude API authentication |
| `ANTHROPIC_MODEL` | No | `claude-sonnet-4-20250514` | Model to use |
| `LOG_LEVEL` | No | `debug` | Logging verbosity |

---

## Design Decisions

### 1. FastMCP vs Low-Level Server
**Decision:** Use FastMCP
**Rationale:** Cleaner decorator-based API, simpler tool registration

### 2. Sync vs Async PyMongo
**Decision:** Synchronous pymongo
**Rationale:** Simple queries, low concurrency needs, avoids motor complexity

### 3. Error Handling Pattern
**Decision:** Return JSON error objects from tools
**Rationale:** MCP tools must return strings; exceptions don't serialize well

### 4. Prompt Template Loading
**Decision:** Use `pathlib` with `__file__` relative paths
**Rationale:** Works consistently in module context and Docker

---

## Integration Points

### MCP Tool: explain_auto
```json
{
  "name": "explain_auto",
  "inputSchema": {
    "videoSummaryId": "string",
    "targetType": "section | concept",
    "targetId": "string (UUID)"
  },
  "returns": "Markdown string"
}
```

### MCP Tool: explain_chat
```json
{
  "name": "explain_chat",
  "inputSchema": {
    "memorizedItemId": "string",
    "userId": "string",
    "message": "string",
    "chatId": "string (optional)"
  },
  "returns": "JSON: { response, chatId }"
}
```

---

## Notes & Learnings

**MCP SDK API (v1.25.0):**
- The MCP Server class uses `@server.list_tools()` and `@server.call_tool()` decorators
- NOT `@server.tool()` as shown in some documentation
- Tool schemas are defined in the `list_tools()` handler
- Tool execution logic is in `call_tool()` handler

**Docker Build:**
- Direct `docker build` works fine
- `docker-compose build` has WSL bind mount issues (unrelated to code)

**Files Created:**
```
services/explainer/
├── Dockerfile
├── requirements.txt
├── pyproject.toml
└── src/
    ├── __init__.py
    ├── server.py
    ├── config.py
    ├── tools/
    │   ├── __init__.py
    │   ├── explain_auto.py
    │   └── explain_chat.py
    ├── services/
    │   ├── __init__.py
    │   ├── mongodb.py
    │   └── llm.py
    └── prompts/
        ├── explain_section.txt
        ├── explain_concept.txt
        └── chat_system.txt
```
