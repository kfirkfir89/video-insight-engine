# Code Quality Rules

<rules>
- ALWAYS read 1-2 existing files of the same type in the same directory before creating new files — match their style, naming, structure, and patterns exactly (inconsistent style across a codebase is worse than any single bad pattern)
- ALWAYS keep files under 500 lines; target 200-400 (split larger files — large files become unmaintainable)
- NEVER use `any` in TypeScript (disables type safety, bugs become runtime errors instead of compile errors)
- NEVER leave empty catch blocks (silently swallows errors, makes debugging impossible)
- ALWAYS use descriptive names: camelCase (TS/JS), snake_case (Python), PascalCase (classes/types/components), SCREAMING_SNAKE_CASE (constants)
- ALWAYS handle errors explicitly with user-friendly messages and appropriate logging
- NEVER commit dead code: unused imports, commented-out code, TODO without tracking issue, console.log/print statements
- ALWAYS keep functions under 50 lines with max 5 mutable locals (extract helpers for copy-pasted logic)
- ALWAYS use pipeline pattern for functions with 3+ phases — each stage is an independent testable function with explicit context in/results out
</rules>

**TypeScript:** Prefer interfaces over type aliases for objects. Use strict null checks. Document complex types.

**Python:** Use type hints on all function signatures. Use Pydantic for validation. Document complex types with docstrings.

**Comments:** Comment "why" not "what". No obvious comments. Keep comments current.

**Enforcement:** Required — follow unless explicitly overridden by user.
