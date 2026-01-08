# Complete Examples

Full working code examples showing all layers together.

---

## Table of Contents

- [Complete Controller](#complete-controller)
- [Complete Service with DI](#complete-service-with-di)
- [Complete Route File](#complete-route-file)
- [Complete Repository](#complete-repository)
- [Refactoring: Bad to Good](#refactoring-bad-to-good)
- [End-to-End Feature](#end-to-end-feature)

---

## Complete Controller

```typescript
// src/users/user.controller.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { UserService } from './user.service.js';
import {
  CreateUserInput,
  UpdateUserInput,
  GetUserParams,
  ListUsersQuery,
} from './user.schema.js';

export class UserController {
  constructor(private readonly userService: UserService) {}

  async create(
    request: FastifyRequest<{ Body: CreateUserInput }>,
    reply: FastifyReply
  ): Promise<void> {
    const user = await this.userService.create(request.body);
    reply.status(201).send({ success: true, data: user });
  }

  async getById(
    request: FastifyRequest<{ Params: GetUserParams }>,
    reply: FastifyReply
  ): Promise<void> {
    const user = await this.userService.findById(request.params.id);
    reply.send({ success: true, data: user });
  }

  async update(
    request: FastifyRequest<{ Params: GetUserParams; Body: UpdateUserInput }>,
    reply: FastifyReply
  ): Promise<void> {
    const user = await this.userService.update(request.params.id, request.body);
    reply.send({ success: true, data: user });
  }

  async delete(
    request: FastifyRequest<{ Params: GetUserParams }>,
    reply: FastifyReply
  ): Promise<void> {
    await this.userService.delete(request.params.id);
    reply.status(204).send();
  }

  async list(
    request: FastifyRequest<{ Querystring: ListUsersQuery }>,
    reply: FastifyReply
  ): Promise<void> {
    const { page = 1, limit = 20 } = request.query;
    const result = await this.userService.findAll({ page, limit });
    reply.send({
      success: true,
      data: result.items,
      meta: { page, limit, total: result.total },
    });
  }
}
```

---

## Complete Service with DI

```typescript
// src/users/user.service.ts
import { UserRepository } from './user.repository.js';
import { CacheService } from '../cache/cache.service.js';
import { CreateUserInput, UpdateUserInput } from './user.schema.js';
import { User, PaginatedResult } from './user.types.js';
import { NotFoundError, ConflictError } from '../shared/errors/index.js';
import { hashPassword } from '../shared/utils/crypto.js';

export class UserService {
  private readonly CACHE_TTL = 3600;

  constructor(
    private readonly userRepo: UserRepository,
    private readonly cache: CacheService
  ) {}

  async create(input: CreateUserInput): Promise<User> {
    // Business rule: email uniqueness
    const existing = await this.userRepo.findByEmail(input.email);
    if (existing) {
      throw new ConflictError('Email already registered');
    }

    // Business logic: hash password
    const passwordHash = await hashPassword(input.password);

    const user = await this.userRepo.create({
      email: input.email.toLowerCase(),
      name: input.name,
      passwordHash,
    });

    return this.sanitize(user);
  }

  async findById(id: string): Promise<User> {
    // Check cache
    const cacheKey = `user:${id}`;
    const cached = await this.cache.get<User>(cacheKey);
    if (cached) return cached;

    // Fetch from DB
    const user = await this.userRepo.findById(id);
    if (!user) {
      throw new NotFoundError(`User not found: ${id}`);
    }

    // Cache result
    const sanitized = this.sanitize(user);
    await this.cache.set(cacheKey, sanitized, this.CACHE_TTL);

    return sanitized;
  }

  async update(id: string, input: UpdateUserInput): Promise<User> {
    const existing = await this.userRepo.findById(id);
    if (!existing) {
      throw new NotFoundError(`User not found: ${id}`);
    }

    // Business rule: email uniqueness
    if (input.email && input.email !== existing.email) {
      const emailTaken = await this.userRepo.findByEmail(input.email);
      if (emailTaken) {
        throw new ConflictError('Email already in use');
      }
    }

    const user = await this.userRepo.update(id, input);

    // Invalidate cache
    await this.cache.delete(`user:${id}`);

    return this.sanitize(user);
  }

  async delete(id: string): Promise<void> {
    const existing = await this.userRepo.findById(id);
    if (!existing) {
      throw new NotFoundError(`User not found: ${id}`);
    }

    await this.userRepo.delete(id);
    await this.cache.delete(`user:${id}`);
  }

  async findAll(options: { page: number; limit: number }): Promise<PaginatedResult<User>> {
    const result = await this.userRepo.findAll(options);
    return {
      ...result,
      items: result.items.map((u) => this.sanitize(u)),
    };
  }

  private sanitize(user: User & { passwordHash?: string }): User {
    const { passwordHash, ...safe } = user;
    return safe as User;
  }
}
```

---

## Complete Route File

```typescript
// src/users/user.route.ts
import { FastifyPluginAsync } from 'fastify';
import { UserController } from './user.controller.js';
import { createUserContainer } from './user.container.js';
import { authenticate, requireRole } from '../shared/middleware/auth.js';
import {
  createUserSchema,
  updateUserSchema,
  userParamsSchema,
  listUsersSchema,
} from './user.schema.js';

export const userRoutes: FastifyPluginAsync = async (app) => {
  const container = createUserContainer();
  const controller = new UserController(container.userService);

  // POST /users - Create (public)
  app.post('/', {
    schema: { body: createUserSchema },
    handler: controller.create.bind(controller),
  });

  // GET /users/:id - Get by ID (authenticated)
  app.get('/:id', {
    preHandler: [authenticate],
    schema: { params: userParamsSchema },
    handler: controller.getById.bind(controller),
  });

  // PATCH /users/:id - Update (authenticated)
  app.patch('/:id', {
    preHandler: [authenticate],
    schema: { params: userParamsSchema, body: updateUserSchema },
    handler: controller.update.bind(controller),
  });

  // DELETE /users/:id - Delete (admin only)
  app.delete('/:id', {
    preHandler: [authenticate, requireRole('admin')],
    schema: { params: userParamsSchema },
    handler: controller.delete.bind(controller),
  });

  // GET /users - List (authenticated)
  app.get('/', {
    preHandler: [authenticate],
    schema: { querystring: listUsersSchema },
    handler: controller.list.bind(controller),
  });
};
```

---

## Complete Repository

```typescript
// src/users/user.repository.ts
import { Collection, ObjectId } from 'mongodb';
import { User, UserDocument, PaginatedResult } from './user.types.js';

export class UserRepository {
  constructor(private readonly collection: Collection<UserDocument>) {}

  async create(data: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    const now = new Date();
    const doc = { ...data, createdAt: now, updatedAt: now };
    const result = await this.collection.insertOne(doc as UserDocument);
    return this.toEntity({ ...doc, _id: result.insertedId });
  }

  async findById(id: string): Promise<User | null> {
    if (!ObjectId.isValid(id)) return null;
    const doc = await this.collection.findOne({ _id: new ObjectId(id) });
    return doc ? this.toEntity(doc) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const doc = await this.collection.findOne({ email: email.toLowerCase() });
    return doc ? this.toEntity(doc) : null;
  }

  async update(id: string, data: Partial<User>): Promise<User> {
    const result = await this.collection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: { ...data, updatedAt: new Date() } },
      { returnDocument: 'after' }
    );
    return this.toEntity(result!);
  }

  async delete(id: string): Promise<void> {
    await this.collection.deleteOne({ _id: new ObjectId(id) });
  }

  async findAll(options: { page: number; limit: number }): Promise<PaginatedResult<User>> {
    const skip = (options.page - 1) * options.limit;
    const [docs, total] = await Promise.all([
      this.collection.find().skip(skip).limit(options.limit).sort({ createdAt: -1 }).toArray(),
      this.collection.countDocuments(),
    ]);
    return {
      items: docs.map((d) => this.toEntity(d)),
      total,
      page: options.page,
      limit: options.limit,
    };
  }

  private toEntity(doc: UserDocument): User {
    return {
      id: doc._id.toString(),
      email: doc.email,
      name: doc.name,
      passwordHash: doc.passwordHash,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }
}
```

---

## Refactoring: Bad to Good

### Before (Everything in Route Handler)

```typescript
// ❌ BAD: Handler does everything
app.post('/users', async (request, reply) => {
  const { email, password, name } = request.body;

  // Validation in handler
  if (!email || !email.includes('@')) {
    return reply.status(400).send({ error: 'Invalid email' });
  }

  // Database check in handler
  const existing = await db.collection('users').findOne({ email });
  if (existing) {
    return reply.status(409).send({ error: 'Email exists' });
  }

  // Business logic in handler
  const passwordHash = await bcrypt.hash(password, 10);

  // Database insert in handler
  const result = await db.collection('users').insertOne({
    email,
    name,
    passwordHash,
    createdAt: new Date(),
  });

  return reply.status(201).send({ id: result.insertedId, email, name });
});
```

### After (Properly Layered)

```typescript
// ✅ GOOD: Each layer has one job

// Route - just wiring
app.post('/', {
  schema: { body: createUserSchema },
  handler: controller.create.bind(controller),
});

// Controller - HTTP concerns
async create(request: FastifyRequest<{ Body: CreateUserInput }>, reply: FastifyReply) {
  const user = await this.userService.create(request.body);
  reply.status(201).send({ success: true, data: user });
}

// Service - business logic
async create(input: CreateUserInput): Promise<User> {
  const existing = await this.userRepo.findByEmail(input.email);
  if (existing) throw new ConflictError('Email already registered');

  const passwordHash = await hashPassword(input.password);
  return this.userRepo.create({ ...input, passwordHash });
}

// Repository - data access
async create(data: CreateUserData): Promise<User> {
  const doc = { ...data, createdAt: new Date() };
  const result = await this.collection.insertOne(doc);
  return this.toEntity({ ...doc, _id: result.insertedId });
}
```

---

## End-to-End Feature

Complete implementation of a feature showing all files.

### File Structure

```
src/products/
├── product.route.ts
├── product.controller.ts
├── product.service.ts
├── product.repository.ts
├── product.schema.ts
├── product.types.ts
├── product.container.ts
└── product.test.ts
```

### Types

```typescript
// product.types.ts
export interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductDocument extends Omit<Product, 'id'> {
  _id: ObjectId;
}
```

### Schema

```typescript
// product.schema.ts
import { z } from 'zod';

export const createProductSchema = z.object({
  name: z.string().min(1).max(200),
  price: z.number().positive(),
  stock: z.number().int().min(0),
});

export const productParamsSchema = z.object({
  id: z.string().length(24),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
```

### Container (DI)

```typescript
// product.container.ts
import { getDatabase } from '../database/connection.js';
import { ProductRepository } from './product.repository.js';
import { ProductService } from './product.service.js';
import { CacheService } from '../cache/cache.service.js';

export function createProductContainer() {
  const db = getDatabase();
  const cache = new CacheService(config.REDIS_URL);
  const productRepo = new ProductRepository(db.collection('products'));
  const productService = new ProductService(productRepo, cache);

  return { productRepo, productService };
}
```

### Test

```typescript
// product.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProductService } from './product.service.js';
import { NotFoundError } from '../shared/errors/index.js';

describe('ProductService', () => {
  let service: ProductService;
  let mockRepo: { findById: ReturnType<typeof vi.fn> };
  let mockCache: { get: ReturnType<typeof vi.fn>; set: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockRepo = { findById: vi.fn() };
    mockCache = { get: vi.fn(), set: vi.fn() };
    service = new ProductService(mockRepo as any, mockCache as any);
  });

  it('returns cached product if available', async () => {
    const product = { id: '1', name: 'Test' };
    mockCache.get.mockResolvedValue(product);

    const result = await service.findById('1');

    expect(result).toEqual(product);
    expect(mockRepo.findById).not.toHaveBeenCalled();
  });

  it('fetches from DB and caches on miss', async () => {
    const product = { id: '1', name: 'Test' };
    mockCache.get.mockResolvedValue(null);
    mockRepo.findById.mockResolvedValue(product);

    const result = await service.findById('1');

    expect(result).toEqual(product);
    expect(mockCache.set).toHaveBeenCalledWith('product:1', product, expect.any(Number));
  });

  it('throws NotFoundError when not found', async () => {
    mockCache.get.mockResolvedValue(null);
    mockRepo.findById.mockResolvedValue(null);

    await expect(service.findById('1')).rejects.toThrow(NotFoundError);
  });
});
```

---

## Summary

| Layer | Responsibility | Example |
|-------|----------------|---------|
| Route | HTTP interface, validation schemas | `user.route.ts` |
| Controller | Request/response mapping | `user.controller.ts` |
| Service | Business logic, orchestration | `user.service.ts` |
| Repository | Data access, DB queries | `user.repository.ts` |
| Container | Dependency wiring | `user.container.ts` |

Each layer only knows about the layer directly below it. Never skip layers.
