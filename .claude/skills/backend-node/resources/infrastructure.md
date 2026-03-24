# Infrastructure Patterns

Redis caching, message queues, Docker, health checks, and environment configuration.

<rules>
- ALWAYS set TTL on every cache write — never cache without expiry (causes stale data served indefinitely)
- ALWAYS invalidate cache on data mutation (update/delete) (causes stale reads)
- ALWAYS configure retry strategies for Redis and queue connections (causes lost jobs on transient failures)
- ALWAYS validate ALL environment variables at startup with Zod — fail fast on missing config (causes runtime crashes on first use)
- ALWAYS use multi-stage Docker builds with non-root user (causes bloated images and security risk if running as root)
- NEVER use `npm install` in production Docker — use `npm ci` (causes non-deterministic installs)
- NEVER access `process.env` directly outside the config module (causes scattered unvalidated env access)
</rules>

---

## Redis CacheService

```typescript
export class CacheService {
  private readonly redis: Redis;
  private readonly defaultTTL = 3600;

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 50, 2000),
    });
  }

  async get<T>(key: string): Promise<T | null> {
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }
  async set<T>(key: string, value: T, ttl = this.defaultTTL) {
    await this.redis.setex(key, ttl, JSON.stringify(value));
  }
  async delete(key: string) {
    await this.redis.del(key);
  }
}
```

---

## Message Queues (BullMQ)

Use queues for async work (email, notifications, processing). Configure retries and backoff:

```typescript
const emailQueue = new Queue<EmailJob>("email", {
  connection: { host: "localhost", port: 6379 },
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 1000 },
    removeOnComplete: 100,
    removeOnFail: 1000,
  },
});

const emailWorker = new Worker<EmailJob>(
  "email",
  async (job) => {
    await emailService.send(job.data);
  },
  { connection: { host: "localhost", port: 6379 }, concurrency: 5 },
);
```

---

## Health Checks

```typescript
app.get("/health", async (request, reply) => {
  const services: Record<string, string> = {};
  try {
    await mongoose.connection.db.admin().ping();
    services.mongodb = "connected";
  } catch {
    services.mongodb = "disconnected";
  }
  try {
    await redis.ping();
    services.redis = "connected";
  } catch {
    services.redis = "disconnected";
  }
  const healthy = Object.values(services).every((s) => s === "connected");
  reply
    .status(healthy ? 200 : 503)
    .send({ status: healthy ? "healthy" : "unhealthy", services });
});

app.get("/health/live", async () => ({ status: "alive" }));
```

---

## Environment Configuration

Validate once at startup. Export typed config:

```typescript
const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().default(3000),
  MONGODB_URI: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  SENTRY_DSN: z.string().url().optional(),
});

function loadConfig() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error("Invalid env vars:", result.error.format());
    process.exit(1);
  }
  return result.data;
}
export const config = loadConfig();
```

---

## Docker

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS production
WORKDIR /app
RUN addgroup -g 1001 nodejs && adduser -S -u 1001 -G nodejs nodejs
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./
USER nodejs
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

---

## Edge Cases

- **Redis connection loss**: CacheService should degrade gracefully — catch Redis errors and fall through to DB. Never let cache failures break the request.
- **Queue job ordering**: BullMQ does not guarantee strict FIFO when using concurrency > 1. If ordering matters, use concurrency: 1 or separate queues.
- **Config validation in tests**: Tests may not have all env vars. Create a `loadTestConfig()` that provides defaults for test-only values.

---

## Rules Summary

Redis caching always sets TTL and invalidates on mutation; the CacheService wraps ioredis with retry strategy and typed get/set/delete. BullMQ handles async work with exponential backoff retries and configurable concurrency. Health checks verify MongoDB and Redis connectivity, returning 503 when any dependency is down. Environment variables are validated once at startup with Zod — the typed config object is the only way to access configuration. Docker builds use multi-stage with `npm ci`, non-root user, and Alpine base. Queue workers handle failure events with structured logging.
