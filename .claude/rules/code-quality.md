# Code Quality Rules

## File Size

- Target: 200-400 lines per file
- Maximum: 500 lines (split if larger)
- Exception: Generated files, type definitions

## Naming

- Use descriptive names that explain purpose
- camelCase for variables/functions (TypeScript/JavaScript)
- snake_case for variables/functions (Python)
- PascalCase for classes/types/components
- SCREAMING_SNAKE_CASE for constants

## Structure

- One component/class per file
- Group related functionality
- Separate concerns (logic, UI, data)
- Keep functions focused (single responsibility)

## No Dead Code

- Remove unused imports
- Delete commented-out code
- No TODO without tracking issue
- Clean up console.log/print statements before commit

## Error Handling

- Always handle errors explicitly
- No empty catch blocks
- User-friendly error messages
- Log errors appropriately for debugging

## Types (TypeScript)

- Avoid `any` type
- Prefer interfaces over type aliases for objects
- Use strict null checks
- Document complex types

## Types (Python)

- Use type hints for function signatures
- Use Pydantic for data validation
- Document complex types with docstrings

## Comments

- Code should be self-documenting
- Comment "why", not "what"
- Keep comments up to date
- No obvious comments (e.g., `// increment i`)

## Enforcement Level

**Required** - Follow unless explicitly overridden by user.
