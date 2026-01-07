# Implementation Track 1: vie-api (Node.js Backend)

> **Parallel Track** - Can run simultaneously with other tracks.
> **Prerequisite:** [IMPL-00-SHARED.md](./IMPL-00-SHARED.md) complete.

---

## Overview

| What | Details |
|------|---------|
| **Service** | vie-api |
| **Tech** | Node.js 20 + Fastify + TypeScript |
| **Port** | 3000 |
| **Role** | REST API + WebSocket + MCP Client |

---

## Phase 1: Project Setup

### 1.1 Initialize Project

- [ ] Create `api/package.json`

```json
{
  "name": "@vie/api",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src/"
  },
  "dependencies": {
    "@fastify/cookie": "^9.3.0",
    "@fastify/cors": "^9.0.0",
    "@fastify/helmet": "^11.1.0",
    "@fastify/jwt": "^8.0.0",
    "@fastify/rate-limit": "^9.1.0",
    "@fastify/websocket": "^10.0.0",
    "@modelcontextprotocol/sdk": "^1.0.0",
    "amqplib": "^0.10.0",
    "bcrypt": "^5.1.0",
    "fastify": "^4.26.0",
    "mongodb": "^6.3.0",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "@types/amqplib": "^0.10.0",
    "@types/bcrypt": "^5.0.0",
    "@types/node": "^20.11.0",
    "tsx": "^4.7.0",
    "typescript": "^5.3.0"
  }
}
```

- [ ] Create `api/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "resolveJsonModule": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] Install dependencies

```bash
cd api && pnpm install
```

---

### 1.2 Create Directory Structure

```bash
mkdir -p api/src/{plugins,routes,services,schemas,types,utils}
```

```
api/src/
├── index.ts              # Entry point
├── config.ts             # Environment config
├── plugins/
│   ├── mongodb.ts        # Database connection
│   ├── rabbitmq.ts       # Queue connection
│   ├── jwt.ts            # Authentication
│   ├── cors.ts           # CORS config
│   ├── rate-limit.ts     # Rate limiting
│   └── websocket.ts      # Real-time updates
├── routes/
│   ├── auth.routes.ts
│   ├── folders.routes.ts
│   ├── videos.routes.ts
│   ├── memorize.routes.ts
│   └── explain.routes.ts
├── services/
│   ├── auth.service.ts
│   ├── folder.service.ts
│   ├── video.service.ts
│   ├── memorize.service.ts
│   └── cache.service.ts
├── schemas/
│   ├── auth.schema.ts
│   ├── folder.schema.ts
│   ├── video.schema.ts
│   └── memorize.schema.ts
└── utils/
    ├── errors.ts
    └── youtube.ts
```

---

## Phase 2: Core Infrastructure

### 2.1 Config

- [ ] Create `api/src/config.ts`

```typescript
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.string().default('3000').transform(Number),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  MONGODB_URI: z.string(),
  RABBITMQ_URI: z.string(),
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  FRONTEND_URL: z.string().default('http://localhost:5173'),
});

export const config = envSchema.parse(process.env);
```

---

### 2.2 Entry Point

- [ ] Create `api/src/index.ts`

```typescript
import Fastify from 'fastify';
import { config } from './config.js';

// Plugins
import { mongodbPlugin } from './plugins/mongodb.js';
import { rabbitmqPlugin } from './plugins/rabbitmq.js';
import { jwtPlugin } from './plugins/jwt.js';
import { corsPlugin } from './plugins/cors.js';
import { rateLimitPlugin } from './plugins/rate-limit.js';
import { websocketPlugin } from './plugins/websocket.js';

// Routes
import { authRoutes } from './routes/auth.routes.js';
import { foldersRoutes } from './routes/folders.routes.js';
import { videosRoutes } from './routes/videos.routes.js';
import { memorizeRoutes } from './routes/memorize.routes.js';
import { explainRoutes } from './routes/explain.routes.js';

const fastify = Fastify({
  logger: {
    level: config.NODE_ENV === 'production' ? 'info' : 'debug',
  },
});

// Register plugins
await fastify.register(corsPlugin);
await fastify.register(rateLimitPlugin);
await fastify.register(mongodbPlugin);
await fastify.register(rabbitmqPlugin);
await fastify.register(jwtPlugin);
await fastify.register(websocketPlugin);

// Register routes
await fastify.register(authRoutes, { prefix: '/api/auth' });
await fastify.register(foldersRoutes, { prefix: '/api/folders' });
await fastify.register(videosRoutes, { prefix: '/api/videos' });
await fastify.register(memorizeRoutes, { prefix: '/api/memorize' });
await fastify.register(explainRoutes, { prefix: '/api/explain' });

// Health check
fastify.get('/health', async () => ({
  status: 'ok',
  timestamp: new Date().toISOString(),
}));

// Start server
try {
  await fastify.listen({ port: config.PORT, host: '0.0.0.0' });
  console.log(`🚀 vie-api running on port ${config.PORT}`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
```

---

### 2.3 MongoDB Plugin

- [ ] Create `api/src/plugins/mongodb.ts`

```typescript
import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { MongoClient, Db } from 'mongodb';
import { config } from '../config.js';

declare module 'fastify' {
  interface FastifyInstance {
    mongo: {
      client: MongoClient;
      db: Db;
    };
  }
}

async function mongodb(fastify: FastifyInstance) {
  const client = new MongoClient(config.MONGODB_URI);
  await client.connect();
  
  const db = client.db();
  
  fastify.decorate('mongo', { client, db });
  
  fastify.addHook('onClose', async () => {
    await client.close();
  });
  
  fastify.log.info('✅ MongoDB connected');
}

export const mongodbPlugin = fp(mongodb);
```

---

### 2.4 RabbitMQ Plugin

- [ ] Create `api/src/plugins/rabbitmq.ts`

```typescript
import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import amqp, { Channel, Connection } from 'amqplib';
import { config } from '../config.js';

declare module 'fastify' {
  interface FastifyInstance {
    rabbitmq: {
      channel: Channel;
      publish: (queue: string, message: object) => Promise<void>;
    };
  }
}

async function rabbitmq(fastify: FastifyInstance) {
  const connection: Connection = await amqp.connect(config.RABBITMQ_URI);
  const channel: Channel = await connection.createChannel();
  
  // Ensure queues exist
  await channel.assertQueue('summarize.jobs', { durable: true });
  await channel.assertExchange('job.status', 'fanout', { durable: true });
  
  const publish = async (queue: string, message: object) => {
    channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)), {
      persistent: true,
    });
  };
  
  fastify.decorate('rabbitmq', { channel, publish });
  
  fastify.addHook('onClose', async () => {
    await channel.close();
    await connection.close();
  });
  
  fastify.log.info('✅ RabbitMQ connected');
}

export const rabbitmqPlugin = fp(rabbitmq);
```

---

### 2.5 JWT Plugin

- [ ] Create `api/src/plugins/jwt.ts`

```typescript
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
import fastifyCookie from '@fastify/cookie';
import { config } from '../config.js';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { userId: string; email: string };
    user: { id: string; email: string };
  }
}

async function jwt(fastify: FastifyInstance) {
  await fastify.register(fastifyCookie);
  
  await fastify.register(fastifyJwt, {
    secret: config.JWT_SECRET,
    sign: { expiresIn: config.JWT_EXPIRES_IN },
  });
  
  fastify.decorate('authenticate', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      await req.jwtVerify();
      req.user = { id: req.user.userId, email: req.user.email };
    } catch (err) {
      reply.code(401).send({ error: 'UNAUTHORIZED', message: 'Invalid token' });
    }
  });
}

export const jwtPlugin = fp(jwt);
```

---

### 2.6 Rate Limit Plugin

- [ ] Create `api/src/plugins/rate-limit.ts`

```typescript
import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import rateLimit from '@fastify/rate-limit';

async function rateLimitPlugin(fastify: FastifyInstance) {
  await fastify.register(rateLimit, {
    global: true,
    max: 100,
    timeWindow: '1 minute',
    keyGenerator: (req) => {
      return req.user?.id || req.ip;
    },
    errorResponseBuilder: () => ({
      error: 'RATE_LIMITED',
      message: 'Too many requests',
      statusCode: 429,
    }),
  });
}

export { rateLimitPlugin };
```

---

### 2.7 CORS Plugin

- [ ] Create `api/src/plugins/cors.ts`

```typescript
import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import cors from '@fastify/cors';
import { config } from '../config.js';

async function corsPlugin(fastify: FastifyInstance) {
  await fastify.register(cors, {
    origin: [config.FRONTEND_URL, 'http://localhost:5173'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
}

export { corsPlugin };
```

---

## Phase 3: Auth Routes

### 3.1 Auth Schemas

- [ ] Create `api/src/schemas/auth.schema.ts`

```typescript
import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email().toLowerCase().max(255),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain uppercase')
    .regex(/[a-z]/, 'Password must contain lowercase')
    .regex(/[0-9]/, 'Password must contain number'),
  name: z.string().min(1).max(100),
});

export const loginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
```

---

### 3.2 Auth Service

- [ ] Create `api/src/services/auth.service.ts`

```typescript
import { Db, ObjectId } from 'mongodb';
import bcrypt from 'bcrypt';
import { RegisterInput, LoginInput } from '../schemas/auth.schema.js';

export class AuthService {
  constructor(private db: Db) {}

  async register(input: RegisterInput) {
    const existing = await this.db.collection('users').findOne({ email: input.email });
    if (existing) {
      throw { code: 'EMAIL_EXISTS', status: 409 };
    }

    const passwordHash = await bcrypt.hash(input.password, 10);
    
    const result = await this.db.collection('users').insertOne({
      email: input.email,
      passwordHash,
      name: input.name,
      preferences: {
        defaultSummarizedFolder: null,
        defaultMemorizedFolder: null,
        theme: 'system',
      },
      usage: {
        videosThisMonth: 0,
        videosResetAt: new Date(),
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return {
      id: result.insertedId.toString(),
      email: input.email,
      name: input.name,
    };
  }

  async login(input: LoginInput) {
    const user = await this.db.collection('users').findOne({ email: input.email });
    if (!user) {
      throw { code: 'INVALID_CREDENTIALS', status: 401 };
    }

    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) {
      throw { code: 'INVALID_CREDENTIALS', status: 401 };
    }

    await this.db.collection('users').updateOne(
      { _id: user._id },
      { $set: { lastLoginAt: new Date() } }
    );

    return {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
    };
  }

  async getUser(userId: string) {
    const user = await this.db.collection('users').findOne({ _id: new ObjectId(userId) });
    if (!user) {
      throw { code: 'NOT_FOUND', status: 404 };
    }

    return {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
    };
  }
}
```

---

### 3.3 Auth Routes

- [ ] Create `api/src/routes/auth.routes.ts`

```typescript
import { FastifyInstance } from 'fastify';
import { AuthService } from '../services/auth.service.js';
import { registerSchema, loginSchema } from '../schemas/auth.schema.js';
import { config } from '../config.js';

export async function authRoutes(fastify: FastifyInstance) {
  const authService = new AuthService(fastify.mongo.db);

  // POST /api/auth/register
  fastify.post('/register', {
    config: {
      rateLimit: { max: 5, timeWindow: '1 hour' },
    },
  }, async (req, reply) => {
    const input = registerSchema.parse(req.body);
    const user = await authService.register(input);

    const accessToken = fastify.jwt.sign(
      { userId: user.id, email: user.email },
      { expiresIn: config.JWT_EXPIRES_IN }
    );

    const refreshToken = fastify.jwt.sign(
      { userId: user.id },
      { expiresIn: config.JWT_REFRESH_EXPIRES_IN }
    );

    reply.setCookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: config.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/auth/refresh',
      maxAge: 7 * 24 * 60 * 60,
    });

    return reply.code(201).send({
      accessToken,
      expiresIn: 900,
      user,
    });
  });

  // POST /api/auth/login
  fastify.post('/login', {
    config: {
      rateLimit: { max: 10, timeWindow: '15 minutes' },
    },
  }, async (req, reply) => {
    const input = loginSchema.parse(req.body);
    const user = await authService.login(input);

    const accessToken = fastify.jwt.sign(
      { userId: user.id, email: user.email },
      { expiresIn: config.JWT_EXPIRES_IN }
    );

    const refreshToken = fastify.jwt.sign(
      { userId: user.id },
      { expiresIn: config.JWT_REFRESH_EXPIRES_IN }
    );

    reply.setCookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: config.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/auth/refresh',
      maxAge: 7 * 24 * 60 * 60,
    });

    return { accessToken, expiresIn: 900, user };
  });

  // POST /api/auth/refresh
  fastify.post('/refresh', async (req, reply) => {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
      return reply.code(401).send({ error: 'REFRESH_EXPIRED' });
    }

    try {
      const payload = fastify.jwt.verify<{ userId: string }>(refreshToken);
      const accessToken = fastify.jwt.sign(
        { userId: payload.userId },
        { expiresIn: config.JWT_EXPIRES_IN }
      );

      return { accessToken, expiresIn: 900 };
    } catch {
      reply.clearCookie('refreshToken', { path: '/api/auth/refresh' });
      return reply.code(401).send({ error: 'REFRESH_EXPIRED' });
    }
  });

  // POST /api/auth/logout
  fastify.post('/logout', async (req, reply) => {
    reply.clearCookie('refreshToken', { path: '/api/auth/refresh' });
    return { success: true };
  });

  // GET /api/auth/me
  fastify.get('/me', {
    preHandler: [fastify.authenticate],
  }, async (req) => {
    return authService.getUser(req.user.id);
  });
}
```

---

## Phase 4: Videos Routes

### 4.1 YouTube Utils

- [ ] Create `api/src/utils/youtube.ts`

```typescript
export function extractYoutubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}

export function isValidYoutubeUrl(url: string): boolean {
  return extractYoutubeId(url) !== null;
}
```

---

### 4.2 Video Service

- [ ] Create `api/src/services/video.service.ts`

```typescript
import { Db, ObjectId } from 'mongodb';
import { extractYoutubeId } from '../utils/youtube.js';

interface RabbitMQ {
  publish: (queue: string, message: object) => Promise<void>;
}

export class VideoService {
  constructor(private db: Db, private rabbitmq: RabbitMQ) {}

  async createVideo(userId: string, url: string, folderId?: string) {
    const youtubeId = extractYoutubeId(url);
    if (!youtubeId) {
      throw { code: 'INVALID_YOUTUBE_URL', status: 400 };
    }

    // Check cache
    const cached = await this.db.collection('videoSummaryCache').findOne({ youtubeId });

    if (cached?.status === 'completed') {
      // Cache HIT
      const userVideo = await this.db.collection('userVideos').insertOne({
        userId: new ObjectId(userId),
        videoSummaryId: cached._id,
        youtubeId,
        title: cached.title,
        channel: cached.channel,
        duration: cached.duration,
        thumbnailUrl: cached.thumbnailUrl,
        status: 'completed',
        folderId: folderId ? new ObjectId(folderId) : null,
        addedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      return {
        video: { id: userVideo.insertedId.toString(), status: 'completed', ...cached },
        cached: true,
      };
    }

    if (cached?.status === 'processing') {
      // Already processing
      const userVideo = await this.db.collection('userVideos').insertOne({
        userId: new ObjectId(userId),
        videoSummaryId: cached._id,
        youtubeId,
        status: 'processing',
        folderId: folderId ? new ObjectId(folderId) : null,
        addedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      return {
        video: { id: userVideo.insertedId.toString(), status: 'processing' },
        cached: false,
      };
    }

    // Cache MISS - create entry and queue job
    const cacheEntry = await this.db.collection('videoSummaryCache').insertOne({
      youtubeId,
      url,
      status: 'pending',
      version: 1,
      retryCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await this.rabbitmq.publish('summarize.jobs', {
      videoSummaryId: cacheEntry.insertedId.toString(),
      youtubeId,
      url,
      userId,
    });

    const userVideo = await this.db.collection('userVideos').insertOne({
      userId: new ObjectId(userId),
      videoSummaryId: cacheEntry.insertedId,
      youtubeId,
      status: 'pending',
      folderId: folderId ? new ObjectId(folderId) : null,
      addedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return {
      video: {
        id: userVideo.insertedId.toString(),
        videoSummaryId: cacheEntry.insertedId.toString(),
        youtubeId,
        status: 'pending',
      },
      cached: false,
    };
  }

  async getVideos(userId: string, folderId?: string) {
    const query: any = { userId: new ObjectId(userId) };
    if (folderId) {
      query.folderId = new ObjectId(folderId);
    }

    const videos = await this.db.collection('userVideos')
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    return videos.map(v => ({
      id: v._id.toString(),
      videoSummaryId: v.videoSummaryId.toString(),
      youtubeId: v.youtubeId,
      title: v.title,
      channel: v.channel,
      duration: v.duration,
      thumbnailUrl: v.thumbnailUrl,
      status: v.status,
      folderId: v.folderId?.toString() || null,
      createdAt: v.createdAt.toISOString(),
    }));
  }

  async getVideo(userId: string, videoId: string) {
    const video = await this.db.collection('userVideos').findOne({
      _id: new ObjectId(videoId),
      userId: new ObjectId(userId),
    });

    if (!video) {
      throw { code: 'NOT_FOUND', status: 404 };
    }

    const summary = await this.db.collection('videoSummaryCache').findOne({
      _id: video.videoSummaryId,
    });

    return {
      video: {
        id: video._id.toString(),
        youtubeId: video.youtubeId,
        title: video.title || summary?.title,
        channel: video.channel || summary?.channel,
        duration: video.duration || summary?.duration,
        thumbnailUrl: video.thumbnailUrl || summary?.thumbnailUrl,
        status: video.status,
        folderId: video.folderId?.toString() || null,
      },
      summary: summary?.summary || null,
    };
  }

  async deleteVideo(userId: string, videoId: string) {
    const result = await this.db.collection('userVideos').deleteOne({
      _id: new ObjectId(videoId),
      userId: new ObjectId(userId),
    });

    if (result.deletedCount === 0) {
      throw { code: 'NOT_FOUND', status: 404 };
    }
  }
}
```

---

### 4.3 Videos Routes

- [ ] Create `api/src/routes/videos.routes.ts`

```typescript
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { VideoService } from '../services/video.service.js';

const createVideoSchema = z.object({
  url: z.string().url(),
  folderId: z.string().optional(),
});

export async function videosRoutes(fastify: FastifyInstance) {
  const videoService = new VideoService(fastify.mongo.db, fastify.rabbitmq);

  // GET /api/videos
  fastify.get('/', {
    preHandler: [fastify.authenticate],
  }, async (req) => {
    const { folderId } = req.query as { folderId?: string };
    const videos = await videoService.getVideos(req.user.id, folderId);
    return { videos };
  });

  // GET /api/videos/:id
  fastify.get('/:id', {
    preHandler: [fastify.authenticate],
  }, async (req) => {
    const { id } = req.params as { id: string };
    return videoService.getVideo(req.user.id, id);
  });

  // POST /api/videos
  fastify.post('/', {
    preHandler: [fastify.authenticate],
    config: {
      rateLimit: { max: 10, timeWindow: '24 hours' },
    },
  }, async (req, reply) => {
    const input = createVideoSchema.parse(req.body);
    const result = await videoService.createVideo(req.user.id, input.url, input.folderId);
    return reply.code(201).send(result);
  });

  // DELETE /api/videos/:id
  fastify.delete('/:id', {
    preHandler: [fastify.authenticate],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await videoService.deleteVideo(req.user.id, id);
    return reply.code(204).send();
  });
}
```

---

## Phase 5: Folders & Memorize Routes

### 5.1 Folders Routes (Stub)

- [ ] Create `api/src/routes/folders.routes.ts`

```typescript
import { FastifyInstance } from 'fastify';

export async function foldersRoutes(fastify: FastifyInstance) {
  // GET /api/folders
  fastify.get('/', {
    preHandler: [fastify.authenticate],
  }, async (req) => {
    const { type } = req.query as { type?: string };
    // TODO: Implement folder service
    return { folders: [] };
  });

  // POST /api/folders
  fastify.post('/', {
    preHandler: [fastify.authenticate],
  }, async (req, reply) => {
    // TODO: Implement
    return reply.code(201).send({ id: 'stub' });
  });
}
```

---

### 5.2 Memorize Routes (Stub)

- [ ] Create `api/src/routes/memorize.routes.ts`

```typescript
import { FastifyInstance } from 'fastify';

export async function memorizeRoutes(fastify: FastifyInstance) {
  // GET /api/memorize
  fastify.get('/', {
    preHandler: [fastify.authenticate],
  }, async () => {
    // TODO: Implement
    return { items: [] };
  });

  // POST /api/memorize
  fastify.post('/', {
    preHandler: [fastify.authenticate],
  }, async (req, reply) => {
    // TODO: Implement
    return reply.code(201).send({ id: 'stub' });
  });
}
```

---

### 5.3 Explain Routes (Stub)

- [ ] Create `api/src/routes/explain.routes.ts`

```typescript
import { FastifyInstance } from 'fastify';

export async function explainRoutes(fastify: FastifyInstance) {
  // GET /api/explain/:videoSummaryId/:targetType/:targetId
  fastify.get('/:videoSummaryId/:targetType/:targetId', {
    preHandler: [fastify.authenticate],
  }, async (req) => {
    // TODO: Implement MCP call
    return { expansion: '# Coming soon\n\nMCP integration pending.' };
  });

  // POST /api/explain/chat
  fastify.post('/chat', {
    preHandler: [fastify.authenticate],
  }, async (req) => {
    // TODO: Implement MCP call
    return { response: 'Chat coming soon', chatId: 'stub' };
  });
}
```

---

## Phase 6: WebSocket

### 6.1 WebSocket Plugin

- [ ] Create `api/src/plugins/websocket.ts`

```typescript
import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import websocket from '@fastify/websocket';
import { WebSocket } from 'ws';

declare module 'fastify' {
  interface FastifyInstance {
    broadcast: (userId: string, event: object) => void;
  }
}

async function websocketPlugin(fastify: FastifyInstance) {
  const connections = new Map<string, WebSocket>();

  await fastify.register(websocket);

  fastify.get('/ws', { websocket: true }, (socket, req) => {
    const token = (req.query as { token?: string }).token;

    if (!token) {
      socket.close(4001, 'No token');
      return;
    }

    try {
      const payload = fastify.jwt.verify<{ userId: string }>(token);
      connections.set(payload.userId, socket);

      socket.on('close', () => {
        connections.delete(payload.userId);
      });

      socket.send(JSON.stringify({ type: 'connected' }));
    } catch {
      socket.close(4001, 'Invalid token');
    }
  });

  fastify.decorate('broadcast', (userId: string, event: object) => {
    const socket = connections.get(userId);
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(event));
    }
  });
}

export { websocketPlugin };
```

---

## Phase 7: Dockerfile

- [ ] Create `api/Dockerfile`

```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine

WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

EXPOSE 3000

CMD ["node", "dist/index.js"]
```

---

## Verification Checklist

Run these to verify the API track is complete:

```bash
# 1. Start in dev mode
cd api && pnpm dev

# 2. Health check
curl http://localhost:3000/health
# Expected: {"status":"ok","timestamp":"..."}

# 3. Register user
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"Test123!","name":"Test"}'
# Expected: {"accessToken":"...","expiresIn":900,"user":{...}}

# 4. Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"Test123!"}'
# Expected: {"accessToken":"...","expiresIn":900,"user":{...}}

# 5. Submit video (with token from login)
curl -X POST http://localhost:3000/api/videos \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ"}'
# Expected: {"video":{...},"cached":false}

# 6. List videos
curl http://localhost:3000/api/videos \
  -H "Authorization: Bearer YOUR_TOKEN"
# Expected: {"videos":[...]}
```

---

## Integration Points

This track integrates with:

| Service | Integration | Status |
|---------|-------------|--------|
| vie-mongodb | Direct connection | ✅ Phase 2 |
| vie-rabbitmq | Publish jobs | ✅ Phase 4 |
| vie-summarizer | Via RabbitMQ | 🔄 Needs summarizer |
| vie-explainer | Via MCP | 🔄 Needs explainer |
| vie-web | REST + WebSocket | 🔄 Needs web |

---

## Next Steps

After this track:

1. Uncomment `vie-api` in `docker-compose.yml`
2. Run `docker-compose up -d --build vie-api`
3. Wait for [IMPL-03-SUMMARIZER.md](./IMPL-03-SUMMARIZER.md) to test video processing
4. Wait for [IMPL-04-EXPLAINER.md](./IMPL-04-EXPLAINER.md) to test explain features
