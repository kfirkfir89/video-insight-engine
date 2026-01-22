# Infrastructure

Docker setup, networking, and environment configuration.

---

## Services Overview

| Service        | Image/Build             | Port  | Purpose           |
| -------------- | ----------------------- | ----- | ----------------- |
| vie-web        | ./apps/web              | 5173  | React frontend    |
| vie-api        | ./api                   | 3000  | Node.js backend   |
| vie-summarizer | ./services/summarizer   | 8000  | Python service    |
| vie-explainer  | ./services/explainer    | 8001  | Python MCP server |
| vie-mongodb    | mongo:7                 | 27017 | Database          |

---

## Docker Compose

```yaml
version: "3.8"

services:
  # ═══════════════════════════════════════════════
  # INFRASTRUCTURE
  # ═══════════════════════════════════════════════

  vie-mongodb:
    image: mongo:7
    container_name: vie-mongodb
    restart: unless-stopped
    ports:
      - "27017:27017"
    volumes:
      - vie_mongodb_data:/data/db
    environment:
      MONGO_INITDB_DATABASE: video-insight-engine
    networks:
      - vie-network
    healthcheck:
      test: echo 'db.runCommand("ping").ok' | mongosh localhost:27017/test --quiet
      interval: 10s
      timeout: 5s
      retries: 5

  # ═══════════════════════════════════════════════
  # APPLICATION SERVICES
  # ═══════════════════════════════════════════════

  vie-api:
    build:
      context: ./api
      dockerfile: Dockerfile
    container_name: vie-api
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: development
      PORT: 3000
      MONGODB_URI: mongodb://vie-mongodb:27017/video-insight-engine
      SUMMARIZER_URL: http://vie-summarizer:8000
      JWT_SECRET: ${JWT_SECRET:-dev-secret-change-in-production}
      JWT_EXPIRES_IN: ${JWT_EXPIRES_IN:-7d}
    networks:
      - vie-network
    depends_on:
      vie-mongodb:
        condition: service_healthy
      vie-explainer:
        condition: service_started

  vie-summarizer:
    build:
      context: ./services/summarizer
      dockerfile: Dockerfile
    container_name: vie-summarizer
    restart: unless-stopped
    ports:
      - "8000:8000"
    environment:
      PYTHONUNBUFFERED: 1
      MONGODB_URI: mongodb://vie-mongodb:27017/video-insight-engine
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
      ANTHROPIC_MODEL: ${ANTHROPIC_MODEL:-claude-sonnet-4-20250514}
    networks:
      - vie-network
    depends_on:
      vie-mongodb:
        condition: service_healthy

  vie-explainer:
    build:
      context: ./services/explainer
      dockerfile: Dockerfile
    container_name: vie-explainer
    restart: unless-stopped
    ports:
      - "8001:8001"
    environment:
      PYTHONUNBUFFERED: 1
      MONGODB_URI: mongodb://vie-mongodb:27017/video-insight-engine
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
      ANTHROPIC_MODEL: ${ANTHROPIC_MODEL:-claude-sonnet-4-20250514}
    networks:
      - vie-network
    depends_on:
      vie-mongodb:
        condition: service_healthy

  vie-web:
    build:
      context: ./apps/web
      dockerfile: Dockerfile
    container_name: vie-web
    restart: unless-stopped
    ports:
      - "5173:5173"
    environment:
      VITE_API_URL: http://localhost:3000/api
      VITE_WS_URL: ws://localhost:3000/ws
    networks:
      - vie-network
    depends_on:
      - vie-api

networks:
  vie-network:
    driver: bridge

volumes:
  vie_mongodb_data:
```

---

## Environment Variables

### .env.example

```bash
# ════════════════════════════════════════════════════
# VIDEO INSIGHT ENGINE
# ════════════════════════════════════════════════════
# Copy to .env and fill in values

# ────────────────────────────────────────────────────
# Anthropic Claude API (REQUIRED)
# ────────────────────────────────────────────────────
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxxx
ANTHROPIC_MODEL=claude-sonnet-4-20250514

# ────────────────────────────────────────────────────
# JWT Authentication
# ────────────────────────────────────────────────────
JWT_SECRET=change-this-to-a-long-random-string
JWT_EXPIRES_IN=7d

# ────────────────────────────────────────────────────
# Internal Service URLs
# ────────────────────────────────────────────────────
SUMMARIZER_URL=http://localhost:8000

# ────────────────────────────────────────────────────
# Frontend URLs (for production)
# ────────────────────────────────────────────────────
# VITE_API_URL=https://api.yourdomain.com/api
# VITE_WS_URL=wss://api.yourdomain.com/ws
```

---

## Network Topology

```
┌─────────────────────────────────────────────────────────────────┐
│                   vie-network (Docker bridge)                    │
│                                                                  │
│  External Access:                                                │
│  ├── :5173 → vie-web (Frontend)                                 │
│  └── :3000 → vie-api (API)                                      │
│                                                                  │
│  Internal Only:                                                  │
│  ├── vie-mongodb:27017                                          │
│  ├── vie-summarizer:8000                                        │
│  └── vie-explainer:8001                                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Service Dependencies

```
vie-mongodb ─────┬─────────────────────────────────┐
                 │                                 │
                 ▼                                 ▼
           vie-api ◄─────────────────────── vie-explainer
                 │
                 ├──────────► vie-web
                 │
                 ▼
          vie-summarizer
```

Startup order:

1. vie-mongodb
2. vie-explainer (needs MongoDB)
3. vie-api (needs MongoDB, Explainer)
4. vie-summarizer (needs MongoDB)
5. vie-web (needs vie-api)

---

## Commands

### Development

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f vie-api

# Rebuild after changes
docker-compose up -d --build vie-api

# Stop all
docker-compose down

# Stop and remove volumes (fresh start)
docker-compose down -v
```

### Health Checks

```bash
# API
curl http://localhost:3000/health

# Summarizer
curl http://localhost:8000/health

# MongoDB
docker exec vie-mongodb mongosh --eval "db.runCommand('ping')"
```

---

## MongoDB Setup

Collections are created automatically. To set up indexes:

```javascript
// Connect to MongoDB
mongosh "mongodb://localhost:27017/video-insight-engine"

// System cache indexes
db.videoSummaryCache.createIndex({ youtubeId: 1 }, { unique: true })
db.videoSummaryCache.createIndex({ status: 1 })

db.systemExpansionCache.createIndex(
  { videoSummaryId: 1, targetType: 1, targetId: 1 },
  { unique: true }
)

// User data indexes
db.users.createIndex({ email: 1 }, { unique: true })

db.folders.createIndex({ userId: 1, type: 1, path: 1 })
db.folders.createIndex({ userId: 1, parentId: 1 })

db.userVideos.createIndex({ userId: 1, videoSummaryId: 1 }, { unique: true })
db.userVideos.createIndex({ userId: 1, folderId: 1 })

db.memorizedItems.createIndex({ userId: 1, folderId: 1 })
db.memorizedItems.createIndex({ userId: 1, "source.videoSummaryId": 1 })

db.userChats.createIndex({ userId: 1, memorizedItemId: 1 })
```

---

## Production Considerations

### Security

- Change JWT_SECRET to a strong random string
- Don't expose MongoDB port externally
- Use HTTPS for vie-api and vie-web

### Scaling

- vie-summarizer: Can run multiple instances (load balanced)
- vie-api: Can run multiple instances (add load balancer)
- vie-explainer: One instance per vie-api (MCP connection)

### Monitoring

- Add health check endpoints to all services
- Set up log aggregation
- Track LLM API usage and costs

---

## Implementation History

This section documents the MVP implementation phases that were followed to build the system.

### Phase Overview

| Phase | Focus           | Status |
| ----- | --------------- | ------ |
| 1     | Infrastructure  | Done |
| 2     | Summarizer      | Done |
| 3     | API             | Done |
| 4     | Frontend Core   | Done |
| 5     | EXPLAINER MCP   | Done |
| 6     | Memorize + Chat | Done |

### Phase 1: Infrastructure

**Goal:** All containers running and communicating.

- Created project structure with api/, web/, summarizer/, explainer/
- Set up Docker Compose with all services
- Implemented security middleware:
  - Rate limiting (10/day per user for videos, 10/min per IP for auth)
  - JWT refresh token flow (15 min access, 7 day refresh)
  - CORS configuration
  - Password validation
  - Security headers via helmet

### Phase 2: Summarizer Service

**Goal:** YouTube URL → Summary in cache.

- Python FastAPI service with SSE streaming
- Transcript fetching via yt-dlp
- Metadata and chapter extraction
- LLM pipeline with parallel processing
- Persona detection from YouTube metadata
- Error handling for video edge cases:
  - NO_TRANSCRIPT, VIDEO_TOO_LONG, VIDEO_TOO_SHORT
  - VIDEO_UNAVAILABLE, VIDEO_RESTRICTED, LIVE_STREAM
- Retry logic with exponential backoff

### Phase 3: API Service

**Goal:** REST API with auth, videos, folders.

- Node.js Fastify service with TypeScript
- MongoDB connection and JWT authentication
- WebSocket for real-time updates
- Auth, folders, videos, explain, memorize routes
- MCP client connection to explainer

### Phase 4: Frontend Core

**Goal:** Two-tab interface with folders and videos.

- React + Vite + TypeScript
- Tailwind CSS v4 with shadcn/ui
- React Query for server state
- Auth flow with token refresh
- Folder tree with drag-and-drop
- Video submission with SSE streaming
- Real-time status updates

### Phase 5: EXPLAINER MCP

**Goal:** MCP server with explain_auto and explain_chat tools.

- Python MCP SDK server
- explain_auto: cached documentation generation
- explain_chat: interactive conversations
- System expansion cache for shared results
- API integration as MCP client

### Phase 6: Memorize + Chat

**Goal:** Complete memorize workflow with chat.

- Memorize API routes (CRUD)
- Chat with streaming responses
- Memorized items grid and detail view
- Notes editing with auto-save
- Chat history with continuation

### Success Criteria (All Achieved)

- [x] Register and login
- [x] Submit YouTube URL
- [x] View cached/new summary with progressive loading
- [x] Browse videos in folders
- [x] Explain sections and concepts
- [x] Memorize any content
- [x] Chat about memorized items
- [x] Organize with folders
- [x] Add notes to items

### Post-MVP Features (Planned)

| Feature     | Priority | Description                        |
| ----------- | -------- | ---------------------------------- |
| Export      | High     | Export memorized items as markdown |
| Search      | High     | Full-text search across content    |
| Tags        | Medium   | Tag-based organization             |
| Bulk import | Medium   | Import from YouTube playlists      |
| Sharing     | Low      | Share memorized items              |
| Mobile      | Low      | Responsive design / native app     |
