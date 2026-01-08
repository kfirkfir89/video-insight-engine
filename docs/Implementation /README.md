# 🚀 Video Insight Engine - Parallel Implementation Guide

> **Vibe coding in parallel!** Each track can be worked on simultaneously.

---

## How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                    PHASE 0: SHARED                              │
│                 (Complete this FIRST)                           │
│                                                                 │
│   • Docker Compose setup                                        │
│   • Environment configuration                                   │
│   • MongoDB infrastructure                                      │
│   • Shared types package                                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│   TRACK 1     │   │   TRACK 2     │   │   TRACK 3     │
│   vie-api     │   │   vie-web     │   │ vie-services  │
│  (Node.js)    │   │   (React)     │   │  (Python)     │
│               │   │               │   │               │
│ IMPL-01-API   │   │ IMPL-02-WEB   │   │ IMPL-03/04    │
└───────────────┘   └───────────────┘   └───────────────┘
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PHASE 5: INTEGRATION                         │
│               (After all tracks complete)                       │
│                                                                 │
│   • End-to-end testing                                          │
│   • Service communication verification                          │
│   • Full user journey validation                                │
└─────────────────────────────────────────────────────────────────┘
```

---

## Quick Start

### Step 1: Complete Shared Infrastructure

```bash
# Open Claude Code and run:
/task-plan IMPL-00-SHARED
```

Wait for Phase 0 to complete before starting parallel tracks.

### Step 2: Start Parallel Tracks

Open **4 separate Claude Code sessions** and run simultaneously:

| Session    | Command                         | Track             |
| ---------- | ------------------------------- | ----------------- |
| Terminal 1 | `/task-plan IMPL-01-API`        | Node.js Backend   |
| Terminal 2 | `/task-plan IMPL-02-WEB`        | React Frontend    |
| Terminal 3 | `/task-plan IMPL-03-SUMMARIZER` | Python Worker     |
| Terminal 4 | `/task-plan IMPL-04-EXPLAINER`  | Python MCP Server |

### Step 3: Integration Testing

After all tracks show ✅:

```bash
/task-plan IMPL-05-INTEGRATION
```

---

## Implementation Files

| File                                               | Service        | Tech Stack                       | Dependencies |
| -------------------------------------------------- | -------------- | -------------------------------- | ------------ |
| [IMPL-00-SHARED.md](./IMPL-00-SHARED.md)           | Infrastructure | Docker, MongoDB                  | None         |
| [IMPL-01-API.md](./IMPL-01-API.md)                 | vie-api        | Node.js, Fastify, TypeScript     | Phase 0      |
| [IMPL-02-WEB.md](./IMPL-02-WEB.md)                 | vie-web        | React, Vite, TypeScript          | Phase 0      |
| [IMPL-03-SUMMARIZER.md](./IMPL-03-SUMMARIZER.md)   | vie-summarizer | Python, FastAPI, BackgroundTasks | Phase 0      |
| [IMPL-04-EXPLAINER.md](./IMPL-04-EXPLAINER.md)     | vie-explainer  | Python, MCP SDK                  | Phase 0      |
| [IMPL-05-INTEGRATION.md](./IMPL-05-INTEGRATION.md) | Testing        | All services                     | All tracks   |

---

## Track Details

### 🟦 Track 1: vie-api (Node.js)

**Time estimate:** 2-3 hours

```
Phases:
1. Project Setup (package.json, TypeScript)
2. Core Infrastructure (MongoDB plugin)
3. Auth Routes (register, login, refresh, logout)
4. Videos Routes (cache-first submission)
5. Folders & Memorize Routes
6. WebSocket (real-time updates)
7. Dockerfile
```

**Verification:**

```bash
curl http://localhost:3000/health
# {"status":"ok"}
```

---

### 🟩 Track 2: vie-web (React)

**Time estimate:** 2-3 hours

```
Phases:
1. Project Setup (Vite, Tailwind)
2. Project Structure (directories)
3. Core Infrastructure (API client, auth store)
4. UI Components (Button, Card, Input)
5. Pages (Login, Register, Dashboard)
6. App Setup (Router, providers)
7. Dockerfile
```

**Verification:**

```bash
open http://localhost:5173
# See login page
```

---

### 🟨 Track 3: vie-summarizer (Python)

**Time estimate:** 2-3 hours

```
Phases:
1. Project Setup (requirements.txt)
2. Configuration (settings)
3. Models (Pydantic schemas)
4. Services (MongoDB, transcript, LLM)
5. Prompts (section detection, summarization)
6. HTTP Service (FastAPI + BackgroundTasks)
7. Dockerfile
```

**Verification:**

```bash
curl http://localhost:8000/health
# {"status":"ok","service":"vie-summarizer"}
```

---

### 🟪 Track 4: vie-explainer (Python MCP)

**Time estimate:** 2 hours

```
Phases:
1. Project Setup (requirements.txt)
2. Configuration (settings)
3. Services (MongoDB, LLM)
4. Prompts (explain templates)
5. MCP Tools (explain_auto, explain_chat)
6. MCP Server
7. Dockerfile
```

**Verification:**

```bash
curl http://localhost:8001/health
# {"status":"ok","service":"vie-explainer"}
```

---

## Dependency Graph

```
                    ┌─────────────┐
                    │   Phase 0   │
                    │   Shared    │
                    └──────┬──────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
         ▼                 ▼                 ▼
   ┌───────────┐    ┌───────────┐    ┌─────────────────┐
   │ Track 1   │    │ Track 2   │    │    Track 3+4    │
   │ vie-api   │    │ vie-web   │    │ vie-summarizer  │
   │           │    │           │    │ vie-explainer   │
   └─────┬─────┘    └─────┬─────┘    └────────┬────────┘
         │                │                   │
         │                │                   │
         │    Can test    │    Can test       │
         │    with curl   │    in browser     │
         │                │    (mock data)    │
         │                │                   │
         └────────────────┼───────────────────┘
                          │
                          ▼
                    ┌───────────┐
                    │  Phase 5  │
                    │Integration│
                    └───────────┘
```

---

## Parallel Development Tips

### 1. Mock Data for Frontend

While API isn't ready, use mock data:

```typescript
// src/api/client.ts
const MOCK_MODE = !import.meta.env.VITE_API_URL;

if (MOCK_MODE) {
  return mockData.videos; // etc
}
```

### 2. Test Backend Without Frontend

Use curl or httpie:

```bash
# Register
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"Test123!","name":"Test"}'

# Submit video
curl -X POST http://localhost:3000/api/videos \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://youtube.com/watch?v=dQw4w9WgXcQ"}'
```

### 3. Test Services Independently

Trigger summarization via HTTP:

```bash
# Test summarizer directly
curl -X POST http://localhost:8000/summarize \
  -H "Content-Type: application/json" \
  -d '{
    "videoSummaryId": "test123",
    "youtubeId": "dQw4w9WgXcQ",
    "url": "https://youtube.com/watch?v=dQw4w9WgXcQ",
    "userId": "user123"
  }'
# Expected: 202 Accepted
```

---

## Status Tracking

Use this checklist to track progress across sessions:

### Phase 0: Shared ⬜

- [ ] Docker Compose running
- [ ] MongoDB healthy
- [ ] Shared types built

### Track 1: vie-api ⬜

- [ ] Project setup
- [ ] Auth routes working
- [ ] Videos routes working
- [ ] WebSocket working
- [ ] Docker build passes

### Track 2: vie-web ⬜

- [ ] Project setup
- [ ] Auth pages working
- [ ] Dashboard layout
- [ ] Video components
- [ ] Docker build passes

### Track 3: vie-summarizer ⬜

- [ ] Project setup
- [ ] Transcript fetching
- [ ] LLM pipeline
- [ ] HTTP endpoint + BackgroundTasks
- [ ] Docker build passes

### Track 4: vie-explainer ⬜

- [ ] Project setup
- [ ] explain_auto tool
- [ ] explain_chat tool
- [ ] MCP server running
- [ ] Docker build passes

### Phase 5: Integration ⬜

- [ ] All services healthy
- [ ] Auth flow works
- [ ] Video submission → processing → summary
- [ ] Explain feature works
- [ ] E2E test passes

---

## Troubleshooting

### Service won't start

```bash
# Check logs
docker-compose logs vie-api

# Check dependencies
docker-compose ps
```

### Can't connect to MongoDB

```bash
# Make sure infrastructure is running
docker-compose up -d vie-mongodb

# Wait for health checks
docker-compose ps
# Should show "healthy"
```

### Types not syncing

```bash
# Rebuild shared types
cd packages/types && pnpm build
```

---

## Success Criteria

MVP is complete when:

1. ✅ User can register and login
2. ✅ User can submit YouTube URL
3. ✅ Summary appears after processing
4. ✅ User can click "Explain" on sections
5. ✅ Real-time status updates work
6. ✅ Cache prevents duplicate processing

**Let's build! 🚀**
