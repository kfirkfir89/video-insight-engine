# Testing Patterns

Unit tests, integration tests, mocking, factories, and coverage with Vitest.

<rules>
- ALWAYS use Arrange-Act-Assert (AAA) pattern with one assertion focus per test (causes unclear failure reasons if testing multiple things)
- ALWAYS create fresh mocks in `beforeEach` — never share mutable mock state between tests (causes flaky tests from cross-contamination)
- ALWAYS use factory functions for test data with sensible defaults and overrides (causes brittle tests if hardcoding data)
- ALWAYS test error paths and edge cases, not just happy paths (causes missed bugs in failure scenarios)
- NEVER mock what you're testing — mock only external dependencies (causes false confidence from tautological tests)
- NEVER test implementation details (private methods, internal state) (causes tests that break on refactoring)
- NEVER target 100% coverage — 80% with meaningful tests beats 100% with test-gaming (causes low-quality tests written just for metrics)
</rules>

---

## Unit Testing Services

```typescript
describe("UserService", () => {
  let service: UserService;
  let mockRepo: { findById: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockRepo = { findById: vi.fn() };
    service = new UserService(mockRepo as unknown as UserRepository);
  });

  it("returns user when found", async () => {
    mockRepo.findById.mockResolvedValue(createUser({ id: "123" }));
    const result = await service.findById("123");
    expect(result).toEqual(expect.objectContaining({ id: "123" }));
  });

  it("throws NotFoundError when not found", async () => {
    mockRepo.findById.mockResolvedValue(null);
    await expect(service.findById("123")).rejects.toThrow(NotFoundError);
  });
});
```

---

## Integration Testing Routes

```typescript
describe("User Routes", () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });
  afterAll(async () => {
    await app.close();
  });

  it("creates user with valid data", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/users",
      payload: {
        email: "test@example.com",
        name: "Test",
        password: "password123",
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().data).not.toHaveProperty("password");
  });

  it("returns 400 for invalid email", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/users",
      payload: { email: "invalid", name: "Test", password: "password123" },
    });
    expect(res.statusCode).toBe(400);
  });
});
```

---

## Test Factories

```typescript
export function createUser(overrides: Partial<User> = {}): User {
  return {
    id: overrides.id ?? randomUUID(),
    email: overrides.email ?? `user-${randomUUID()}@example.com`,
    name: overrides.name ?? "Test User",
    roles: overrides.roles ?? ["user"],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}
```

---

## Test Database

```typescript
import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoClient, type Db } from "mongodb";

let mongod: MongoMemoryServer;
let client: MongoClient;
let db: Db;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  client = new MongoClient(mongod.getUri());
  await client.connect();
  db = client.db("test");
});
afterAll(async () => {
  await client.close();
  await mongod.stop();
});
afterEach(async () => {
  for (const coll of await db.collections()) {
    await coll.deleteMany({});
  }
});
```

---

## Mocking External Services

Prefer DI-based mocking over `vi.mock()` for cleaner tests:

```typescript
describe("OrderService", () => {
  let mockEmailService: { sendConfirmation: ReturnType<typeof vi.fn> };
  beforeEach(() => {
    mockEmailService = {
      sendConfirmation: vi.fn().mockResolvedValue(undefined),
    };
    service = new OrderService(mockRepo, mockEmailService);
  });

  it("sends confirmation email", async () => {
    await service.createOrder(input, userId);
    expect(mockEmailService.sendConfirmation).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: expect.any(String) }),
    );
  });
});
```

---

## Edge Cases

- **Async test without await**: Forgetting `await` on `expect(...).rejects.toThrow()` passes silently. Always `await` assertions on promises.
- **Fake timers and async**: When using `vi.useFakeTimers()`, advance timers before awaiting the promise. Call `vi.useRealTimers()` in cleanup.
- **MongoMemoryServer port conflicts**: Use `{ instance: { port: 0 } }` for random port assignment when running tests in parallel.

---

## Rules Summary

Unit tests mock all external dependencies via constructor injection, use AAA pattern, and create fresh mocks in beforeEach. Integration tests use `app.inject()` against a real Fastify instance with MongoMemoryServer. Factory functions generate test data with sensible defaults and optional overrides. Error paths are tested explicitly — every thrown error type gets its own test. Coverage targets 80% with meaningful assertions, not test-gaming. External services are mocked at the boundary, never in the middle of the code under test.
