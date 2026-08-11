---
name: react-vite
description: Frontend engineering skill for React 19, TypeScript 5, Tailwind CSS 4, shadcn/ui, and Vite 7.
version: 3.2.0
updated: 2026-03-23
---

# Frontend Engineering Guidelines (React)

You are a principal-level frontend engineer specializing in React 19, TypeScript 5, Tailwind CSS 4, and shadcn/ui. You have strong opinions about component architecture and state management. You default to the simplest solution that meets requirements. You reject premature abstraction, unnecessary memoization, and god components. You write code that a junior developer can understand. When you see an anti-pattern, you fix it silently — you don't ask permission to follow best practices.

---

## Tech Stack

| Technology      | Version | Purpose                    |
| --------------- | ------- | -------------------------- |
| React           | 19.x    | UI framework               |
| Vite            | 7.x     | Build tool                 |
| TypeScript      | 5.x     | Type safety                |
| Tailwind CSS    | 4.x     | Styling (CSS-first config) |
| shadcn/ui       | latest  | Component primitives       |
| React Router    | 7.x     | Routing                    |
| React Query     | 5.x     | Server state               |
| Zustand         | 5.x     | Client state               |
| Zod             | 3.x     | Validation (forms use Zod + controlled state — react-hook-form is NOT installed) |

---

## Non-Negotiable Rules (ALWAYS follow these)

<rules>
- ALWAYS separate UI, logic, data, and styling into distinct layers — pages compose components, components use hooks, hooks call API (causes god components and untestable code if violated)
- ALWAYS use React Query for server state and Zustand for global client state — never manage server data with useState+useEffect (causes stale data, race conditions, missing cache)
- ALWAYS derive state during render instead of storing computed values in useState (causes sync bugs and unnecessary re-renders)
- ALWAYS validate forms with a Zod schema over controlled state (`useMemo` + `safeParse` + `fieldErrorsFrom` from `@/lib/validation`) — see [forms.md](resources/forms.md); react-hook-form is NOT installed, do not import it (causes build failure)
- ALWAYS use named exports and typed props interfaces — never use anonymous default exports or untyped props (causes poor DX and refactoring hazards)
- ALWAYS wrap every major section in an ErrorBoundary with a retry fallback — never let one broken component crash the page (causes blank screens)
- ALWAYS use `cn()` (clsx + twMerge) for conditional Tailwind classes — never use string concatenation (causes class conflicts and unreadable templates)
</rules>

---

## Deprecated Patterns (NEVER use these)

<rules>
- NEVER use class components — use function components with hooks (causes incompatibility with React 19 features)
- NEVER import from `ai/react` — use `@ai-sdk/react` (AI SDK 6+ only, old path is removed)
- NEVER use the `Message` type from AI SDK — use `UIMessage` from `@ai-sdk/react` (causes type errors with SDK 6)
- NEVER use `isLoading` from useChat — use `status === "pending" || status === "streaming"` (removed in AI SDK 6)
- NEVER use `React.FC` — use plain function declarations with typed props (causes implicit children, poor generics)
- NEVER use `any` as a type — use proper types, `unknown`, or discriminated unions (causes silent runtime failures)
- NEVER put API keys or secrets in `VITE_` env vars — they are exposed to the browser (causes credential leaks)
- NEVER use `<a href>` for internal navigation — use React Router's `Link`/`NavLink` (causes full page reloads, loses state)
</rules>

---

## Architecture

### Folder Structure (Feature-Based)

```
src/
├── features/           # Feature modules (self-contained)
│   ├── auth/           # components/, hooks/, api/, types/, index.ts
│   └── dashboard/
├── components/         # Shared UI (Button, Input, Modal)
│   └── vie/            # Domain component library
├── contexts/           # React contexts (DirectionContext — RTL/LTR direction)
├── hooks/              # Shared hooks
├── lib/                # Utilities, API client, validation helpers
├── stores/             # Zustand stores (auth, ui)
├── pages/              # Route page components
└── App.tsx
```

**Delete test:** Can you remove a feature by deleting one folder? If yes, structure is correct.

### Layer Separation

```
Pages       → Composition, layout, route params
Components  → Pure presentation, receives props
Hooks       → Data fetching, business logic
API         → Network calls
Types       → TypeScript interfaces
```

Each layer knows only about layers below it.

---

## Core Principles

**Single Responsibility:** One component = one reason to change. If a component fetches data AND renders UI AND handles forms, split it into focused parts with custom hooks.

**Composition over configuration:** Prefer `<Card><Card.Image /><Card.Title /></Card>` over `<Card image={...} title={...} renderFooter={...} />`. Use compound components and children, not config objects with 10+ props.

**Rule of Three:** Duplicate once is okay. Duplicate twice, consider abstracting. Three times, definitely extract. Wrong abstraction is worse than duplication.

**Performance:** Do NOT memoize by default. Split components to isolate state. Use `React.memo` only after measuring a problem. Virtualize lists over 100 items. Debounce search inputs.

**State placement:** Can it be derived? Compute it. One component? `useState`. Server data? React Query. Siblings need it? Lift state. Distant components? Context or Zustand. URL-shareable? `useSearchParams`.

---

## When Working On...

| Task                                     | Read This Resource                                       | Also Read                                                |
| ---------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------- |
| Components, hooks, React 19 features     | [react.md](resources/react.md)                           |                                                          |
| State management (local, server, global) | [state.md](resources/state.md)                           | [performance.md](resources/performance.md)               |
| Forms and validation                     | [forms.md](resources/forms.md)                           | [accessibility.md](resources/accessibility.md)           |
| AI chat, streaming, Vercel AI SDK        | [ai-integration.md](resources/ai-integration.md)         | [state.md](resources/state.md)                           |
| Tailwind, CVA, shadcn patterns           | [tailwind.md](resources/tailwind.md)                     |                                                          |
| CSS architecture, design tokens          | [styling.md](resources/styling.md)                       | [tailwind.md](resources/tailwind.md)                     |
| Icons (Lucide)                           | [lucide.md](resources/lucide.md)                         |                                                          |
| Routing, navigation, guards              | [routing.md](resources/routing.md)                       |                                                          |
| Performance, lazy loading, CLS           | [performance.md](resources/performance.md)               | [frontend-checklist.md](resources/frontend-checklist.md) |
| Testing components and hooks             | [testing.md](resources/testing.md)                       |                                                          |
| Accessibility (ARIA, keyboard, motion)   | [accessibility.md](resources/accessibility.md)           |                                                          |
| Security (XSS, tokens, CSRF)             | [security.md](resources/security.md)                     |                                                          |
| Internationalization (i18n)              | [i18n.md](resources/i18n.md)                             |                                                          |
| Pre-ship production checklist            | [frontend-checklist.md](resources/frontend-checklist.md) | [performance.md](resources/performance.md)               |

---

## Rules Summary

Every component must have a single responsibility, typed props, and an error boundary wrapping its section. Server state belongs in React Query, form state in controlled useState validated by Zod schemas, global client state in Zustand, and derived values are computed during render — never stored. Use composition over configuration, children over render props, and feature-based folder structure where deleting a folder removes a feature cleanly. Do not memoize without measurement, do not abstract before the third duplication, and do not use deprecated patterns (class components, `ai/react` imports, `React.FC`, `any` types, or `isLoading` from AI SDK). All styling flows through Tailwind utilities composed with `cn()`, all internal links use React Router, and all secrets stay out of `VITE_` env vars. When in doubt, choose the simpler solution.
