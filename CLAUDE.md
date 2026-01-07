# Video Insight Engine

Personal video knowledge management system.

> **For Claude Code:** Read this first, then relevant skill/doc based on task.

---

## What It Does

| Feature       | Description                                                    |
| ------------- | -------------------------------------------------------------- |
| **Summarize** | YouTube URL → Structured summary (cached)                      |
| **Explain**   | Section/concept → Documentation (cached) or chat (interactive) |
| **Memorize**  | Save content → Personal collection + chat                      |

---

## ⚠️ Critical Docs (Read First)

| Topic              | Document                                           | When to Read                  |
| ------------------ | -------------------------------------------------- | ----------------------------- |
| **Security**       | [docs/SECURITY.md](./docs/SECURITY.md)             | Auth, rate limiting, CORS     |
| **Error Handling** | [docs/ERROR-HANDLING.md](./docs/ERROR-HANDLING.md) | Error codes, retry, DLQ       |
| **Data Models**    | [docs/DATA-MODELS.md](./docs/DATA-MODELS.md)       | MongoDB schemas               |
| **MVP Phases**     | [docs/MVP-PHASES.md](./docs/MVP-PHASES.md)         | Implementation order          |
| **Cross-Cutting**  | [docs/CROSS-CUTTING.md](./docs/CROSS-CUTTING.md)   | Multi-service work, contracts |

---

## Tech Stack

| Service            | Technology                     | Port  |
| ------------------ | ------------------------------ | ----- |
| **vie-api**        | Node.js + Fastify + TypeScript | 3000  |
| **vie-web**        | React + Vite + TypeScript      | 5173  |
| **vie-summarizer** | Python + FastAPI (worker)      | 8000  |
| **vie-explainer**  | Python + MCP SDK (server)      | 8001  |
| **vie-mongodb**    | MongoDB 7                      | 27017 |
| **vie-rabbitmq**   | RabbitMQ 3                     | 5672  |

---

## Working on a Task?

### 1. Check for Active Dev Docs

```bash
ls dev/active/
```

If task exists, read the `plan.md`, `context.md`, `tasks.md`.

### 2. Load Relevant Skill

| Working on...    | Load skill                                                                         |
| ---------------- | ---------------------------------------------------------------------------------- |
| vie-api backend  | [.claude/skills/backend-node/SKILL.md](./.claude/skills/backend-node/SKILL.md)     |
| vie-web frontend | [.claude/skills/react-vite/SKILL.md](./.claude/skills/react-vite/SKILL.md)         |
| vie-summarizer   | [.claude/skills/backend-python/SKILL.md](./.claude/skills/backend-python/SKILL.md) |
| vie-explainer    | [.claude/skills/backend-python/SKILL.md](./.claude/skills/backend-python/SKILL.md) |

### 3. Check Service Documentation

| Service        | Documentation                                              |
| -------------- | ---------------------------------------------------------- |
| vie-api        | [docs/SERVICE-API.md](./docs/SERVICE-API.md)               |
| vie-web        | [docs/SERVICE-WEB.md](./docs/SERVICE-WEB.md)               |
| vie-summarizer | [docs/SERVICE-SUMMARIZER.md](./docs/SERVICE-SUMMARIZER.md) |
| vie-explainer  | [docs/SERVICE-EXPLAINER.md](./docs/SERVICE-EXPLAINER.md)   |

---

## Project Structure

See [docs/PROJECT-STRUCTURE.md](./docs/PROJECT-STRUCTURE.md) for complete folder layout.

```
video-insight-engine/
├── .claude/        # Claude Code infrastructure
├── docs/           # Documentation
├── dev/            # Task planning (survives context resets)
├── packages/       # Shared code (@vie/types, @vie/utils)
├── api/            # vie-api - MAIN GATEWAY (Node.js + Fastify)
├── workers/        # Background processors (summarizer, explainer)
├── apps/           # Frontend (web)
└── scripts/        # Utility scripts
```

---

## Available Commands

| Command             | Purpose                          |
| ------------------- | -------------------------------- |
| `/task-plan {name}` | Create task documentation        |
| `/task-plan-update` | Update docs before context reset |
| `/review`           | Code review recent changes       |
| `/test {file}`      | Generate tests                   |
| `/ship`             | Pre-deploy checklist             |
| `/security-check`   | Security audit                   |

---

## Available Agents

| Agent                    | Purpose                                   |
| ------------------------ | ----------------------------------------- |
| **plan-auditor**         | Audit docs & infrastructure before coding |
| **code-reviewer**        | Review code for issues                    |
| **refactor-planner**     | Plan safe refactoring                     |
| **test-writer**          | Generate comprehensive tests              |
| **doc-generator**        | Create documentation                      |
| **debug-investigator**   | Systematic debugging                      |
| **security-auditor**     | Security vulnerability review             |
| **api-tester**           | API endpoint testing                      |
| **frontend-error-fixer** | React/TypeScript error fixing             |

---

## Hooks (Automatic)

| Hook                      | Trigger      | Purpose                  |
| ------------------------- | ------------ | ------------------------ |
| **skill-activation**      | Every prompt | Suggests relevant skills |
| **post-tool-use-tracker** | After edits  | Tracks modified files    |

---

## Key Design Decisions

| Decision         | Choice       | Why                              |
| ---------------- | ------------ | -------------------------------- |
| EXPLAINER as MCP | MCP Server   | Two tools, future AI integration |
| System cache     | MongoDB      | Same video = one LLM call        |
| Memorized items  | Copy content | Works without source             |
| No Redis (MVP)   | Simplicity   | Add later if needed              |

---

## Quick Start

```bash
# 1. Setup
cp .env.example .env
# Add ANTHROPIC_API_KEY

# 2. Start
docker-compose up -d

# 3. Verify
curl http://localhost:3000/health
curl http://localhost:8000/health

# 4. Open
open http://localhost:5173
```

---

## When Starting Work

1. Read [dev/scratchpad.md](./dev/scratchpad.md) for recent context
2. Check `dev/active/` for current tasks
3. Run `/task-plan {task}` if starting new task
4. Skills auto-suggest based on your work
5. Quality checks run automatically on edits
6. Context saved automatically when you stop

---

## 📚 Full Documentation Index

### System

- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) - System diagram, data flows
- [docs/DATA-MODELS.md](./docs/DATA-MODELS.md) - MongoDB schemas
- [docs/CACHING.md](./docs/CACHING.md) - Cache strategy
- [docs/CROSS-CUTTING.md](./docs/CROSS-CUTTING.md) - Multi-service work

### Security & Error Handling

- [docs/SECURITY.md](./docs/SECURITY.md) - Auth, rate limiting, CORS
- [docs/ERROR-HANDLING.md](./docs/ERROR-HANDLING.md) - Error codes, retry, DLQ

### API Contracts

- [docs/API-REST.md](./docs/API-REST.md) - REST endpoints
- [docs/API-MCP-EXPLAINER.md](./docs/API-MCP-EXPLAINER.md) - MCP tools
- [docs/API-WEBSOCKET.md](./docs/API-WEBSOCKET.md) - WebSocket events

### Service Guides

- [docs/SERVICE-API.md](./docs/SERVICE-API.md) - vie-api implementation
- [docs/SERVICE-WEB.md](./docs/SERVICE-WEB.md) - vie-web implementation
- [docs/SERVICE-SUMMARIZER.md](./docs/SERVICE-SUMMARIZER.md) - vie-summarizer implementation
- [docs/SERVICE-EXPLAINER.md](./docs/SERVICE-EXPLAINER.md) - vie-explainer MCP implementation

### Infrastructure

- [docs/INFRASTRUCTURE.md](./docs/INFRASTRUCTURE.md) - Docker, networking
- [docs/MVP-PHASES.md](./docs/MVP-PHASES.md) - Implementation roadmap
