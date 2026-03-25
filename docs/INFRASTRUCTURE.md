# Infrastructure

Docker setup, networking, and environment configuration.

---

## Services Overview

| Service        | Image/Build             | Port       | Purpose            |
| -------------- | ----------------------- | ---------- | ------------------ |
| vie-web        | ./apps/web              | 5173       | React frontend     |
| vie-api        | ./api                   | 3000       | Node.js backend    |
| vie-summarizer | ./services/summarizer   | 8000       | Python service     |
| vie-assistant  | ./services/assistant    | 8001       | Python RAG + chat  |
| vie-admin      | ./services/admin        | 8002       | Admin dashboard    |
| vie-mongodb    | mongo:7                 | 27017      | Database           |
| vie-redis      | redis:7-alpine          | 6379       | Response cache     |
| vie-qdrant     | qdrant/qdrant:latest    | 6333/6334  | Vector DB (RAG)    |

---

## Docker Compose

```yaml
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

  vie-redis:
    image: redis:7-alpine
    container_name: vie-redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - vie_redis_data:/data
    command: redis-server --appendonly yes
    networks:
      - vie-network

  vie-qdrant:
    image: qdrant/qdrant:latest
    container_name: vie-qdrant
    restart: unless-stopped
    ports:
      - "6333:6333"
      - "6334:6334"
    volumes:
      - vie_qdrant_data:/qdrant/storage
    networks:
      - vie-network

  # ═══════════════════════════════════════════════
  # APPLICATION SERVICES
  # ═══════════════════════════════════════════════

  vie-api:
    build:
      context: .
      dockerfile: api/Dockerfile
    container_name: vie-api
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: development
      PORT: 3000
      MONGODB_URI: mongodb://vie-mongodb:27017/video-insight-engine
      SUMMARIZER_URL: http://vie-summarizer:8000
      ASSISTANT_URL: http://vie-assistant:8001
      JWT_SECRET: ${JWT_SECRET:-dev-secret-change-in-production}
      JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET:-dev-refresh-secret-change-in-production}
      FRONTEND_URL: ${FRONTEND_URL:-http://localhost:5173}
      INTERNAL_SECRET: ${INTERNAL_SECRET:-dev-internal-secret-change-me}
    networks:
      - vie-network
    depends_on:
      vie-mongodb:
        condition: service_healthy

  vie-summarizer:
    build:
      context: .
      dockerfile: services/summarizer/Dockerfile
    container_name: vie-summarizer
    restart: unless-stopped
    ports:
      - "8000:8000"
    environment:
      PYTHONUNBUFFERED: 1
      MONGODB_URI: mongodb://vie-mongodb:27017/video-insight-engine
      LLM_PROVIDER: ${LLM_PROVIDER:-anthropic}
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY:-}
      REDIS_URL: redis://vie-redis:6379
      QDRANT_HOST: vie-qdrant
      QDRANT_PORT: 6333
      S3_BUCKET: ${S3_BUCKET:-vie-transcripts}
      AWS_REGION: ${AWS_REGION:-us-east-1}
    networks:
      - vie-network
    depends_on:
      vie-mongodb:
        condition: service_healthy

  vie-assistant:
    build:
      context: .
      dockerfile: services/assistant/Dockerfile
    container_name: vie-assistant
    restart: unless-stopped
    ports:
      - "8001:8001"
    environment:
      PYTHONUNBUFFERED: 1
      MONGODB_URI: mongodb://vie-mongodb:27017/video-insight-engine
      LLM_PROVIDER: ${LLM_PROVIDER:-anthropic}
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY:-}
      QDRANT_HOST: vie-qdrant
      QDRANT_PORT: 6333
    networks:
      - vie-network
    depends_on:
      vie-mongodb:
        condition: service_healthy

  vie-admin:
    build:
      context: .
      dockerfile: services/admin/Dockerfile
    container_name: vie-admin
    restart: unless-stopped
    ports:
      - "8002:8002"
    environment:
      PYTHONUNBUFFERED: 1
      MONGODB_URI: mongodb://vie-mongodb:27017/video-insight-engine
      ADMIN_API_KEY: ${ADMIN_API_KEY:-dev-admin-key-change-me}
      VIE_API_URL: http://vie-api:3000
      VIE_SUMMARIZER_URL: http://vie-summarizer:8000
      VIE_ASSISTANT_URL: http://vie-assistant:8001
    networks:
      - vie-network
    depends_on:
      vie-mongodb:
        condition: service_healthy

  vie-web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
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
  vie_redis_data:
  vie_qdrant_data:
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
# LLM Provider Configuration
# ────────────────────────────────────────────────────
LLM_PROVIDER=anthropic          # anthropic, openai, or gemini
LLM_FAST_PROVIDER=              # Optional: separate provider for fast model
LLM_FALLBACK_PROVIDER=          # Optional: fallback if primary fails

# Provider API Keys (set for providers you use)
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxxx
OPENAI_API_KEY=                 # Required if using OpenAI
GOOGLE_API_KEY=                 # Required if using Gemini

# ────────────────────────────────────────────────────
# JWT Authentication
# ────────────────────────────────────────────────────
JWT_SECRET=change-this-to-a-long-random-string
JWT_REFRESH_SECRET=change-this-to-another-random-string
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# ────────────────────────────────────────────────────
# Internal Service URLs
# ────────────────────────────────────────────────────
SUMMARIZER_URL=http://localhost:8000
INTERNAL_SECRET=change-this-for-inter-service-auth

# ────────────────────────────────────────────────────
# Redis (Response Cache)
# ────────────────────────────────────────────────────
REDIS_URL=redis://vie-redis:6379

# ────────────────────────────────────────────────────
# Qdrant (Vector DB for RAG)
# ────────────────────────────────────────────────────
QDRANT_HOST=vie-qdrant
QDRANT_PORT=6333

# ────────────────────────────────────────────────────
# S3 Media Storage (Frames, Transcripts)
# ────────────────────────────────────────────────────
S3_BUCKET=vie-transcripts
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_ENDPOINT_URL=              # Optional: LocalStack for local dev

# ────────────────────────────────────────────────────
# Admin Panel
# ────────────────────────────────────────────────────
ADMIN_API_KEY=change-this-admin-key

# ────────────────────────────────────────────────────
# Frontend URLs (for production)
# ────────────────────────────────────────────────────
# VITE_API_URL=https://api.yourdomain.com/api
# VITE_WS_URL=wss://api.yourdomain.com/ws
```

---

## Network Topology

```
┌──────────────────────────────────────────────────────────────────────┐
│                   vie-network (Docker bridge)                         │
│                                                                       │
│  External Access:                                                     │
│  ├── :5173 → vie-web (Frontend)                                      │
│  ├── :3000 → vie-api (API)                                           │
│  └── :8002 → vie-admin (Admin Dashboard)                             │
│                                                                       │
│  Internal Only:                                                       │
│  ├── vie-mongodb:27017    (Database)                                 │
│  ├── vie-redis:6379       (Response Cache)                           │
│  ├── vie-qdrant:6333/6334 (Vector DB)                                │
│  ├── vie-summarizer:8000  (Pipeline)                                 │
│  └── vie-assistant:8001   (RAG Chat)                                 │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Service Dependencies

```
vie-mongodb ─────┬──────────────────────────────────────────┐
vie-redis ───────┤                                          │
vie-qdrant ──────┤                                          │
                 │                                          │
                 ▼                                          ▼
           vie-api ◄──────────────────────────────── vie-assistant
                 │
                 ├──────────► vie-web
                 ├──────────► vie-admin
                 │
                 ▼
          vie-summarizer ──► vie-redis, vie-qdrant, S3
```

Startup order:

1. vie-mongodb, vie-redis, vie-qdrant (infrastructure, parallel)
2. vie-assistant (needs MongoDB, Qdrant)
3. vie-api (needs MongoDB)
4. vie-summarizer (needs MongoDB, Redis, Qdrant)
5. vie-admin (needs MongoDB)
6. vie-web (needs vie-api)

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

db.folders.createIndex({ userId: 1, path: 1 })
db.folders.createIndex({ userId: 1, parentId: 1 })

db.userVideos.createIndex({ userId: 1, videoSummaryId: 1 }, { unique: true })
db.userVideos.createIndex({ userId: 1, folderId: 1 })

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
- vie-assistant: Can run multiple instances (stateless HTTP)

### Monitoring

- Add health check endpoints to all services
- Set up log aggregation
- Track LLM API usage and costs

---

## Production Architecture

### Deployment Topology

| Component       | Host     | Purpose                                |
| --------------- | -------- | -------------------------------------- |
| vie-web (SPA)   | Vercel   | Static React app, edge CDN             |
| vie-api         | Railway  | Node.js backend, all API routes        |
| vie-summarizer  | Railway  | Python summarizer service              |
| vie-assistant   | Railway  | Python RAG + chat service              |
| vie-admin       | Railway  | Admin panel (Python + React)           |
| vie-mongodb     | Railway  | MongoDB 7 database                     |

### SSR for Shared Pages

Shared video summaries are accessible at `/s/:slug`. Vercel rewrites these requests
to the Railway-hosted API for server-side rendering of Open Graph metadata:

```
Browser ──► Vercel Edge ──► /s/:slug rewrite ──► Railway API (vie-api)
                                                    │
                                                    ▼
                                              GET /api/share/:slug/ssr
                                              Returns full HTML with OG tags
```

- Vercel serves the SPA for all other routes (client-side routing)
- `/s/*` routes are rewritten to `https://api.vie.app/api/share/:slug/ssr`
- Edge cache: 60s TTL (`s-maxage=60`), 300s stale-while-revalidate
- This enables rich link previews on social platforms (Twitter, Discord, Slack)

### CI/CD

- **GitHub Actions** runs tests on push to `main` / `dev-*` branches and on PRs to `main`
- Four parallel jobs: api, web, summarizer, assistant
- All jobs must pass before merge (fail-fast)
- See `.github/workflows/ci.yml` for configuration

### Vercel Configuration

- Config file: `vercel.json` at project root
- Build: `cd apps/web && pnpm build`
- Output: `apps/web/dist`
- Framework: Vite
- Rewrites and cache headers configured for `/s/*` share routes

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
| 5     | Assistant       | Done |

### Phase 1: Infrastructure

**Goal:** All containers running and communicating.

- Created project structure with api/, web/, summarizer/, assistant/
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
- Category detection from YouTube metadata
- Error handling for video edge cases:
  - NO_TRANSCRIPT, VIDEO_TOO_LONG, VIDEO_TOO_SHORT
  - VIDEO_UNAVAILABLE, VIDEO_RESTRICTED, LIVE_STREAM
- Retry logic with exponential backoff

### Phase 3: API Service

**Goal:** REST API with auth, videos, folders.

- Node.js Fastify service with TypeScript
- MongoDB connection and JWT authentication
- WebSocket for real-time updates
- Auth, folders, videos, explain routes
- HTTP client connection to assistant

### Phase 4: Frontend Core

**Goal:** Two-tab interface with folders and videos.

- React + Vite + TypeScript
- Tailwind CSS v4 with shadcn/ui
- React Query for server state
- Auth flow with token refresh
- Folder tree with drag-and-drop
- Video submission with SSE streaming
- Real-time status updates

### Phase 5: Assistant Service

**Goal:** RAG-powered video chat with semantic search.

- Python FastAPI service with Qdrant vector DB
- Video-scoped RAG chat with transcript embeddings
- Cached expansion generation for sections and concepts
- HTTP API integration with vie-api

### Success Criteria (All Achieved)

- [x] Register and login
- [x] Submit YouTube URL
- [x] View cached/new summary with progressive loading
- [x] Browse videos in folders
- [x] Explain sections and concepts
- [x] Chat about videos with RAG
- [x] Organize with folders

### Phase 7+: Beyond MVP (Ongoing)

The system has evolved significantly beyond the original MVP phases:

- **Plan-based pipeline**: Replaced persona detection with LLM classifier + plan stage for adaptive content extraction
- **Assembly stage**: Pure-code stage that converts extraction data into component-addressed `TabEntry[]`
- **Interactive components**: 15+ interactive renderers (Quiz, FlashDeck, Budget, Verdict, Comparison, etc.)
- **Redis response cache**: Full VIEResponse caching for instant serves
- **Qdrant vector DB**: RAG-based video chat with semantic search
- **Frame intelligence**: Vision LLM analysis of video frames, S3 storage, gallery display
- **Chunked extraction**: Chapter-aware batched extraction for long videos (>30min)
- **Admin dashboard**: LLM usage tracking, cost monitoring, video management
- **Sharing**: Public share links with SSR for OG metadata
- **Playlist support**: YouTube playlist import and batch processing
- **Multi-provider LLM**: Anthropic, OpenAI, Gemini via LiteLLM abstraction
