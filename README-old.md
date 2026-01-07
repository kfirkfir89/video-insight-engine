# Video Insight Engine

Transform YouTube videos into structured, searchable knowledge.

## Features

**Summarize** - Paste YouTube URL → Get structured summary with timestamps → Organize in folders

**Memorize** - Save any part (sections, concepts, expansions) → Chat, add notes, export → "Favorites on steroids"

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   vie-web   │────▶│   vie-api   │────▶│vie-summarizer│
│ Vite/React  │     │   Fastify   │     │   Python    │
│   :5173     │     │    :3000    │     │    :8000    │
└─────────────┘     └──────┬──────┘     └──────┬──────┘
                           │                   │
                           │ MCP              │
                           ▼                   │
                    ┌─────────────┐            │
                    │vie-explainer │            │
                    │ MCP Server  │            │
                    │   :8001     │            │
                    └──────┬──────┘            │
                           │                   │
                    ┌──────┴──────┐     ┌──────┴──────┐
                    │   MongoDB   │     │  RabbitMQ   │
                    │   :27017    │     │    :5672    │
                    └─────────────┘     └─────────────┘
```

## Quick Start

```bash
# Clone
git clone https://github.com/yourusername/video-insight-engine.git
cd video-insight-engine

# Configure
cp .env.example .env
# Edit .env → Add your ANTHROPIC_API_KEY and generate JWT secrets

# Start
docker-compose up -d

# Verify
curl http://localhost:3000/health
curl http://localhost:8000/health

# Open
open http://localhost:5173
```

## Services

| Service        | Port  | Description                             |
| -------------- | ----- | --------------------------------------- |
| vie-web        | 5173  | React frontend                          |
| vie-api        | 3000  | Node.js backend (MCP client)            |
| vie-summarizer | 8000  | YouTube → Summary worker                |
| vie-explainer  | 8001  | MCP server (explain_auto, explain_chat) |
| vie-mongodb    | 27017 | Database                                |
| vie-rabbitmq   | 5672  | Message queue                           |
| vie-rabbitmq   | 15672 | RabbitMQ UI (dev)                       |

## Documentation

### Overview

| Document                                       | Description                  |
| ---------------------------------------------- | ---------------------------- |
| [CLAUDE.md](./CLAUDE.md)                       | Project overview & links     |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | System diagrams & data flows |
| [docs/DATA-MODELS.md](./docs/DATA-MODELS.md)   | MongoDB schemas              |
| [docs/CACHING.md](./docs/CACHING.md)           | Cache strategy               |
| [docs/MVP-PHASES.md](./docs/MVP-PHASES.md)     | Implementation roadmap       |

### API Reference

| Document                                                 | Description         |
| -------------------------------------------------------- | ------------------- |
| [docs/API-REST.md](./docs/API-REST.md)                   | REST API reference  |
| [docs/API-WEBSOCKET.md](./docs/API-WEBSOCKET.md)         | WebSocket events    |
| [docs/API-MCP-EXPLAINER.md](./docs/API-MCP-EXPLAINER.md) | MCP tools reference |

### Operations

| Document                                           | Description                  |
| -------------------------------------------------- | ---------------------------- |
| [docs/SECURITY.md](./docs/SECURITY.md)             | Auth, rate limiting, CORS    |
| [docs/ERROR-HANDLING.md](./docs/ERROR-HANDLING.md) | Error codes & retry strategy |
| [docs/INFRASTRUCTURE.md](./docs/INFRASTRUCTURE.md) | Docker & networking          |
| [docs/CROSS-CUTTING.md](./docs/CROSS-CUTTING.md)   | Multi-service development    |

### Service Guides

| Document                                                   | Description              |
| ---------------------------------------------------------- | ------------------------ |
| [docs/SERVICE-API.md](./docs/SERVICE-API.md)               | vie-api implementation   |
| [docs/SERVICE-WEB.md](./docs/SERVICE-WEB.md)               | vie-web implementation   |
| [docs/SERVICE-SUMMARIZER.md](./docs/SERVICE-SUMMARIZER.md) | vie-summarizer details   |
| [docs/SERVICE-EXPLAINER.md](./docs/SERVICE-EXPLAINER.md)   | vie-explainer MCP server |

## Tech Stack

- **Frontend:** Vite + React + TypeScript + Tailwind + shadcn/ui
- **Backend:** Node.js + Fastify + TypeScript
- **Summarizer:** Python + youtube-transcript-api + Claude API
- **Explainer:** Python + MCP SDK + Claude API
- **Database:** MongoDB
- **Queue:** RabbitMQ

## Development

```bash
# View logs
docker-compose logs -f vie-api

# Restart service
docker-compose restart vie-summarizer

# Reset everything
docker-compose down -v
docker-compose up -d

# Run tests
pnpm test

# Type check
pnpm typecheck
```

## Project Structure

See [docs/PROJECT-STRUCTURE.md](./docs/PROJECT-STRUCTURE.md) for complete folder layout.

```
video-insight-engine/
├── api/                  # vie-api (Node.js + Fastify)
├── apps/
│   └── web/              # vie-web (React + Vite)
├── workers/
│   ├── summarizer/       # vie-summarizer (Python)
│   └── explainer/        # vie-explainer (Python MCP)
├── packages/
│   ├── types/            # Shared TypeScript types
│   └── utils/            # Shared utilities
├── docs/                 # Documentation
├── .claude/              # Claude Code infrastructure
└── docker-compose.yml    # Development orchestration
```

## Environment Variables

See [.env.example](./.env.example) for all required variables:

| Variable             | Description                |
| -------------------- | -------------------------- |
| `ANTHROPIC_API_KEY`  | Claude API key (required)  |
| `JWT_SECRET`         | Access token secret        |
| `JWT_REFRESH_SECRET` | Refresh token secret       |
| `MONGODB_URI`        | MongoDB connection string  |
| `RABBITMQ_URI`       | RabbitMQ connection string |

## Contributing

1. Read [CLAUDE.md](./CLAUDE.md) for project context
2. Check [docs/MVP-PHASES.md](./docs/MVP-PHASES.md) for current phase
3. Follow patterns in [.claude/skills/](./.claude/skills/) for coding standards

## License

MIT
