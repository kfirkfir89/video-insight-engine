# Testing Rules

<rules>
- ALWAYS write tests for new features — minimum 80% coverage for new code (untested code ships bugs)
- ALWAYS include regression tests with bug fixes (prevents the same bug from recurring)
- ALWAYS test behavior, not implementation — one assertion per test when possible (implementation-coupled tests break on refactors)
- ALWAYS use descriptive test names: "should [expected behavior] when [condition]" (unclear names make failures undiagnosable)
- NEVER mock what you're testing — mock only external dependencies (mocking the subject defeats the test's purpose)
- ALWAYS clean up mocks after tests (leaked mocks cause flaky cross-test failures)
</rules>

**Test types:** Unit (always for new functions), Integration (new endpoints/data changes), E2E (major features/auth flows).

**Structure:** `describe('Component') → describe('method') → it('should...')` with Arrange/Act/Assert.

**Runners:** API → `cd api && npm test` (Vitest), Web → `cd apps/web && npm test` (Vitest + Testing Library), E2E → `npm run test:e2e` (Playwright). Test files: `*.test.ts` or `*.spec.ts`.

**Enforcement:** Required — new code should have tests.
