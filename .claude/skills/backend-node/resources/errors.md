# Error Handling & Logging Patterns

Custom errors, error handlers, structured logging, and monitoring.

---

## Custom Error Classes

### DO ✅

```typescript
// Base error with HTTP semantics
export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }
}

// Specific error types
export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT');
  }
}

export class BusinessError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 422, 'BUSINESS_ERROR', details);
  }
}
```

### DON'T ❌

```typescript
// Generic errors everywhere
throw new Error('Something went wrong');

// Error objects instead of throwing
return { success: false, error: 'Not found' };

// HTTP codes in services
if (!user) {
  throw { status: 404, message: 'Not found' };  // Service knows HTTP!
}
```

---

## Global Error Handler

### DO ✅

```typescript
export function errorHandler(
  error: Error,
  request: FastifyRequest,
  reply: FastifyReply
): void {
  // Always log the error
  request.log.error({
    err: error,
    requestId: request.id,
    userId: request.user?.sub,
    path: request.url,
    method: request.method,
  });

  // Custom app errors - safe to expose
  if (error instanceof AppError) {
    reply.status(error.statusCode).send({
      success: false,
      error: error.toJSON(),
    });
    return;
  }

  // Fastify validation errors
  if ('validation' in error) {
    reply.status(400).send({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: (error as any).validation,
      },
    });
    return;
  }

  // Database errors
  if (error.name === 'MongoServerError') {
    const mongoError = error as MongoServerError;
    
    // Duplicate key
    if (mongoError.code === 11000) {
      reply.status(409).send({
        success: false,
        error: {
          code: 'CONFLICT',
          message: 'Resource already exists',
        },
      });
      return;
    }
  }

  // Unknown errors - never expose details
  reply.status(500).send({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      requestId: request.id,  // For support reference
    },
  });
}
```

### DON'T ❌

```typescript
// Expose stack traces
reply.status(500).send({
  error: error.message,
  stack: error.stack,  // Security risk!
});

// Ignore errors
app.setErrorHandler((error, request, reply) => {
  reply.status(500).send({ error: 'Error' });  // No logging!
});

// Catch and swallow
try {
  await riskyOperation();
} catch (e) {
  // Nothing here - error lost forever
}
```

---

## Structured Logging

### DO ✅

```typescript
import pino from 'pino';

const logger = pino({
  level: config.LOG_LEVEL,
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: ['password', 'token', 'authorization', 'cookie'],
});

// Context-rich logging
class OrderService {
  async createOrder(input: CreateOrderInput, userId: string) {
    const log = logger.child({ userId, action: 'createOrder' });
    
    log.info({ itemCount: input.items.length }, 'Creating order');

    try {
      const order = await this.orderRepo.create(input);
      log.info({ orderId: order.id }, 'Order created successfully');
      return order;
    } catch (error) {
      log.error({ err: error }, 'Failed to create order');
      throw error;
    }
  }
}
```

### DON'T ❌

```typescript
// Unstructured logs
console.log('Creating order for user ' + userId);
console.log('Error: ' + error.message);

// Logging sensitive data
logger.info({ user: { password: user.password } });

// Missing context
logger.error('Something failed');  // What? Where? For whom?
```

---

## Error Monitoring (Sentry)

### DO ✅

```typescript
import * as Sentry from '@sentry/node';

// Initialize
Sentry.init({
  dsn: config.SENTRY_DSN,
  environment: config.NODE_ENV,
  release: config.VERSION,
  tracesSampleRate: config.NODE_ENV === 'production' ? 0.1 : 1.0,
  integrations: [
    new Sentry.Integrations.Http({ tracing: true }),
    new Sentry.Integrations.Mongo({ useMongoose: true }),
  ],
});

// Add context to errors
app.addHook('onRequest', (request, reply, done) => {
  Sentry.setUser({
    id: request.user?.sub,
    email: request.user?.email,
  });
  Sentry.setTag('requestId', request.id);
  done();
});

// Capture in error handler
app.setErrorHandler((error, request, reply) => {
  // Only capture unexpected errors
  if (!(error instanceof AppError)) {
    Sentry.withScope((scope) => {
      scope.setExtra('requestBody', request.body);
      scope.setExtra('requestParams', request.params);
      Sentry.captureException(error);
    });
  }

  // ... rest of error handling
});
```

---

## Error Boundaries in Async Code

### DO ✅

```typescript
// Handle promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason, promise }, 'Unhandled Promise Rejection');
  Sentry.captureException(reason);
});

process.on('uncaughtException', (error) => {
  logger.fatal({ err: error }, 'Uncaught Exception');
  Sentry.captureException(error);
  
  // Exit after logging
  setTimeout(() => process.exit(1), 1000);
});

// Wrap async handlers
function asyncHandler<T>(
  fn: (req: FastifyRequest, reply: FastifyReply) => Promise<T>
) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      return await fn(req, reply);
    } catch (error) {
      // Will be caught by error handler
      throw error;
    }
  };
}
```

---

## Request ID Tracking

### DO ✅

```typescript
import { randomUUID } from 'crypto';

// Generate or use existing request ID
app.addHook('onRequest', (request, reply, done) => {
  request.id = request.headers['x-request-id'] as string || randomUUID();
  reply.header('x-request-id', request.id);
  done();
});

// Include in all logs
app.addHook('onRequest', (request, reply, done) => {
  request.log = logger.child({ requestId: request.id });
  done();
});

// Include in error responses
reply.status(500).send({
  error: {
    code: 'INTERNAL_ERROR',
    message: 'Something went wrong',
    requestId: request.id,  // User can reference this
  },
});
```

---

## Retry Logic for External Services

### DO ✅

```typescript
interface RetryOptions {
  maxRetries: number;
  delayMs: number;
  backoff: 'linear' | 'exponential';
  retryableErrors?: string[];
}

async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  const { maxRetries, delayMs, backoff, retryableErrors } = options;
  
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      // Check if error is retryable
      const isRetryable = !retryableErrors || 
        retryableErrors.includes(error.code);
      
      if (!isRetryable || attempt === maxRetries) {
        throw error;
      }

      // Calculate delay
      const delay = backoff === 'exponential'
        ? delayMs * Math.pow(2, attempt - 1)
        : delayMs * attempt;

      logger.warn({
        attempt,
        maxRetries,
        delay,
        error: lastError.message,
      }, 'Retrying after error');

      await sleep(delay);
    }
  }

  throw lastError!;
}

// Usage
const result = await withRetry(
  () => externalApi.call(data),
  { maxRetries: 3, delayMs: 1000, backoff: 'exponential' }
);
```

---

## Quick Reference

| Error Type | Status Code | When to Use |
|------------|-------------|-------------|
| ValidationError | 400 | Invalid input data |
| UnauthorizedError | 401 | Missing/invalid auth |
| ForbiddenError | 403 | Valid auth, no permission |
| NotFoundError | 404 | Resource doesn't exist |
| ConflictError | 409 | Duplicate, constraint violation |
| BusinessError | 422 | Business rule violated |
| AppError (500) | 500 | Unexpected server error |

| Logging Rule | Implementation |
|--------------|----------------|
| Always structured | Use pino with objects |
| Always contextual | Include requestId, userId |
| Redact sensitive | password, token, etc. |
| Log level by env | debug in dev, info in prod |
