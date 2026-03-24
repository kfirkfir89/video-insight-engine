# Fastify Patterns

Setup, routing, plugins, hooks, and middleware for Fastify.

<rules>
- ALWAYS separate app creation (`buildApp()`) from server start (`app.listen()`) — testability requires injection via `app.inject()` (causes untestable server if combined)
- ALWAYS group routes by feature with `app.register(routes, { prefix })` (causes unmaintainable monolith if all routes in one file)
- ALWAYS attach Zod schemas to route definitions via `schema: { body, params, querystring, response }` (causes unvalidated input if done manually in handlers)
- ALWAYS encapsulate shared functionality in plugins using `fastify-plugin` (causes scope leaks if not using fp wrapper)
- ALWAYS type decorators with `declare module 'fastify'` augmentation (causes `any` access if using untyped decorators)
- NEVER put auth checks in every handler — use `preHandler` hooks (causes duplication and missed checks)
- NEVER put business logic in route handlers — delegate to services (causes untestable, bloated routes)
</rules>

---

## App Bootstrap

Separate creation from startup for testability:

```typescript
// app.ts
export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: config.LOG_LEVEL,
      transport: isDev ? { target: 'pino-pretty' } : undefined },
  });
  await app.register(cors, { origin: config.CORS_ORIGINS });
  await app.register(helmet);
  await app.register(routes);
  return app;
}

// server.ts
const app = await buildApp();
await app.listen({ port: config.PORT, host: '0.0.0.0' });
```

---

## Route Organization

Group by feature, attach schemas, delegate to services:

```typescript
// routes/index.ts
export async function routes(app: FastifyInstance) {
  await app.register(userRoutes, { prefix: '/api/v1/users' });
  await app.register(healthRoutes, { prefix: '/health' });
}

// users/user.route.ts
export async function userRoutes(app: FastifyInstance) {
  app.post('/', {
    schema: { body: zodToJsonSchema(createUserBody) },
    handler: createUser,
  });
  app.get('/:id', { preHandler: [authenticate], handler: getUser });
}
```

---

## Plugins & Decorators

Wrap with `fastify-plugin`, always type-augment:

```typescript
import fp from 'fastify-plugin';

declare module 'fastify' {
  interface FastifyInstance { db: Database; }
  interface FastifyRequest { user?: TokenPayload; }
}

export const databasePlugin = fp(async (app, opts) => {
  const client = await connectToDatabase(opts.uri);
  app.decorate('db', client);
  app.addHook('onClose', async () => { await client.close(); });
});
```

---

## Hooks & Lifecycle

Request lifecycle: `onRequest → preParsing → preValidation → preHandler → handler → preSerialization → onSend → onResponse`

Use hooks for cross-cutting concerns. Use route-specific `preHandler` for auth:

```typescript
app.addHook('onRequest', async (request) => {
  request.startTime = Date.now();
});

app.get('/admin', {
  preHandler: [authenticate, requireAdmin],
  handler: adminHandler,
});
```

---

## Error Handling & Shutdown

Set a global error handler. Handle graceful shutdown:

```typescript
app.setErrorHandler((error, request, reply) => {
  request.log.error(error);
  if (error instanceof AppError)
    return reply.status(error.statusCode).send({ error: { code: error.code, message: error.message } });
  if (error.validation)
    return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', details: error.validation } });
  return reply.status(500).send({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
});

// Graceful shutdown
const shutdown = async (signal: string) => {
  app.log.info(`${signal} received, shutting down`);
  await app.close();
  await database.close();
  process.exit(0);
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
```

---

## Edge Cases

- **Schema validation + custom errors**: Fastify's built-in validation returns generic messages. Override `schemaErrorFormatter` for user-friendly messages.
- **Plugin scope isolation**: Without `fastify-plugin` wrapper, decorators are scoped to the encapsulating plugin only. Use `fp()` when you need app-wide access.
- **Streaming responses**: For SSE, write directly to `reply.raw` — Fastify's serialization pipeline won't apply. Set headers manually.

---

## Rules Summary

Every Fastify app separates creation from startup for `app.inject()` testability. Routes register as plugins with prefixes, attach Zod-to-JSON schemas for automatic validation, and delegate all logic to services. Shared functionality lives in `fastify-plugin`-wrapped plugins with typed decorators. Auth and logging use hooks (preHandler for route-specific, onRequest for global). The global error handler maps AppError subclasses to HTTP status codes, handles Fastify validation errors, and never exposes internal details on 500s. Shutdown is graceful: close app first, then database connections.
