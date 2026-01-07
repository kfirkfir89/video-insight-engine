# vie-web

React frontend application.

## Before You Code

1. **Read the skill:** [.claude/skills/react-frontend/SKILL.md](../.claude/skills/react-frontend/SKILL.md)
2. **Read the spec:** [docs/SERVICE-WEB.md](../docs/SERVICE-WEB.md)
3. **Error handling:** [docs/ERROR-HANDLING.md](../docs/ERROR-HANDLING.md) - Frontend error patterns

## Quick Reference

```
web/
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── api/              # API client
│   ├── components/
│   │   ├── ui/           # shadcn
│   │   ├── layout/
│   │   ├── videos/
│   │   ├── memorize/
│   │   └── folders/
│   ├── hooks/            # Custom hooks
│   ├── pages/            # Route pages
│   ├── stores/           # Zustand
│   └── types/
├── Dockerfile
└── package.json
```

## Key Patterns

- shadcn/ui for components
- React Query for server state
- Zustand for UI state only
- Tailwind for styling

## Commands

```bash
npm run dev          # Development
npm run build        # Build
npm run typecheck    # Type check
npm run lint         # Lint
```

## shadcn Components

```bash
npx shadcn@latest add button card input tabs dialog badge
npx shadcn@latest add dropdown-menu scroll-area textarea
```
