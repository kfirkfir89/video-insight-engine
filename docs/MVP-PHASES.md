# MVP Implementation Phases

Step-by-step implementation roadmap.

---

## Overview

| Phase | Focus           | Est. Time |
| ----- | --------------- | --------- |
| 1     | Infrastructure  | 1 day     |
| 2     | Summarizer      | 2 days    |
| 3     | API             | 2 days    |
| 4     | Frontend Core   | 2 days    |
| 5     | EXPLAINER MCP   | 2 days    |
| 6     | Memorize + Chat | 2 days    |

**Total:** ~11 days

---

## Phase 1: Infrastructure

**Goal:** All containers running and communicating.

### Tasks

- [ ] Create project structure

  ```
  video-insight-engine/
  ├── api/
  ├── web/
  ├── summarizer/
  ├── explainer/
  ├── docker-compose.yml
  └── .env.example
  ```

- [ ] Create `docker-compose.yml` with all services
- [ ] Create `.env.example`
- [ ] Add Dockerfiles (placeholder) for each service
- [ ] Test infrastructure starts

### Security (P0 - Critical)

Read [docs/SECURITY.md](./SECURITY.md) for details.

- [ ] Rate limiting middleware
  - `/api/videos` POST: 10/day per user
  - `/api/auth/*`: 10/min per IP
- [ ] JWT refresh token flow
  - Access token: 15 min
  - Refresh token: 7 days (HttpOnly cookie)
  - `POST /auth/refresh` endpoint
  - `POST /auth/logout` endpoint
- [ ] CORS configuration for vie-web origin
- [ ] Password validation (8+ chars, upper/lower/number)
- [ ] Security headers via helmet

### Verification

```bash
docker-compose up -d
docker-compose ps  # All services running

# Health checks
curl http://localhost:3000/health   # API placeholder
curl http://localhost:8000/health   # Summarizer placeholder
```

### Deliverables

- `docker-compose.yml`
- `.env.example`
- Placeholder Dockerfiles for all services
- Security middleware ready

---

## Phase 2: Summarizer Service

**Goal:** YouTube URL → Summary in cache.

### Tasks

- [ ] Set up Python project

  - `requirements.txt`
  - `src/` structure
  - Dockerfile

- [ ] Implement transcript fetching

  - `youtube-transcript-api`
  - Error handling (no captions, etc.)

- [ ] Implement metadata fetching

  - YouTube oEmbed API
  - Title, channel, thumbnail

- [ ] Implement LLM pipeline

  - Section detection prompt
  - Section summarization prompt
  - Concept extraction prompt
  - Global synthesis prompt

- [ ] Implement RabbitMQ consumer

  - Consume from `summarize.jobs`
  - Publish to `job.status`

- [ ] Implement MongoDB operations
  - Update `videoSummaryCache`
  - Handle status transitions

### Error Handling (P0 - Critical)

Read [docs/ERROR-HANDLING.md](./ERROR-HANDLING.md) for details.

- [ ] Video edge case detection (before queuing)
  - NO_TRANSCRIPT - No captions available
  - VIDEO_TOO_LONG - > 180 minutes
  - VIDEO_TOO_SHORT - < 60 seconds
  - VIDEO_UNAVAILABLE - Private/deleted
  - VIDEO_RESTRICTED - Age-restricted
  - LIVE_STREAM - Is a live stream
- [ ] Retry logic with exponential backoff
  - 3 attempts: [5s, 15s, 60s]
  - Fallback to Haiku for retries
- [ ] Dead letter queue for failed jobs
  - Configure RabbitMQ DLQ
  - Log failed job details
- [ ] Manual retry endpoint
  - `POST /api/videos/:id/retry`

### Verification

```bash
# Manually publish job to RabbitMQ
# Check videoSummaryCache for result
docker exec vie-mongodb mongosh --eval \
  "db.videoSummaryCache.find().pretty()"
```

### Deliverables

- Working summarizer service
- Prompts in `src/prompts/`
- Can process YouTube URL end-to-end
- Robust error handling for all edge cases

---

## Phase 3: API Service

**Goal:** REST API with auth, videos, folders.

### Tasks

- [ ] Set up Node.js project

  - `package.json`
  - TypeScript config
  - Fastify setup
  - Dockerfile

- [ ] Implement plugins

  - MongoDB connection
  - RabbitMQ connection
  - JWT authentication
  - WebSocket

- [ ] Implement auth routes

  - POST /auth/register
  - POST /auth/login
  - GET /auth/me

- [ ] Implement folders routes

  - CRUD operations
  - Materialized path updates

- [ ] Implement videos routes

  - Cache-first submission
  - List, get, delete

- [ ] Implement WebSocket
  - Subscribe to `job.status`
  - Broadcast to connected users

### Verification

```bash
# Register user
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test123","name":"Test"}'

# Submit video
curl -X POST http://localhost:3000/api/videos \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://youtube.com/watch?v=..."}'
```

### Deliverables

- Working API service
- Auth flow complete
- Videos route with cache-first logic
- WebSocket broadcasting status

---

## Phase 4: Frontend Core

**Goal:** Two-tab interface with folders and videos.

### Tasks

- [ ] Set up React project

  - Vite + TypeScript
  - Tailwind CSS
  - shadcn/ui
  - React Query
  - Dockerfile

- [ ] Implement auth pages

  - Login page
  - Register page
  - Auth context/hook

- [ ] Implement layout

  - Header with user info
  - Two-tab layout
  - Folder sidebar

- [ ] Implement folder components

  - FolderTree
  - CreateFolderDialog

- [ ] Implement video components

  - VideoGrid
  - VideoCard
  - AddVideoDialog
  - VideoDetail page

- [ ] Implement WebSocket hook
  - Connect on auth
  - Update UI on status changes

### Verification

- Register new account
- Create folders
- Submit YouTube URL
- See real-time status updates
- View completed summary

### Deliverables

- Working frontend
- Auth flow
- Summarized tab complete
- Real-time updates

---

## Phase 5: EXPLAINER MCP

**Goal:** MCP server with explain_auto and explain_chat tools.

### Tasks

- [ ] Set up Python MCP project

  - `mcp` SDK
  - Project structure
  - Dockerfile

- [ ] Implement explain_auto tool

  - Cache check (systemExpansionCache)
  - Load context from videoSummaryCache
  - Generate with LLM
  - Save to cache

- [ ] Implement explain_chat tool

  - Load memorized item
  - Load/create chat
  - Build conversation context
  - Generate response
  - Save to userChats

- [ ] Create prompts

  - explain_section.txt
  - explain_concept.txt
  - chat_system.txt

- [ ] Connect API as MCP client

  - Add mcp plugin to vie-api
  - Implement explain routes

- [ ] Update frontend
  - Explain button on sections/concepts
  - ExpansionView panel

### Verification

```bash
# Test MCP server directly
mcp dev src/server.py

# Test via API
curl http://localhost:3000/api/explain/{videoSummaryId}/section/{sectionId}
```

### Deliverables

- Working MCP server
- explain_auto with caching
- explain_chat for conversations
- API integration
- Frontend explain UI

---

## Phase 6: Memorize + Chat

**Goal:** Complete memorize workflow with chat.

### Tasks

- [ ] Implement memorize API routes

  - POST /memorize (create)
  - GET /memorize (list)
  - GET /memorize/:id (detail)
  - PATCH /memorize/:id (update)
  - DELETE /memorize/:id

- [ ] Implement chat API routes

  - POST /explain/chat
  - GET /memorize/:id/chats

- [ ] Frontend: Memorize flow

  - MemorizeDialog
  - Select section/concept/expansion
  - Choose folder
  - Add tags

- [ ] Frontend: Memorized tab

  - MemorizedGrid
  - MemorizedCard
  - MemorizedDetail page

- [ ] Frontend: Chat UI

  - ChatPanel component
  - Message history
  - Send message
  - Streaming (optional)

- [ ] Frontend: Notes
  - NotesEditor
  - Save notes to item

### Verification

- Memorize a section from video
- View in Memorized tab
- Open chat, ask questions
- Add notes
- Organize in folders

### Deliverables

- Complete memorize workflow
- Chat interface working
- Notes editing
- Full two-tab experience

---

## Success Criteria

MVP is complete when user can:

- [x] Register and login
- [x] Submit YouTube URL
- [x] View cached/new summary
- [x] Browse videos in folders
- [x] Explain sections and concepts
- [x] Memorize any content
- [x] Chat about memorized items
- [x] Organize with folders
- [x] Add notes to items

---

## Post-MVP Features

| Feature     | Priority | Description                        |
| ----------- | -------- | ---------------------------------- |
| Export      | High     | Export memorized items as markdown |
| Search      | High     | Full-text search across content    |
| Tags        | Medium   | Tag-based organization             |
| Bulk import | Medium   | Import from YouTube playlists      |
| Sharing     | Low      | Share memorized items              |
| Mobile      | Low      | Responsive design / native app     |
