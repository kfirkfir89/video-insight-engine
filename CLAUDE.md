# Video Insight Engine

Personal video knowledge management system — YouTube URL to interactive knowledge app.

## Tech Stack

| Service | Tech | Port |
|---------|------|------|
| vie-api | Node.js + Fastify + TypeScript | 3000 |
| vie-web | React 19 + Vite + TypeScript + AI SDK | 5173 |
| vie-summarizer | Python + FastAPI + LiteLLM | 8000 |
| vie-assistant | Python + FastAPI + LiteLLM + Qdrant | 8001 |
| vie-admin | Python + FastAPI + React + Recharts | 8002 |
| vie-mongodb | MongoDB 7 | 27017 |
| vie-redis | Redis 7 | 6379 |
| vie-qdrant | Qdrant | 6333/6334 |

## Task Workflow

1. Check `dev/active/` for current tasks — read `plan.md`, `context.md`, `tasks.md`
2. When skill activation hook fires: READ the SKILL.md and ALL suggested resource files BEFORE writing code
3. Load skill by service: api → `backend-node`, web → `react-vite`, summarizer/assistant → `backend-python`

## Commands

| Command | Purpose |
|---------|---------|
| `/task-plan {name}` | Create task documentation |
| `/resume {task}` | Resume after chat clear |
| `/complete-task {task}` | Plan → test → security → review |
| `/review` | Code review changes |
| `/test {file}` | Generate tests |
| `/ship` | Pre-deploy checklist |
| `/security-check` | Security audit |

## Project Structure

```
video-insight-engine/
├── .claude/        # Skills, agents, hooks, commands, rules
├── docs/           # Architecture, security, error handling, services
├── dev/            # Task planning (survives context resets)
├── packages/       # @vie/shared, @vie/types, @vie/utils
├── api/            # vie-api gateway (Node.js + Fastify)
├── services/       # summarizer, assistant (Python)
├── apps/           # web frontend (React)
└── scripts/        # Utility scripts
```

## Critical Docs

| When | Read |
|------|------|
| Auth, rate limiting, CORS | [docs/SECURITY.md](./docs/SECURITY.md) |
| Error codes, retry, DLQ | [docs/ERROR-HANDLING.md](./docs/ERROR-HANDLING.md) |
| MongoDB schemas, VIEResponse | [docs/DATA-MODELS.md](./docs/DATA-MODELS.md) |
| Multi-service contracts | [docs/CROSS-CUTTING.md](./docs/CROSS-CUTTING.md) |
| System architecture | [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) |
| API contracts | [docs/API-REFERENCE.md](./docs/API-REFERENCE.md) |
| Service docs | [docs/SERVICE-API.md](./docs/SERVICE-API.md), [SERVICE-SUMMARIZER.md](./docs/SERVICE-SUMMARIZER.md), [SERVICE-ASSISTANT.md](./docs/SERVICE-ASSISTANT.md) |
| Frontend patterns | [docs/FRONTEND.md](./docs/FRONTEND.md) |

## Quick Start

```bash
cp .env.example .env  # Add ANTHROPIC_API_KEY
docker-compose up -d
curl http://localhost:3000/health && curl http://localhost:8000/health
open http://localhost:5173
```

This is a monorepo with 4 services (api, web, summarizer, assistant), shared packages (@vie/types, @vie/shared, @vie/utils), Redis+MongoDB caching (same video = instant serve at $0.00), and Qdrant for RAG-powered video chat. When the skill activation hook fires, always read SKILL.md and all suggested resources before writing any code — this is mandatory with no exceptions. Follow conventional commits, never commit to main directly, and validate all user input at system boundaries.
