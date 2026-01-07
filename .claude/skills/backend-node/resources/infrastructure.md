# Infrastructure Patterns

Redis caching, message queues, WebSockets, and Docker.

---

## Redis Caching

### DO ✅

```typescript
import Redis from 'ioredis';

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

  async set<T>(key: string, value: T, ttl = this.defaultTTL): Promise<void> {
    await this.redis.setex(key, ttl, JSON.stringify(value));
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async deletePattern(pattern: string): Promise<void> {
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}

// Usage in service
class ProductService {
  async findById(id: string): Promise<Product> {
    const cacheKey = `product:${id}`;
    
    // Try cache first
    const cached = await this.cache.get<Product>(cacheKey);
    if (cached) return cached;

    // Fetch from DB
    const product = await this.repo.findById(id);
    if (!product) throw new NotFoundError();

    // Cache for next time
    await this.cache.set(cacheKey, product, 3600);
    
    return product;
  }

  async update(id: string, data: UpdateData): Promise<Product> {
    const product = await this.repo.update(id, data);
    
    // Invalidate cache
    await this.cache.delete(`product:${id}`);
    
    return product;
  }
}
```

### DON'T ❌

```typescript
// No TTL - stale data forever
await redis.set(key, value);

// Cache without invalidation
await cache.set('products:list', products);  // Never updated!

// Cache everything
await cache.set(`user:${id}:lastLogin`, timestamp);  // Pointless
```

---

## Message Queues (BullMQ)

### DO ✅

```typescript
import { Queue, Worker, Job } from 'bullmq';

// Define job types
interface EmailJob {
  to: string;
  subject: string;
  template: string;
  data: Record<string, unknown>;
}

// Create queue
const emailQueue = new Queue<EmailJob>('email', {
  connection: { host: 'localhost', port: 6379 },
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: 100,  // Keep last 100 completed
    removeOnFail: 1000,     // Keep last 1000 failed
  },
});

// Add jobs
async function sendEmail(email: EmailJob): Promise<void> {
  await emailQueue.add('send', email, {
    priority: email.subject.includes('urgent') ? 1 : 2,
  });
}

// Process jobs
const emailWorker = new Worker<EmailJob>('email', async (job) => {
  const { to, subject, template, data } = job.data;
  
  logger.info({ jobId: job.id, to }, 'Processing email job');
  
  await emailService.send({ to, subject, template, data });
  
  logger.info({ jobId: job.id }, 'Email sent successfully');
}, {
  connection: { host: 'localhost', port: 6379 },
  concurrency: 5,
});

// Handle events
emailWorker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'Job completed');
});

emailWorker.on('failed', (job, error) => {
  logger.error({ jobId: job?.id, err: error }, 'Job failed');
});
```

### DON'T ❌

```typescript
// Fire and forget without queue
await sendEmail(user.email);  // If this fails, email lost

// No retry configuration
new Queue('critical', {});  // One failure = lost forever

// Process synchronously
app.post('/order', async (req) => {
  await processPayment();
  await sendConfirmation();  // User waits for email!
  await updateInventory();
  return { success: true };
});
```

---

## WebSockets

### DO ✅

```typescript
import { WebSocketServer, WebSocket } from 'ws';

interface Client {
  ws: WebSocket;
  userId: string;
  rooms: Set<string>;
}

class WebSocketManager {
  private clients = new Map<string, Client>();
  private rooms = new Map<string, Set<string>>();

  handleConnection(ws: WebSocket, userId: string): void {
    const clientId = randomUUID();
    
    this.clients.set(clientId, {
      ws,
      userId,
      rooms: new Set(),
    });

    ws.on('message', (data) => this.handleMessage(clientId, data));
    ws.on('close', () => this.handleDisconnect(clientId));
  }

  joinRoom(clientId: string, room: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.rooms.add(room);
    
    if (!this.rooms.has(room)) {
      this.rooms.set(room, new Set());
    }
    this.rooms.get(room)!.add(clientId);
  }

  sendToRoom(room: string, message: unknown): void {
    const clientIds = this.rooms.get(room);
    if (!clientIds) return;

    const payload = JSON.stringify(message);
    
    for (const clientId of clientIds) {
      const client = this.clients.get(clientId);
      if (client?.ws.readyState === WebSocket.OPEN) {
        client.ws.send(payload);
      }
    }
  }

  sendToUser(userId: string, message: unknown): void {
    const payload = JSON.stringify(message);
    
    for (const client of this.clients.values()) {
      if (client.userId === userId && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(payload);
      }
    }
  }
}
```

---

## Docker Configuration

### DO ✅

```dockerfile
# Multi-stage build
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production image
FROM node:20-alpine AS production

WORKDIR /app

# Non-root user
RUN addgroup -g 1001 nodejs && \
    adduser -S -u 1001 -G nodejs nodejs

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./

USER nodejs

EXPOSE 3000
CMD ["node", "dist/server.js"]
```

### docker-compose.yml

```yaml
version: '3.8'

services:
  api:
    build:
      context: .
      target: production
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - MONGODB_URI=mongodb://mongo:27017/app
      - REDIS_URL=redis://redis:6379
    depends_on:
      - mongo
      - redis
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  mongo:
    image: mongo:7
    volumes:
      - mongo_data:/data/db
    healthcheck:
      test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]

volumes:
  mongo_data:
  redis_data:
```

### DON'T ❌

```dockerfile
# Run as root
FROM node:20
COPY . .
RUN npm install  # Includes devDependencies!
CMD ["npm", "start"]
```

---

## Health Checks

### DO ✅

```typescript
interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  services: Record<string, 'connected' | 'disconnected'>;
}

app.get('/health', async (request, reply) => {
  const services: Record<string, 'connected' | 'disconnected'> = {};
  
  // Check MongoDB
  try {
    await mongoose.connection.db.admin().ping();
    services.mongodb = 'connected';
  } catch {
    services.mongodb = 'disconnected';
  }
  
  // Check Redis
  try {
    await redis.ping();
    services.redis = 'connected';
  } catch {
    services.redis = 'disconnected';
  }

  const isHealthy = Object.values(services).every((s) => s === 'connected');

  const status: HealthStatus = {
    status: isHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    services,
  };

  reply.status(isHealthy ? 200 : 503).send(status);
});

// Liveness vs Readiness
app.get('/health/live', async () => ({ status: 'alive' }));

app.get('/health/ready', async (request, reply) => {
  // Check if ready to receive traffic
  const ready = await checkDependencies();
  reply.status(ready ? 200 : 503).send({ ready });
});
```

---

## Environment Configuration

### DO ✅

```typescript
// config.ts
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  
  // Database
  MONGODB_URI: z.string().url(),
  
  // Redis
  REDIS_URL: z.string().url(),
  
  // Auth
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  
  // External services
  SENTRY_DSN: z.string().url().optional(),
});

function loadConfig() {
  const result = envSchema.safeParse(process.env);
  
  if (!result.success) {
    console.error('❌ Invalid environment variables:');
    console.error(result.error.format());
    process.exit(1);
  }
  
  return result.data;
}

export const config = loadConfig();
```

### DON'T ❌

```typescript
// Scattered env access
const port = process.env.PORT || 3000;
const secret = process.env.JWT_SECRET;  // Might be undefined!

// No validation
if (!process.env.DB_URI) {
  // Error at runtime, not startup
}
```

---

## Quick Reference

| Technology | Use Case |
|------------|----------|
| Redis | Caching, sessions, pub/sub |
| BullMQ | Background jobs, retries |
| WebSockets | Real-time communication |
| Docker | Containerization |

| Cache Pattern | When to Use |
|---------------|-------------|
| Cache-aside | General caching |
| Write-through | Strong consistency |
| TTL | Time-based expiry |
| Invalidation | On data change |
