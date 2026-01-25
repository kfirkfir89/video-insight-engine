# Testing Rules

## Coverage

- Minimum 80% code coverage for new code
- All new features must have tests
- Bug fixes must include regression tests
- Critical paths require higher coverage

## Test Types

| Type | Purpose | When Required |
|------|---------|---------------|
| Unit | Business logic, utilities | Always for new functions |
| Integration | API endpoints, database | New endpoints, data changes |
| E2E | Critical user flows | Major features, auth flows |

## Test Quality

- Test behavior, not implementation
- One assertion per test when possible
- Use descriptive test names
- Include edge cases and error scenarios

## Test Structure

```
describe('ComponentName', () => {
  describe('methodName', () => {
    it('should do expected behavior', () => {
      // Arrange
      // Act
      // Assert
    });
  });
});
```

## Naming Conventions

- Test files: `*.test.ts` or `*.spec.ts`
- Test description: "should [expected behavior] when [condition]"
- Use meaningful variable names in tests

## Mocking

- Mock external dependencies (APIs, databases)
- Don't mock what you're testing
- Keep mocks simple and focused
- Clean up mocks after tests

## Project-Specific

- Backend tests: Vitest
- Frontend tests: Vitest + Testing Library
- E2E tests: Playwright
- Refer to skill resources for test patterns

## Running Tests

```bash
# API tests
cd api && npm test

# Web tests
cd apps/web && npm test

# E2E tests
npm run test:e2e
```

## Enforcement Level

**Required** - New code should have tests.
