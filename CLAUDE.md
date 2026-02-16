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

| Topic              | Document                                           | When to Read                        |
| ------------------ | -------------------------------------------------- | ----------------------------------- |
| **Security**       | [docs/SECURITY.md](./docs/SECURITY.md)             | Auth, rate limiting, CORS           |
| **Error Handling** | [docs/ERROR-HANDLING.md](./docs/ERROR-HANDLING.md) | Error codes, retry, DLQ             |
| **Data Models**    | [docs/DATA-MODELS.md](./docs/DATA-MODELS.md)       | MongoDB schemas, ContentBlock types |
| **Cross-Cutting**  | [docs/CROSS-CUTTING.md](./docs/CROSS-CUTTING.md)   | Multi-service work, contracts       |

---

## Tech Stack

| Service            | Technology                                   | Port  |
| ------------------ | -------------------------------------------- | ----- |
| **vie-api**        | Node.js + Fastify + TypeScript + AI          | 3000  |
| **vie-web**        | React + Vite + TypeScript + AI SDK           | 5173  |
| **vie-summarizer** | Python + FastAPI + LiteLLM (Multi-Provider)  | 8000  |
| **vie-explainer**  | Python + Starlette + FastMCP + LiteLLM       | 8001  |
| **vie-mongodb**    | MongoDB 7                                    | 27017 |

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
| vie-web        | [docs/FRONTEND.md](./docs/FRONTEND.md)                     |
| vie-summarizer | [docs/SERVICE-SUMMARIZER.md](./docs/SERVICE-SUMMARIZER.md) |
| vie-explainer  | [docs/SERVICE-EXPLAINER.md](./docs/SERVICE-EXPLAINER.md)   |

---

## ⚠️ MANDATORY RULES

### Skill Enforcement (CRITICAL)

**When the skill activation hook fires, you MUST:**

1. **READ the SKILL.md file** using the Read tool
2. **READ all suggested resource files** using the Read tool
3. **APPLY the patterns** from those files in your response

This is NOT optional. Do NOT write code until you have read the activated skills.

### Rules Reference

Check [.claude/rules/](./.claude/rules/) for detailed guidelines:

| Rule | File | Enforcement |
|------|------|-------------|
| Skill Reading | [skill-enforcement.md](./.claude/rules/skill-enforcement.md) | **MANDATORY** |
| Code Quality | [code-quality.md](./.claude/rules/code-quality.md) | Required |
| Security | [security.md](./.claude/rules/security.md) | Required |
| Testing | [testing.md](./.claude/rules/testing.md) | Required |
| Git Workflow | [git-workflow.md](./.claude/rules/git-workflow.md) | Required |

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
├── services/       # Backend services (summarizer, explainer)
├── apps/           # Frontend (web)
└── scripts/        # Utility scripts
```

---

## Available Commands

| Command                  | Purpose                                        |
| ------------------------ | ---------------------------------------------- |
| `/task-plan {name}`      | Create task documentation                      |
| `/task-plan-update`      | Update docs before context reset               |
| `/list-tasks`            | List all active tasks with status              |
| `/resume {task}`         | Resume an active task after chat clear         |
| `/complete-task {task}`  | Full workflow: plan → test → security → review |
| `/update-docs {changes}` | Update docs/, CLAUDE.md, README.md             |
| `/review`                | Code review recent changes                     |
| `/test {file}`           | Generate tests                                 |
| `/ship`                  | Pre-deploy checklist                           |
| `/security-check`        | Security audit                                 |

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

- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) - System diagram, persona detection, SSE pipeline
- [docs/DATA-MODELS.md](./docs/DATA-MODELS.md) - MongoDB schemas, ContentBlock types, VideoContext
- [docs/CACHING.md](./docs/CACHING.md) - Cache strategy
- [docs/CROSS-CUTTING.md](./docs/CROSS-CUTTING.md) - Multi-service work

### Security & Error Handling

- [docs/SECURITY.md](./docs/SECURITY.md) - Auth, rate limiting, CORS
- [docs/ERROR-HANDLING.md](./docs/ERROR-HANDLING.md) - Error codes, retry, DLQ

### API & Services

- [docs/API-REFERENCE.md](./docs/API-REFERENCE.md) - REST, WebSocket, MCP, SSE APIs
- [docs/SERVICE-API.md](./docs/SERVICE-API.md) - vie-api implementation
- [docs/SERVICE-SUMMARIZER.md](./docs/SERVICE-SUMMARIZER.md) - vie-summarizer implementation
- [docs/SERVICE-EXPLAINER.md](./docs/SERVICE-EXPLAINER.md) - vie-explainer MCP implementation

### Frontend

- [docs/FRONTEND.md](./docs/FRONTEND.md) - React/Vite, components, styling, state

### Infrastructure

- [docs/INFRASTRUCTURE.md](./docs/INFRASTRUCTURE.md) - Docker, networking, implementation history
