# Error Handling & Logging

Custom error classes, global error handler, structured logging, monitoring, and retry logic.

<rules>
- ALWAYS create domain-specific error classes extending a base AppError with statusCode and code (causes generic unhelpful errors if using raw Error)
- ALWAYS log errors with context: requestId, userId, path, method (causes undebuggable incidents if context is missing)
- ALWAYS redact sensitive fields in logs: password, token, authorization, cookie (causes credential exposure in log aggregators)
- ALWAYS use pino for structured JSON logging — never `console.log` in production (causes unparseable logs)
- NEVER expose stack traces or internal paths to clients (causes information leakage for attackers)
- NEVER swallow errors with empty catch blocks (causes silent data corruption)
- NEVER return error objects — throw errors, let the global handler catch them (causes inconsistent error handling)
</rules>

---

## Error Class Hierarchy

```typescript
export class AppError extends Error {
  constructor(
    message: string, public readonly statusCode: number,
    public readonly code: string, public readonly details?: Record<string, unknown>
  ) { super(message); this.name = this.constructor.name; }
  toJSON() { return { code: this.code, message: this.message, details: this.details }; }
}
// Extend for each HTTP status:
export class ValidationError extends AppError { constructor(msg: string, details?: Record<string, unknown>) { super(msg, 400, 'VALIDATION_ERROR', details); } }
export class UnauthorizedError extends AppError { constructor(msg = 'Unauthorized') { super(msg, 401, 'UNAUTHORIZED'); } }
export class ForbiddenError extends AppError { constructor(msg = 'Forbidden') { super(msg, 403, 'FORBIDDEN'); } }
export class NotFoundError extends AppError { constructor(msg = 'Not found') { super(msg, 404, 'NOT_FOUND'); } }
export class ConflictError extends AppError { constructor(msg: string) { super(msg, 409, 'CONFLICT'); } }
export class BusinessError extends AppError { constructor(msg: string, details?: Record<string, unknown>) { super(msg, 422, 'BUSINESS_ERROR', details); } }
```

---

## Global Error Handler

```typescript
export function errorHandler(error: Error, request: FastifyRequest, reply: FastifyReply) {
  request.log.error({ err: error, requestId: request.id, userId: request.user?.sub, path: request.url });

  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({ success: false, error: error.toJSON() });
  }
  if ('validation' in error) {
    return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid request data', details: (error as any).validation } });
  }
  if (error.name === 'MongoServerError' && (error as any).code === 11000) {
    return reply.status(409).send({ success: false, error: { code: 'CONFLICT', message: 'Resource already exists' } });
  }
  // Never expose internal details
  reply.status(500).send({ success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', requestId: request.id } });
}
```

---

## Structured Logging

```typescript
import pino from 'pino';

const logger = pino({
  level: config.LOG_LEVEL,
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: ['password', 'token', 'authorization', 'cookie'],
});

// Context-rich child loggers
const log = logger.child({ userId, action: 'createOrder' });
log.info({ itemCount: input.items.length }, 'Creating order');
```

---

## Request ID Tracking

```typescript
app.addHook('onRequest', (request, reply, done) => {
  request.id = request.headers['x-request-id'] as string || randomUUID();
  reply.header('x-request-id', request.id);
  done();
});
```

---

## Retry Logic for External Services

```typescript
async function withRetry<T>(fn: () => Promise<T>, options: {
  maxRetries: number; delayMs: number; backoff: 'linear' | 'exponential';
}): Promise<T> {
  let lastError: Error;
  for (let attempt = 1; attempt <= options.maxRetries; attempt++) {
    try { return await fn(); }
    catch (error) {
      lastError = error as Error;
      if (attempt === options.maxRetries) throw error;
      const delay = options.backoff === 'exponential'
        ? options.delayMs * Math.pow(2, attempt - 1) : options.delayMs * attempt;
      logger.warn({ attempt, delay, error: lastError.message }, 'Retrying');
      await sleep(delay);
    }
  }
  throw lastError!;
}
```

---

## Edge Cases

- **MongoServerError code 11000**: Duplicate key violation. Map to ConflictError (409) in the global handler. Extract the duplicated field from `error.keyPattern` for a useful message.
- **Unhandled rejections**: Register `process.on('unhandledRejection')` to log and report to Sentry. In production, exit after logging to avoid undefined state.
- **Async error handler**: Fastify's error handler can be async. If the error handler itself throws, Fastify sends a generic 500.

---

## Rules Summary

All errors use a typed AppError hierarchy that carries statusCode and code. The global error handler maps AppErrors to HTTP responses, handles Fastify validation errors, catches MongoDB duplicate key errors (11000 → 409), and returns a generic message for unknown 500s with requestId for support reference. Logging uses pino with structured JSON, child loggers for context, and mandatory redaction of sensitive fields. Request IDs are generated or forwarded from `x-request-id` headers and included in all log entries and error responses. External service calls use retry with exponential backoff. Process-level handlers catch unhandled rejections and uncaught exceptions.
