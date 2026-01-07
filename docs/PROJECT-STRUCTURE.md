# Video Insight Engine - Project Structure

Monorepo structure with API gateway at root.

```
video-insight-engine/
│
├── .github/                          # GitHub workflows
│   └── workflows/
│       ├── ci.yml                    # Lint, type-check, test
│       └── deploy.yml                # Deployment pipeline
│
├── .claude/                          # Claude Code infrastructure
│   ├── settings.json                 # Hook configuration
│   ├── skills/
│   │   ├── skill-rules.json          # Auto-activation rules
│   │   ├── backend-node/
│   │   │   ├── SKILL.md
│   │   │   └── resources/
│   │   │       ├── fastify.md
│   │   │       ├── mongodb.md
│   │   │       ├── auth.md
│   │   │       ├── errors.md
│   │   │       ├── services.md
│   │   │       ├── testing.md
│   │   │       ├── api-design.md
│   │   │       ├── security.md
│   │   │       ├── infrastructure.md
│   │   │       ├── ai-integration.md
│   │   │       ├── ai-patterns.md
│   │   │       ├── file-uploads.md
│   │   │       ├── websockets.md
│   │   │       └── complete-examples.md
│   │   ├── backend-python/
│   │   │   ├── SKILL.md
│   │   │   └── resources/
│   │   │       ├── fastapi.md
│   │   │       ├── mongodb.md
│   │   │       ├── auth.md
│   │   │       ├── errors.md
│   │   │       ├── services.md
│   │   │       ├── testing.md
│   │   │       ├── api-design.md
│   │   │       ├── security.md
│   │   │       ├── infrastructure.md
│   │   │       ├── ai-integration.md
│   │   │       ├── ai-patterns.md
│   │   │       ├── file-uploads.md
│   │   │       ├── websockets.md
│   │   │       └── complete-examples.md
│   │   └── react-vite/
│   │       ├── SKILL.md
│   │       └── resources/
│   │           ├── react.md
│   │           ├── state.md
│   │           ├── styling.md
│   │           ├── forms.md
│   │           ├── routing.md
│   │           ├── testing.md
│   │           ├── performance.md
│   │           ├── security.md
│   │           ├── ai-integration.md
│   │           ├── accessibility.md
│   │           ├── i18n.md
│   │           └── complete-examples.md
│   ├── hooks/
│   │   ├── skill-activation-prompt.sh
│   │   ├── skill-activation-prompt.ts
│   │   ├── post-tool-use-tracker.sh
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── commands/
│   │   ├── task-plan.md              # /task-plan [feature]
│   │   └── task-plan-update.md       # /task-plan-update
│   └── agents/
│       ├── code-reviewer.md
│       ├── debug-investigator.md
│       ├── doc-generator.md
│       ├── refactor-planner.md
│       ├── test-writer.md
│       ├── frontend-error-fixer.md
│       ├── security-auditor.md
│       └── api-tester.md
│
├── docs/                             # Project documentation
│   ├── ARCHITECTURE.md               # System diagram, data flows
│   ├── DATA-MODELS.md                # MongoDB schemas
│   ├── CACHING.md                    # Cache strategy
│   ├── SECURITY.md                   # Auth, rate limiting
│   ├── ERROR-HANDLING.md             # Error patterns
│   ├── INFRASTRUCTURE.md             # Docker, networking
│   ├── MVP-PHASES.md                 # Implementation roadmap
│   ├── API-REST.md                   # REST endpoints
│   ├── API-WEBSOCKET.md              # WebSocket events
│   ├── API-MCP-EXPLAINER.md          # MCP tools
│   ├── SERVICE-API.md                # vie-api details
│   ├── SERVICE-WEB.md                # vie-web details
│   ├── SERVICE-SUMMARIZER.md         # vie-summarizer details
│   └── SERVICE-EXPLAINER.md          # vie-explainer details
│
├── dev/                              # Development workspace (task planning)
│   ├── README.md                     # How to use dev docs
│   ├── active/                       # Current tasks
│   │   └── [task-name]/
│   │       ├── [task-name]-plan.md
│   │       ├── [task-name]-context.md
│   │       └── [task-name]-tasks.md
│   └── archive/                      # Completed tasks
│
├── packages/                         # Shared packages
│   ├── types/                        # Shared TypeScript types
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── user.ts               # User, Auth types
│   │       ├── video.ts              # Video, Summary types
│   │       ├── folder.ts             # Folder types
│   │       ├── memorize.ts           # Memorized item types
│   │       ├── chat.ts               # Chat types
│   │       └── api.ts                # API response types
│   │
│   ├── utils/                        # Shared utilities
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── youtube.ts            # YouTube URL parsing
│   │       ├── time.ts               # Timestamp formatting
│   │       └── validation.ts         # Common validators
│   │
│   └── eslint-config/                # Shared ESLint config
│       ├── package.json
│       └── index.js
│
├── api/                              # vie-api - MAIN GATEWAY (Node.js + Fastify)
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts                  # Entry point
│       ├── config.ts                 # Environment config
│       ├── plugins/                  # Fastify plugins
│       │   ├── mongodb.ts
│       │   ├── rabbitmq.ts
│       │   ├── jwt.ts
│       │   ├── websocket.ts
│       │   ├── mcp.ts                # MCP client to explainer
│       │   ├── cors.ts
│       │   └── rate-limit.ts
│       ├── routes/
│       │   ├── index.ts              # Route registration
│       │   ├── auth.routes.ts
│       │   ├── folders.routes.ts
│       │   ├── videos.routes.ts
│       │   ├── memorize.routes.ts
│       │   └── explain.routes.ts
│       ├── services/
│       │   ├── auth.service.ts
│       │   ├── folder.service.ts
│       │   ├── video.service.ts
│       │   ├── memorize.service.ts
│       │   └── cache.service.ts
│       ├── schemas/                  # Zod validation schemas
│       │   ├── auth.schema.ts
│       │   ├── folder.schema.ts
│       │   ├── video.schema.ts
│       │   └── memorize.schema.ts
│       ├── middleware/
│       │   └── auth.middleware.ts
│       └── types/
│           └── index.ts
│
├── workers/                          # Background workers & internal services
│   │
│   ├── summarizer/                   # vie-summarizer (Python + FastAPI)
│   │   ├── Dockerfile
│   │   ├── pyproject.toml
│   │   ├── requirements.txt
│   │   └── src/
│   │       ├── __init__.py
│   │       ├── main.py               # FastAPI health endpoint
│   │       ├── worker.py             # RabbitMQ consumer entry
│   │       ├── config.py             # Settings
│   │       ├── services/
│   │       │   ├── __init__.py
│   │       │   ├── transcript.py     # YouTube transcript fetch
│   │       │   ├── metadata.py       # Video metadata (oEmbed)
│   │       │   ├── cleaner.py        # Text normalization
│   │       │   ├── summarizer.py     # LLM orchestration
│   │       │   ├── mongodb.py        # Database ops
│   │       │   └── rabbitmq.py       # Queue ops
│   │       ├── prompts/
│   │       │   ├── section_detect.txt
│   │       │   ├── section_summary.txt
│   │       │   ├── concept_extract.txt
│   │       │   └── global_synthesis.txt
│   │       └── models/
│   │           ├── __init__.py
│   │           └── schemas.py        # Pydantic models
│   │
│   └── explainer/                    # vie-explainer (Python + MCP)
│       ├── Dockerfile
│       ├── pyproject.toml
│       ├── requirements.txt
│       └── src/
│           ├── __init__.py
│           ├── server.py             # MCP server entry
│           ├── config.py             # Settings
│           ├── tools/
│           │   ├── __init__.py
│           │   ├── explain_auto.py   # Cached expansion
│           │   └── explain_chat.py   # Interactive chat
│           ├── services/
│           │   ├── __init__.py
│           │   ├── llm.py            # Claude API wrapper
│           │   ├── cache.py          # Cache operations
│           │   └── mongodb.py        # Database ops
│           └── prompts/
│               ├── explain_section.txt
│               ├── explain_concept.txt
│               └── chat_system.txt
│
├── apps/                             # Frontend applications
│   │
│   └── web/                          # vie-web (React + Vite)
│       ├── Dockerfile
│       ├── package.json
│       ├── tsconfig.json
│       ├── vite.config.ts
│       ├── tailwind.config.js
│       ├── postcss.config.js
│       ├── index.html
│       ├── nginx.conf                # Production nginx config
│       └── src/
│           ├── main.tsx              # Entry point
│           ├── App.tsx               # App component
│           ├── vite-env.d.ts
│           ├── api/                  # API client
│           │   ├── client.ts         # Fetch wrapper
│           │   ├── auth.ts
│           │   ├── folders.ts
│           │   ├── videos.ts
│           │   ├── memorize.ts
│           │   └── explain.ts
│           ├── components/
│           │   ├── ui/               # shadcn/ui components
│           │   │   ├── button.tsx
│           │   │   ├── card.tsx
│           │   │   ├── input.tsx
│           │   │   ├── dialog.tsx
│           │   │   ├── tabs.tsx
│           │   │   ├── badge.tsx
│           │   │   ├── scroll-area.tsx
│           │   │   ├── skeleton.tsx
│           │   │   └── toast.tsx
│           │   ├── layout/
│           │   │   ├── Layout.tsx
│           │   │   ├── Header.tsx
│           │   │   └── Sidebar.tsx
│           │   ├── folders/
│           │   │   ├── FolderTree.tsx
│           │   │   ├── FolderItem.tsx
│           │   │   └── CreateFolderDialog.tsx
│           │   ├── videos/
│           │   │   ├── VideoGrid.tsx
│           │   │   ├── VideoCard.tsx
│           │   │   ├── VideoDetail.tsx
│           │   │   ├── SectionCard.tsx
│           │   │   ├── ConceptBadge.tsx
│           │   │   └── AddVideoDialog.tsx
│           │   ├── memorize/
│           │   │   ├── MemorizeDialog.tsx
│           │   │   ├── MemorizedGrid.tsx
│           │   │   ├── MemorizedCard.tsx
│           │   │   ├── MemorizedDetail.tsx
│           │   │   └── ChatPanel.tsx
│           │   └── explain/
│           │       └── ExpansionView.tsx
│           ├── hooks/
│           │   ├── useAuth.ts
│           │   ├── useFolders.ts
│           │   ├── useVideos.ts
│           │   ├── useMemorized.ts
│           │   ├── useExplain.ts
│           │   └── useWebSocket.ts
│           ├── pages/
│           │   ├── LoginPage.tsx
│           │   ├── RegisterPage.tsx
│           │   ├── DashboardPage.tsx
│           │   ├── VideoPage.tsx
│           │   └── MemorizedPage.tsx
│           ├── stores/
│           │   ├── authStore.ts
│           │   └── uiStore.ts
│           ├── types/
│           │   └── index.ts
│           └── lib/
│               ├── utils.ts
│               └── cn.ts
│
├── scripts/                          # Utility scripts
│   ├── setup.sh                      # Initial setup
│   ├── seed-db.ts                    # Database seeding
│   └── create-indexes.js             # MongoDB indexes
│
├── docker-compose.yml                # Development orchestration
├── docker-compose.prod.yml           # Production orchestration
├── .env.example                      # Environment template
├── .gitignore
├── .prettierrc
├── .eslintrc.js
├── package.json                      # Root package.json (workspaces)
├── pnpm-workspace.yaml               # pnpm workspace config
├── turbo.json                        # Turborepo config
├── CLAUDE.md                         # Project overview for Claude
└── README.md                         # Project readme
```

---

## Architecture Overview

- [docs/ARCHITECTURE.md](./ARCHITECTURE.md) - System diagram, data flows

---

## Folder Purposes

| Folder      | Purpose                           | Contains                               |
| ----------- | --------------------------------- | -------------------------------------- |
| `api/`      | **Main gateway** - the front door | Node.js + Fastify REST API             |
| `workers/`  | **Background processors**         | Python workers (summarizer, explainer) |
| `apps/`     | **User-facing apps**              | React frontend                         |
| `packages/` | **Shared code**                   | Types, utilities                       |
| `docs/`     | **Documentation**                 | All project docs                       |
| `dev/`      | **Task planning**                 | Survives context resets                |
| `.claude/`  | **Claude infrastructure**         | Skills, hooks, commands, agents        |

---

## Workspace Configuration

### Root package.json

```json
{
  "name": "video-insight-engine",
  "private": true,
  "scripts": {
    "dev": "docker-compose up -d && pnpm --parallel dev",
    "dev:api": "pnpm --filter @vie/api dev",
    "dev:web": "pnpm --filter @vie/web dev",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "test": "turbo run test",
    "clean": "turbo run clean",
    "docker:up": "docker-compose up -d",
    "docker:down": "docker-compose down",
    "docker:logs": "docker-compose logs -f"
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "prettier": "^3.0.0",
    "eslint": "^8.0.0"
  }
}
```

### pnpm-workspace.yaml

```yaml
packages:
  - "packages/*"
  - "api"
  - "workers/*"
  - "apps/*"
```

---

## Package Naming Convention

| Package      | Name         | Location        |
| ------------ | ------------ | --------------- |
| Shared types | `@vie/types` | packages/types/ |
| Shared utils | `@vie/utils` | packages/utils/ |
| API gateway  | `@vie/api`   | api/            |
| Web app      | `@vie/web`   | apps/web/       |

---

## Docker Compose Services

```yaml
services:
  vie-api:
    build: ./api
    ports: ["3000:3000"]

  vie-summarizer:
    build: ./workers/summarizer
    ports: ["8000:8000"]

  vie-explainer:
    build: ./workers/explainer
    ports: ["8001:8001"]

  vie-web:
    build: ./apps/web
    ports: ["5173:5173"]

  vie-mongodb:
    image: mongo:7
    ports: ["27017:27017"]

  vie-rabbitmq:
    image: rabbitmq:3-management
    ports: ["5672:5672", "15672:15672"]
```

---

## Why This Structure?

| Decision                   | Reason                                     |
| -------------------------- | ------------------------------------------ |
| `api/` at root             | It's THE gateway - visually prominent      |
| `workers/` not `services/` | Clearer purpose - background processors    |
| `apps/` for frontend       | Standard convention, room for mobile/admin |
| `packages/` for shared     | Explicit sharing between TS projects       |
