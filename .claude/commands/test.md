# /test Command

Generate tests for specified code.

## Usage

```
/test api/src/services/video.service.ts
/test apps/web/src/components/VideoCard.tsx
/test services/summarizer/src/services/transcript.py
```

## What It Does

1. **Analyze the file** - Understand exports, functions, classes
2. **Identify test cases** - Happy paths, edge cases, errors
3. **Generate test file** - Following project patterns and the rules below

## Rules (from test-writer agent)

- ALWAYS cover happy paths AND edge cases — both are required (happy-path-only tests miss real bugs)
- ALWAYS use Arrange/Act/Assert structure with descriptive names: "should [behavior] when [condition]"
- NEVER test third-party library internals or simple getters/setters (test YOUR logic, not theirs)
- ALWAYS mock only external dependencies — never mock the subject under test
- ALWAYS include error handling tests — test what happens when things fail, not just when they succeed

## Runners & Patterns by Service

| Service               | Runner                                     | Pattern                                                                  |
| --------------------- | ------------------------------------------ | ------------------------------------------------------------------------ |
| api/                  | `cd api && npm test` (Vitest)              | `describe → describe → it`, mock DB with `vi.fn()`, mock deps in services |
| apps/web/             | `cd apps/web && npm test` (Vitest + RTL)   | `render → screen.getBy → fireEvent → expect`, test interactions + output  |
| services/summarizer/  | `python3 -m pytest` (pytest)               | `@pytest.fixture` for mocks, `patch` external calls, test I/O contracts   |
| services/assistant/   | `python3 -m pytest` (pytest)               | Same; note `QdrantClient.search` is SYNC — `MagicMock`, not `AsyncMock`   |
| services/admin/       | `python3 -m pytest` (pytest)               | Same pytest patterns                                                      |
| E2E                   | `cd apps/web && npm run test:e2e`          | Playwright, full user flows                                               |

## Test Strategy

**Unit** (pure functions/classes): each public method, edge cases, error conditions, mocked dependencies.
**Component** (React): rendering, user interactions, props handling, accessibility.
**Integration** (services/endpoints): real (test) database, full request flow, error scenarios.

## Output

Creates test file adjacent to source (or in the service's existing `__tests__/` / `tests/` convention):

- `video.service.ts` → `video.service.test.ts`
- `VideoCard.tsx` → `VideoCard.test.tsx`
- `transcript.py` → `test_transcript.py`
