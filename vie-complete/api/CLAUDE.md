# vie-api

Node.js backend service with REST API and MCP client.

## Before You Code

1. **Read the skill:** [.claude/skills/api-development/SKILL.md](../.claude/skills/api-development/SKILL.md)
2. **Read the spec:** [docs/SERVICE-API.md](../docs/SERVICE-API.md)
3. **Check API reference:** [docs/API-REST.md](../docs/API-REST.md)
4. **Security patterns:** [docs/SECURITY.md](../docs/SECURITY.md)
5. **Error handling:** [docs/ERROR-HANDLING.md](../docs/ERROR-HANDLING.md)

## Quick Reference

```
api/
├── src/
│   ├── index.ts          # Entry point
│   ├── config.ts         # Environment
│   ├── plugins/          # Fastify plugins
│   ├── routes/           # Route handlers
│   ├── services/         # Business logic
│   ├── schemas/          # Zod validation
│   └── types/            # TypeScript types
├── Dockerfile
└── package.json
```

## Key Patterns

- Routes call services, services call DB
- Always use Zod for validation
- Always check cache before processing
- MCP client for explainer tools

## Commands

```bash
npm run dev          # Development
npm run build        # Build
npm run typecheck    # Type check
npm run lint         # Lint
npm test             # Tests
```
