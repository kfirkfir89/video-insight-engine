# Fastify Patterns

Setup, routing, plugins, and middleware patterns for Fastify.

---

## App Bootstrap

### DO ✅

```typescript
// Separate app creation from server start
// app.ts - creates and configures the app
export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      transport: isDev ? { target: 'pino-pretty' } : undefined,
    },
  });

  // Register plugins
  await app.register(cors, { origin: config.CORS_ORIGINS });
  await app.register(helmet);

  // Register routes
  await app.register(routes);

  return app;
}

// server.ts - starts the server
const app = await buildApp();
await app.listen({ port: config.PORT, host: '0.0.0.0' });
```

### DON'T ❌

```typescript
// Everything in one file, can't test
const app = Fastify();
app.get('/users', handler);
app.listen({ port: 3000 });
```

---

## Route Organization

### DO ✅

```typescript
// Group routes by feature with prefix
// routes/index.ts
export async function routes(app: FastifyInstance) {
  await app.register(userRoutes, { prefix: '/api/v1/users' });
  await app.register(orderRoutes, { prefix: '/api/v1/orders' });
  await app.register(healthRoutes, { prefix: '/health' });
}

// users/user.route.ts
export async function userRoutes(app: FastifyInstance) {
  app.get('/', listUsers);
  app.get('/:id', getUser);
  app.post('/', createUser);
  app.patch('/:id', updateUser);
  app.delete('/:id', deleteUser);
}
```

### DON'T ❌

```typescript
// All routes in one file
app.get('/api/v1/users', ...);
app.get('/api/v1/users/:id', ...);
app.get('/api/v1/orders', ...);
app.get('/api/v1/orders/:id', ...);
// 500 more lines...
```

---

## Schema Validation

### DO ✅

```typescript
// Define schemas with Zod, convert to JSON Schema
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

const createUserBody = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(100),
  password: z.string().min(8),
});

const userParams = z.object({
  id: z.string().length(24),
});

// Attach to route
app.post('/', {
  schema: {
    body: zodToJsonSchema(createUserBody),
    response: {
      201: { type: 'object' },
    },
  },
  handler: createUser,
});
```

### DON'T ❌

```typescript
// Manual validation in handler
app.post('/', async (request) => {
  const { email, password } = request.body;
  if (!email) throw new Error('Email required');
  if (!email.includes('@')) throw new Error('Invalid email');
  // More validation...
});
```

---

## Plugins

### DO ✅

```typescript
// Encapsulate related functionality in plugins
import fp from 'fastify-plugin';

export const databasePlugin = fp(async (app, opts) => {
  const client = await connectToDatabase(opts.uri);
  
  // Decorate app with database
  app.decorate('db', client);
  
  // Cleanup on close
  app.addHook('onClose', async () => {
    await client.close();
  });
});

// Usage
await app.register(databasePlugin, { uri: config.MONGODB_URI });
app.db.collection('users'); // TypeScript knows about db
```

### DON'T ❌

```typescript
// Global database connection
import { db } from './database';

app.get('/users', async () => {
  return db.collection('users').find();
});
```

---

## Hooks

### Request Lifecycle

```
onRequest → preParsing → preValidation → preHandler → handler → preSerialization → onSend → onResponse
```

### DO ✅

```typescript
// Use hooks for cross-cutting concerns
app.addHook('onRequest', async (request) => {
  request.startTime = Date.now();
});

app.addHook('onResponse', async (request, reply) => {
  const duration = Date.now() - request.startTime;
  request.log.info({ duration, statusCode: reply.statusCode }, 'request completed');
});

// Route-specific hooks
app.get('/admin', {
  preHandler: [authenticate, requireAdmin],
  handler: adminHandler,
});
```

### DON'T ❌

```typescript
// Auth check in every handler
app.get('/users', async (request) => {
  const user = await verifyToken(request.headers.authorization);
  if (!user) throw new UnauthorizedError();
  // actual logic...
});

app.get('/orders', async (request) => {
  const user = await verifyToken(request.headers.authorization); // Duplicated!
  if (!user) throw new UnauthorizedError();
  // actual logic...
});
```

---

## Decorators

### DO ✅

```typescript
// Type-safe decorators
declare module 'fastify' {
  interface FastifyInstance {
    db: Database;
    config: Config;
  }
  interface FastifyRequest {
    user?: TokenPayload;
    startTime?: number;
  }
}

// Then decorate
app.decorate('db', database);
app.decorateRequest('user', null);
```

### DON'T ❌

```typescript
// Untyped property access
(app as any).db = database;
(request as any).user = user;
```

---

## Error Handling

### DO ✅

```typescript
// Global error handler
app.setErrorHandler((error, request, reply) => {
  request.log.error(error);

  // Custom app errors
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      error: { code: error.code, message: error.message },
    });
  }

  // Validation errors
  if (error.validation) {
    return reply.status(400).send({
      error: { code: 'VALIDATION_ERROR', details: error.validation },
    });
  }

  // Unknown errors - don't leak details
  return reply.status(500).send({
    error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' },
  });
});
```

---

## Graceful Shutdown

### DO ✅

```typescript
const shutdown = async (signal: string) => {
  app.log.info(`${signal} received, shutting down gracefully`);
  
  // Stop accepting new connections
  await app.close();
  
  // Close database connections
  await database.close();
  
  process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
```

### DON'T ❌

```typescript
// Hard exit, connections left open
process.on('SIGINT', () => process.exit(1));
```

---

## Testing

### DO ✅

```typescript
// Use app.inject() for testing
import { buildApp } from '../app';

describe('User Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates a user', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/users',
      payload: { email: 'test@example.com', name: 'Test' },
    });

    expect(response.statusCode).toBe(201);
  });
});
```

---

## Quick Reference

| Pattern | When to Use |
|---------|-------------|
| Plugin | Shared functionality across routes |
| Hook | Cross-cutting concerns (auth, logging) |
| Decorator | Add properties to app/request/reply |
| Schema | Validate all external input |
| Prefix | Group related routes |
