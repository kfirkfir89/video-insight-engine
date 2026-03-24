---
paths:
  - "api/**/*.ts"
  - "apps/**/*.ts"
  - "apps/**/*.tsx"
  - "packages/**/*.ts"
---

# TypeScript Syntax Patterns

Conventions derived from this codebase. Follow these for consistent style.

<rules>
- ALWAYS use explicit return types on exported/public functions: `async create(...): Promise<Order>` (prevents accidental return type changes from breaking callers)
- ALWAYS separate type imports with `type` keyword: `import type { UserTier } from '@vie/types'` (enables tree-shaking and clarifies intent)
- ALWAYS group imports: 1) external packages, 2) internal modules, 3) type-only imports (inconsistent ordering makes files hard to scan)
- ALWAYS use `interface` for object shapes, `type` for unions and aliases (consistent convention across the codebase)
- ALWAYS destructure options/config objects in function body, not parameter: `const { folderId, bypassCache = false } = options` (keeps signatures readable)
- ALWAYS use template literals over string concatenation: `` `user:${id}` `` (cleaner, less error-prone)
</rules>

## Functions & Classes

- **Service methods**: Class methods with `async`, not arrows: `async createVideo(...): Promise<Video>`
- **Callbacks/transforms**: Arrow functions: `.map(v => ...)`, `.catch(err => { ... })`
- **Utility functions**: Named function declarations: `function validateUrl(url: string): boolean`
- **Constructor injection**: `private readonly` on all injected dependencies

## Components (apps/web/ only)

- **Declaration**: `function ComponentName()` — never `const Component = () =>`
- **Memoized**: `export const Sidebar = memo(function Sidebar() { ... })`
- **Props interface**: Defined BEFORE the component, named `ComponentNameProps`
- **Handler naming**: `handle*` for internal (`handleKeyDown`), `on*` for callback props (`onNavigateTab`)
- **State**: Separate `useState` calls per value, always typed: `useState<StreamPhase>("idle")`
- **Conditional rendering**: Ternary for simple, `&&` for optional, early return for guards

## Error Handling

- Wrap major I/O blocks in try-catch, not every line
- Check specific error types: `if (error instanceof Error && 'code' in error)`
- Custom error classes from services: `throw new InvalidYouTubeUrlError()`
- Non-blocking failures: `.catch(err => { this.logger.warn(...) })`
