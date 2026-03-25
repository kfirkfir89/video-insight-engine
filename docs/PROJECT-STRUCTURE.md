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
│   ├── ARCHITECTURE.md               # System diagram, pipeline phases, SSE streaming
│   ├── DATA-MODELS.md                # MongoDB schemas, VIEResponse v2, TabEntry types
│   ├── CACHING.md                    # Cache strategy
│   ├── SECURITY.md                   # Auth, rate limiting
│   ├── ERROR-HANDLING.md             # Error patterns
│   ├── INFRASTRUCTURE.md             # Docker, networking, implementation history
│   ├── API-REFERENCE.md              # REST, WebSocket, MCP, SSE APIs
│   ├── FRONTEND.md                   # React/Vite, components, styling, state
│   ├── SERVICE-API.md                # vie-api details
│   ├── SERVICE-SUMMARIZER.md         # vie-summarizer details
│   └── SERVICE-ASSISTANT.md          # vie-assistant details
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
│   ├── shared/                       # Cross-language shared config
│   │   ├── package.json              # @vie/shared (no build step)
│   │   ├── tsconfig.json
│   │   └── src/config/
│   │       ├── domains.json          # Single source of truth: domains, tabs, gradients, categories
│   │       └── index.ts              # Type-safe TS accessors
│   │
│   ├── types/                        # Shared TypeScript types
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── common.ts             # ProcessingStatus, TranscriptSource
│   │       ├── user.ts               # User, Auth types
│   │       ├── video.ts              # Video, Summary types
│   │       ├── playlist.ts           # Playlist types
│   │       ├── share.ts              # Share types
│   │       ├── api.ts                # API response types
│   │       ├── content-blocks.ts     # ContentBlock types
│   │       ├── output-types.ts       # OutputType, SynthesisResult, EnrichmentData
│   │       └── vie-response.ts       # VIEResponse, ContentTag, TriageResult
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
│       │   ├── jwt.ts
│       │   ├── websocket.ts
│       │   ├── mcp.ts                # MCP client (legacy, unused)
│       │   ├── cors.ts
│       │   └── rate-limit.ts
│       ├── routes/
│       │   ├── index.ts              # Route registration
│       │   ├── auth.routes.ts
│       │   ├── folders.routes.ts
│       │   ├── videos.routes.ts
│       │   ├── stream.routes.ts      # SSE proxy to summarizer
│       │   ├── ssr.routes.ts         # Server-rendered share pages
│       │   ├── share.routes.ts       # Share link CRUD
│       │   └── explain.routes.ts
│       ├── services/
│       │   ├── auth.service.ts
│       │   ├── folder.service.ts
│       │   ├── video.service.ts
│       │   ├── share.service.ts      # Share link service
│       │   ├── og-image.service.ts   # OG image generation (SSRF-protected)
│       │   ├── cache.service.ts
│       │   └── summarizer-client.ts  # HTTP client for summarizer
│       ├── repositories/
│       │   ├── video.repository.ts   # Video + UserVideo CRUD
│       │   └── share.repository.ts   # Share link repository
│       ├── schemas/                  # Zod validation schemas
│       ├── templates/
│       │   └── share-page.ts         # SSR share page (XSS-safe)
│       ├── utils/
│       │   ├── errors.ts             # Domain error classes
│       │   ├── meta-builder.ts       # Shared meta/tabs resolution
│       │   ├── cors.ts               # SSE CORS helpers
│       │   └── youtube.ts            # YouTube URL parsing
│       └── middleware/
│           └── auth.middleware.ts
│
├── services/                         # Backend services
│   │
│   ├── summarizer/                   # vie-summarizer (Python + FastAPI)
│   │   ├── Dockerfile
│   │   ├── pyproject.toml
│   │   ├── requirements.txt
│   │   └── src/
│   │       ├── main.py               # FastAPI app + lifespan
│   │       ├── config.py             # Settings + model mapping
│   │       ├── routes/
│   │       │   ├── stream.py         # SSE streaming endpoint
│   │       │   └── override.py       # Detection override
│   │       ├── services/
│   │       │   ├── llm.py            # LLMService wrapper
│   │       │   ├── llm_provider.py   # LiteLLM multi-provider
│   │       │   ├── pipeline/         # Plan-based pipeline
│   │       │   │   ├── classifier.py     # LLM domain + format classification
│   │       │   │   ├── plan.py           # LLM tab layout + content tags
│   │       │   │   ├── triage.py         # Legacy triage (being replaced by plan)
│   │       │   │   ├── extractor.py      # Adaptive extraction
│   │       │   │   ├── enrichment.py     # Quiz/flashcards
│   │       │   │   ├── synthesis.py      # TLDR, takeaways
│   │       │   │   ├── assembly.py       # Extraction → TabEntry[]
│   │       │   │   └── post_processor.py # Validation
│   │       │   ├── transcription/    # Transcript fetch + storage
│   │       │   ├── media/            # Frame extraction + S3
│   │       │   └── video/            # YouTube + metadata
│   │       ├── prompts/
│   │       │   ├── manifest.txt      # Structural scan
│   │       │   ├── triage.txt        # Content tag detection
│   │       │   ├── base_extraction.txt # Schema-injection template
│   │       │   └── schemas/          # Per-domain schemas (10 files)
│   │       ├── repositories/
│   │       │   └── mongodb_repository.py
│   │       ├── utils/
│   │       │   ├── json_parsing.py   # Robust JSON recovery
│   │       │   └── llm_retry.py      # Timeout + retry + backoff
│   │       └── models/
│   │           ├── schemas.py        # Pydantic models
│   │           ├── domain_types.py   # Domain data models
│   │           ├── pipeline_types.py # Pipeline models
│   │           └── vie_response_v2.py # TabEntry, CrossTabLink
│   │
│   └── assistant/                    # vie-assistant (Python + FastAPI + Qdrant)
│       ├── Dockerfile
│       ├── pyproject.toml
│       ├── requirements.txt
│       └── src/
│           ├── main.py               # FastAPI app entry
│           ├── config.py             # Settings
│           ├── routes/
│           │   ├── explain.py        # Cached expansion endpoint
│           │   └── chat.py           # RAG video chat endpoint
│           ├── services/
│           │   ├── llm.py            # LLM wrapper (LiteLLM)
│           │   ├── rag.py            # RAG retrieval + generation
│           │   ├── embeddings.py     # Embedding generation
│           │   └── qdrant.py         # Vector DB operations
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
│       ├── vite.config.ts
│       ├── index.html
│       ├── nginx.conf                # Production nginx config
│       └── src/
│           ├── main.tsx              # Entry point
│           ├── App.tsx               # Router + providers
│           ├── index.css             # Tailwind v4 + OKLCH design tokens
│           ├── api/                  # API clients
│           │   ├── client.ts         # Fetch wrapper + auth
│           │   ├── videos.ts
│           │   └── share.ts          # Share link API
│           ├── components/
│           │   ├── ui/               # shadcn/ui (Layer 1)
│           │   ├── vie/              # VIE Library (Layer 2)
│           │   │   ├── cards/        # GlassCard, ExpandableCard, etc.
│           │   │   ├── data/         # ScoreRing, StatPill, Badge, etc.
│           │   │   ├── content/      # TextBlock, CodeSnippet, etc.
│           │   │   ├── navigation/   # TabBar, ProgressBar, etc.
│           │   │   ├── interactive/  # CheckItem, FlipCard, etc.
│           │   │   ├── feedback/     # Celebration, FadeIn, etc.
│           │   │   └── media/        # VideoClip, ImageGallery
│           │   ├── layout/           # AppHeader, Sidebar strips
│           │   ├── sidebar/          # Sidebar, FolderItem, Tabs
│           │   ├── rag/              # RAGChatPanel
│           │   ├── video-detail/     # Video output rendering
│           │   │   ├── OutputRouter.tsx       # v2/v1 routing
│           │   │   ├── output/
│           │   │   │   ├── ComposableOutput.tsx     # COMPONENT_REGISTRY
│           │   │   │   ├── DisplaySection.tsx       # Data-driven renderer
│           │   │   │   ├── CrossTabLink.tsx          # Cross-tab nav
│           │   │   │   ├── TabCoordinationContext.tsx
│           │   │   │   ├── TabLayout.tsx
│           │   │   │   ├── interactive/              # 15 interactive renderers
│           │   │   │   └── skeletons/
│           │   │   └── shell/
│           │   │       └── CollapsibleVideoPlayer.tsx
│           │   └── dev/              # DevToolPanel, showcases
│           ├── contexts/             # VideoPlayerContext
│           ├── hooks/
│           │   ├── use-summary-stream.ts    # SSE streaming
│           │   └── use-processing-manager.ts
│           ├── pages/
│           │   ├── LandingPage.tsx
│           │   ├── VideoDetailPage.tsx
│           │   ├── BoardPage.tsx
│           │   ├── SharePage.tsx
│           │   └── GeneratePage.tsx
│           ├── stores/
│           │   ├── auth-store.ts
│           │   ├── ui-store.ts
│           │   └── processing-store.ts
│           └── lib/
│               ├── stream-event-processor.ts
│               ├── stream-cache.ts
│               ├── tab-data-resolver.ts
│               └── output-type-config.ts
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
| `services/` | **Backend services**              | Python services (summarizer, assistant)|
| `apps/`     | **User-facing apps**              | React frontend                         |
| `packages/` | **Shared code**                   | Types, utilities, cross-lang config    |
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
  - "services/*"
  - "apps/*"
```

---

## Package Naming Convention

| Package      | Name         | Location        |
| ------------ | ------------ | --------------- |
| Shared config| `@vie/shared`| packages/shared/|
| Shared types | `@vie/types` | packages/types/ |
| Shared utils | `@vie/utils` | packages/utils/ |
| API gateway  | `@vie/api`   | api/            |
| Web app      | `@vie/web`   | apps/web/       |

---

## Docker Compose Services

```yaml
services:
  # Infrastructure
  vie-mongodb:
    image: mongo:7
    ports: ["27017:27017"]

  vie-redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  vie-qdrant:
    image: qdrant/qdrant:latest
    ports: ["6333:6333", "6334:6334"]

  # Application Services
  vie-api:
    build: ./api
    ports: ["3000:3000"]

  vie-summarizer:
    build: ./services/summarizer
    ports: ["8000:8000"]

  vie-assistant:
    build: ./services/assistant
    ports: ["8001:8001"]

  vie-admin:
    build: ./services/admin
    ports: ["8002:8002"]

  vie-web:
    build: ./apps/web
    ports: ["5173:5173"]
```

---

## Why This Structure?

| Decision               | Reason                                     |
| ---------------------- | ------------------------------------------ |
| `api/` at root         | It's THE gateway - visually prominent      |
| `services/` for Python | Backend services (summarizer, assistant)   |
| `apps/` for frontend   | Standard convention, room for mobile/admin |
| `packages/` for shared | Explicit sharing between TS projects       |
