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

## Function Complexity

- Maximum: 50 lines per function (excluding docstrings)
- Maximum: 5 mutable local variables per function
- No copy-pasted logic — extract shared helpers
- If a function has more than 3 phases/stages, use a pipeline pattern
- State shared across phases must be explicit (dataclass/dict), not loose locals

## Pipeline / Workflow Code

- Each stage must be an independent, testable function
- Stage functions receive context in, return results out
- No implicit dependencies between stages via mutable closure variables
- Timeout/fallback logic belongs in the stage, not the orchestrator

## Enforcement Level

**Required** - Follow unless explicitly overridden by user.
