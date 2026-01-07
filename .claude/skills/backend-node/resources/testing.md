# Testing Patterns

Unit tests, integration tests, mocking, and test organization.

---

## Test Structure

### DO ✅

```typescript
// Arrange-Act-Assert pattern
describe('OrderService', () => {
  describe('createOrder', () => {
    it('creates order when inventory is available', async () => {
      // Arrange
      const input = createOrderInput({ items: [{ productId: '1', qty: 2 }] });
      mockInventory.check.mockResolvedValue(true);
      mockRepo.create.mockResolvedValue(createOrder({ id: '123' }));

      // Act
      const result = await service.createOrder(input, 'user-1');

      // Assert
      expect(result.id).toBe('123');
      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1' })
      );
    });

    it('throws when inventory unavailable', async () => {
      // Arrange
      mockInventory.check.mockResolvedValue(false);

      // Act & Assert
      await expect(
        service.createOrder(createOrderInput(), 'user-1')
      ).rejects.toThrow(BusinessError);
    });
  });
});
```

### DON'T ❌

```typescript
// No clear structure
test('order test', async () => {
  const order = await service.createOrder(data, 'user');
  expect(order).toBeTruthy();
  await service.cancelOrder(order.id);
  expect(await service.findById(order.id)).toBeNull();
  // Testing multiple things in one test
});
```

---

## Unit Testing Services

### DO ✅

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('UserService', () => {
  let service: UserService;
  let mockRepo: {
    findById: ReturnType<typeof vi.fn>;
    findByEmail: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    // Fresh mocks for each test
    mockRepo = {
      findById: vi.fn(),
      findByEmail: vi.fn(),
      create: vi.fn(),
    };
    service = new UserService(mockRepo as unknown as UserRepository);
  });

  describe('findById', () => {
    it('returns user when found', async () => {
      const user = createUser({ id: '123' });
      mockRepo.findById.mockResolvedValue(user);

      const result = await service.findById('123');

      expect(result).toEqual(user);
      expect(mockRepo.findById).toHaveBeenCalledWith('123');
    });

    it('throws NotFoundError when not found', async () => {
      mockRepo.findById.mockResolvedValue(null);

      await expect(service.findById('123')).rejects.toThrow(NotFoundError);
    });
  });

  describe('create', () => {
    it('hashes password before saving', async () => {
      mockRepo.findByEmail.mockResolvedValue(null);
      mockRepo.create.mockResolvedValue(createUser({ id: 'new' }));

      await service.create({
        email: 'test@example.com',
        password: 'plaintext',
      });

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com',
          passwordHash: expect.stringMatching(/^\$2[aby]\$/),  // bcrypt hash
        })
      );
    });

    it('throws ConflictError when email exists', async () => {
      mockRepo.findByEmail.mockResolvedValue(createUser());

      await expect(
        service.create({ email: 'taken@example.com', password: 'pass' })
      ).rejects.toThrow(ConflictError);
    });
  });
});
```

---

## Integration Testing Routes

### DO ✅

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app';

describe('User Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/v1/users', () => {
    it('creates user with valid data', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/users',
        payload: {
          email: 'test@example.com',
          name: 'Test User',
          password: 'password123',
        },
      });

      expect(response.statusCode).toBe(201);
      expect(response.json()).toMatchObject({
        success: true,
        data: {
          email: 'test@example.com',
          name: 'Test User',
        },
      });
      expect(response.json().data).not.toHaveProperty('password');
    });

    it('returns 400 for invalid email', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/users',
        payload: {
          email: 'invalid-email',
          name: 'Test',
          password: 'password123',
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().success).toBe(false);
    });

    it('returns 409 for duplicate email', async () => {
      // Create first user
      await app.inject({
        method: 'POST',
        url: '/api/v1/users',
        payload: {
          email: 'duplicate@example.com',
          name: 'First',
          password: 'password123',
        },
      });

      // Try to create duplicate
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/users',
        payload: {
          email: 'duplicate@example.com',
          name: 'Second',
          password: 'password123',
        },
      });

      expect(response.statusCode).toBe(409);
    });
  });
});
```

---

## Test Factories

### DO ✅

```typescript
// factories/user.factory.ts
interface UserOverrides {
  id?: string;
  email?: string;
  name?: string;
  roles?: string[];
}

export function createUser(overrides: UserOverrides = {}): User {
  return {
    id: overrides.id ?? randomUUID(),
    email: overrides.email ?? `user-${randomUUID()}@example.com`,
    name: overrides.name ?? 'Test User',
    roles: overrides.roles ?? ['user'],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export function createUserInput(overrides: Partial<CreateUserInput> = {}): CreateUserInput {
  return {
    email: overrides.email ?? `user-${randomUUID()}@example.com`,
    name: overrides.name ?? 'Test User',
    password: overrides.password ?? 'password123',
  };
}

// Usage in tests
const user = createUser({ roles: ['admin'] });
const input = createUserInput({ email: 'specific@example.com' });
```

### DON'T ❌

```typescript
// Hardcoded test data
const user = {
  id: '123',
  email: 'test@example.com',
  name: 'Test',
};

// Tests might conflict if email is unique
```

---

## Mocking External Services

### DO ✅

```typescript
// Mock at the boundary
vi.mock('../services/email.service', () => ({
  EmailService: vi.fn().mockImplementation(() => ({
    send: vi.fn().mockResolvedValue({ messageId: 'mock-id' }),
    sendWelcome: vi.fn().mockResolvedValue(undefined),
  })),
}));

// Or use dependency injection
describe('OrderService', () => {
  let mockEmailService: {
    sendConfirmation: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockEmailService = {
      sendConfirmation: vi.fn().mockResolvedValue(undefined),
    };
    service = new OrderService(mockRepo, mockEmailService);
  });

  it('sends confirmation email', async () => {
    await service.createOrder(input, userId);

    expect(mockEmailService.sendConfirmation).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: expect.any(String) })
    );
  });
});
```

---

## Testing Error Cases

### DO ✅

```typescript
describe('error handling', () => {
  it('throws NotFoundError for invalid ID', async () => {
    await expect(service.findById('invalid'))
      .rejects
      .toThrow(NotFoundError);
  });

  it('throws NotFoundError with correct message', async () => {
    await expect(service.findById('123'))
      .rejects
      .toThrow('User not found: 123');
  });

  it('propagates database errors', async () => {
    mockRepo.findById.mockRejectedValue(new Error('Connection lost'));

    await expect(service.findById('123'))
      .rejects
      .toThrow('Connection lost');
  });
});
```

---

## Test Database

### DO ✅

```typescript
// Use in-memory MongoDB for integration tests
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  // Clean up between tests
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});
```

---

## Testing Async Code

### DO ✅

```typescript
// Always await or return promises
it('handles async operations', async () => {
  const result = await service.asyncMethod();
  expect(result).toBeDefined();
});

// Test timeouts
it('times out slow operations', async () => {
  vi.useFakeTimers();
  
  const promise = service.slowOperation();
  
  vi.advanceTimersByTime(5000);
  
  await expect(promise).rejects.toThrow('Timeout');
  
  vi.useRealTimers();
});

// Test retries
it('retries on failure', async () => {
  mockApi.call
    .mockRejectedValueOnce(new Error('First fail'))
    .mockRejectedValueOnce(new Error('Second fail'))
    .mockResolvedValue({ success: true });

  const result = await service.callWithRetry();

  expect(result.success).toBe(true);
  expect(mockApi.call).toHaveBeenCalledTimes(3);
});
```

---

## Coverage

### DO ✅

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: [
        'node_modules',
        'dist',
        '**/*.test.ts',
        '**/*.d.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
```

### DON'T ❌

```typescript
// 100% coverage target (encourages bad tests)
thresholds: { lines: 100 }

// Testing implementation details to hit coverage
it('calls internal method', () => {
  // @ts-ignore - accessing private method
  expect(service._internalMethod).toBeDefined();
});
```

---

## Quick Reference

| Test Type | What to Test | Mock? |
|-----------|--------------|-------|
| Unit | Single function/method | All dependencies |
| Integration | Route → Service → DB | External services only |
| E2E | Full user flow | Nothing |

| Pattern | When to Use |
|---------|-------------|
| Factory | Create test data |
| Mock | Replace external dependencies |
| Spy | Verify calls without replacing |
| Stub | Provide canned responses |

| Rule | Why |
|------|-----|
| One assertion per test | Clear failure reason |
| Fresh mocks per test | No test pollution |
| Test behavior, not implementation | Refactor-proof |
| Test edge cases | Find real bugs |
