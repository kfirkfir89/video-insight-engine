# Service: vie-api

Node.js backend service. REST API + MCP client + WebSocket.

---

## Tech Stack

| Technology                | Purpose           |
| ------------------------- | ----------------- |
| Node.js 20                | Runtime           |
| Fastify 4                 | Web framework     |
| TypeScript                | Language          |
| Zod                       | Validation        |
| @fastify/jwt              | Authentication    |
| @fastify/websocket        | Real-time updates |
| mongodb                   | Database driver   |
| @modelcontextprotocol/sdk | MCP client        |
| Vitest                    | Testing           |

---

## Project Structure

```
api/
├── Dockerfile
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts                  # Entry point
    ├── app.ts                    # App builder with DI
    ├── config.ts                 # Environment config
    ├── container.ts              # Dependency injection container
    │
    ├── plugins/
    │   ├── mongodb.ts            # Database connection
    │   ├── jwt.ts                # Authentication
    │   ├── cors.ts               # CORS configuration
    │   ├── websocket.ts          # Real-time updates
    │   └── mcp.ts                # MCP client to explainer
    │
    ├── repositories/
    │   ├── video.repository.ts   # Video data access
    │   ├── memorize.repository.ts # Memorize data access
    │   └── share.repository.ts   # Share data access (v1.4)
    │
    ├── routes/
    │   ├── auth.routes.ts
    │   ├── folders.routes.ts
    │   ├── videos.routes.ts
    │   ├── playlists.routes.ts
    │   ├── memorize.routes.ts
    │   ├── explain.routes.ts
    │   ├── stream.routes.ts      # SSE proxy to summarizer
    │   ├── share.routes.ts       # Share creation + public access (v1.4)
    │   ├── ssr.routes.ts         # /s/:slug server-rendered share pages (v1.4)
    │   ├── override.routes.ts    # Category override (v1.4)
    │   └── payment.routes.ts     # Paddle webhooks + checkout (v1.4)
    │
    ├── schemas/
    │   ├── video.schema.ts       # Video validation schemas
    │   ├── share.schema.ts       # Share validation schemas (v1.4)
    │   └── payment.schema.ts     # Payment validation schemas (v1.4)
    │
    ├── services/
    │   ├── auth.service.ts
    │   ├── folder.service.ts
    │   ├── video.service.ts      # + expiration logic (v1.4)
    │   ├── playlist.service.ts
    │   ├── memorize.service.ts
    │   ├── summarizer-client.ts  # HTTP client for summarizer
    │   ├── explainer-client.ts   # HTTP client for explainer
    │   ├── share.service.ts      # Share creation, public access (v1.4)
    │   ├── og-image.service.ts   # OG image generation (v1.4)
    │   ├── payment.service.ts    # Paddle webhook + checkout (v1.4)
    │   └── cost-monitor.service.ts # Daily LLM spend monitoring (v1.4)
    │
    ├── plugins/
    │   ├── mongodb.ts            # Database connection + indexes
    │   ├── jwt.ts                # Authentication
    │   ├── cors.ts               # CORS configuration
    │   ├── websocket.ts          # Real-time updates
    │   ├── mcp.ts                # MCP client to explainer
    │   ├── rate-limit.ts         # Rate limiting (+ tier-aware, v1.4)
    │   └── tier.ts               # Tier decoration per request (v1.4)
    │
    ├── templates/
    │   └── share-page.ts         # HTML template for /s/:slug (v1.4)
    │
    ├── utils/
    │   ├── errors.ts             # Custom error classes (+ 8 new, v1.4)
    │   └── cors.ts               # CORS utilities
    │
    └── test/
        ├── setup.ts              # Test setup
        └── helpers.ts            # Test utilities & mocks
```

---

## Architecture Patterns

### Dependency Injection Container

All services and repositories are created in a central container and injected into the Fastify instance:

```typescript
// src/container.ts
export interface Container {
  videoRepository: VideoRepository;
  memorizeRepository: MemorizeRepository;
  shareRepository: ShareRepository;      // v1.4
  videoService: VideoService;
  folderService: FolderService;
  authService: AuthService;
  memorizeService: MemorizeService;
  playlistService: PlaylistService;
  explainerClient: ExplainerClient;
  summarizerClient: SummarizerClient;
  shareService: ShareService;            // v1.4
  ogImageService: OgImageService;        // v1.4
  paymentService: PaymentService;        // v1.4
  costMonitorService: CostMonitorService; // v1.4
}

export function createContainer(db: Db): Container {
  const videoRepository = new VideoRepository(db);
  const memorizeRepository = new MemorizeRepository(db);
  // ... create all dependencies
  return { videoRepository, memorizeRepository, ... };
}
```

### App Builder Pattern

The app is built via `buildApp()` which allows dependency overrides for testing:

```typescript
// src/app.ts
export async function buildApp(options?: {
  logger?: boolean;
  container?: Partial<Container>;
}): Promise<FastifyInstance> {
  const fastify = Fastify({ logger: options?.logger ?? true });

  // Register plugins
  await fastify.register(corsSetup);
  await fastify.register(mongodbPlugin);
  await fastify.register(jwtPlugin);

  // Create container with optional overrides
  const container = {
    ...createContainer(fastify.db),
    ...options?.container,
  };

  fastify.decorate('container', container);

  // Register routes
  await fastify.register(authRoutes, { prefix: '/api/auth' });
  await fastify.register(videosRoutes, { prefix: '/api/videos' });
  // ...

  return fastify;
}
```

### Repository Pattern

Data access is abstracted into repository classes:

```typescript
// src/repositories/video.repository.ts
export class VideoRepository {
  constructor(private readonly db: Db) {}

  async userHasAccessToSummary(userId: string, videoSummaryId: string): Promise<boolean> {
    const video = await this.userVideosCollection.findOne({
      userId: new ObjectId(userId),
      videoSummaryId: new ObjectId(videoSummaryId),
    });
    return !!video;
  }

  async userOwnsVideo(userId: string, youtubeId: string): Promise<boolean> {
    const video = await this.userVideosCollection.findOne({
      userId: new ObjectId(userId),
      youtubeId,
    });
    return !!video;
  }
}
```

---

## Error Handling

Custom error classes for typed error responses:

```typescript
// src/utils/errors.ts
export class AppError extends Error {
  constructor(
    public readonly code: string,
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
  }
}

export class VideoNotFoundError extends AppError {
  constructor() {
    super('VIDEO_NOT_FOUND', 404, 'Video not found');
  }
}

export class MemorizedItemNotFoundError extends AppError {
  constructor() {
    super('MEMORIZED_ITEM_NOT_FOUND', 404, 'Memorized item not found');
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super('UNAUTHORIZED', 401, message);
  }
}
```

---

## Authorization

All protected routes verify resource ownership before operations:

```typescript
// src/routes/explain.routes.ts
export async function explainRoutes(fastify: FastifyInstance) {
  const { explainerClient, videoRepository, memorizeRepository } = fastify.container;

  fastify.get('/:videoSummaryId/:targetType/:targetId', {
    preHandler: [fastify.authenticate],
  }, async (req, reply) => {
    const { videoSummaryId, targetType, targetId } = req.params;

    // Authorization check - verify user has access
    const hasAccess = await videoRepository.userHasAccessToSummary(
      req.user.userId,
      videoSummaryId
    );
    if (!hasAccess) {
      throw new VideoNotFoundError();
    }

    const result = await explainerClient.explainAuto(videoSummaryId, targetType, targetId);
    return result;
  });

  fastify.post('/chat', {
    preHandler: [fastify.authenticate],
  }, async (req, reply) => {
    const userId = req.user.userId;

    // Authorization check - verify user owns memorized item
    const item = await memorizeRepository.findById(userId, req.body.memorizedItemId);
    if (!item) {
      throw new MemorizedItemNotFoundError();
    }

    const result = await explainerClient.explainChat({
      ...req.body,
      userId,
    });
    return result;
  });
}
```

---

## Input Validation

All request input is validated with Zod schemas with appropriate limits:

```typescript
// src/routes/explain.routes.ts
const explainChatBodySchema = z.object({
  memorizedItemId: z.string().min(1),
  message: z.string().min(1).max(10000),  // Max length to prevent abuse
  chatId: z.string().optional(),
});

// In route handler
const parsed = explainChatBodySchema.safeParse(req.body);
if (!parsed.success) {
  return reply.status(400).send({
    error: 'Bad Request',
    message: parsed.error.errors[0]?.message || 'Invalid request body',
  });
}
```

---

## Testing

### Test Setup

Tests use Vitest with MongoDB Memory Server for isolation:

```typescript
// src/test/helpers.ts
export interface MockContainer {
  videoRepository: {
    userHasAccessToSummary: ReturnType<typeof vi.fn>;
    userOwnsVideo: ReturnType<typeof vi.fn>;
  };
  memorizeRepository: {
    findById: ReturnType<typeof vi.fn>;
  };
  // ... other mocked services
}

export function createMockContainer(): MockContainer {
  return {
    videoRepository: {
      userHasAccessToSummary: vi.fn().mockResolvedValue(true),
      userOwnsVideo: vi.fn().mockResolvedValue(true),
    },
    memorizeRepository: {
      findById: vi.fn().mockResolvedValue({ id: 'item123', userId: 'test-user-id' }),
    },
    // ...
  };
}

export async function buildTestApp(mockContainer?: Partial<MockContainer>): Promise<FastifyInstance> {
  return buildApp({
    logger: false,
    container: mockContainer as Partial<Container>,
  });
}
```

### Route Testing Pattern

```typescript
// src/routes/explain.routes.test.ts
describe('explain routes', () => {
  let app: FastifyInstance;
  let mockContainer: MockContainer;
  let authHeader: string;

  beforeAll(async () => {
    mockContainer = createMockContainer();
    app = await buildTestApp(mockContainer);
    await app.ready();
    authHeader = await getAuthHeader(app);
  });

  it('should return 404 when user does not have access to video', async () => {
    mockContainer.videoRepository.userHasAccessToSummary.mockResolvedValue(false);

    const response = await app.inject({
      method: 'GET',
      url: '/api/explain/video123/section/section456',
      headers: { authorization: authHeader },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toHaveProperty('error', 'VIDEO_NOT_FOUND');
  });
});
```

---

## Environment Variables

```bash
PORT=3000
MONGODB_URI=mongodb://vie-mongodb:27017/video-insight-engine
SUMMARIZER_URL=http://vie-summarizer:8000
EXPLAINER_URL=http://vie-explainer:8001
JWT_SECRET=your-secret-here
JWT_REFRESH_SECRET=your-refresh-secret-here
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
FRONTEND_URL=http://localhost:5173
CORS_ADDITIONAL_ORIGINS=
INTERNAL_SECRET=dev-internal-secret-change-me

# Payment (Paddle) — v1.4
PADDLE_WEBHOOK_SECRET=
PADDLE_PRO_PRICE_ID=
PADDLE_TEAM_PRICE_ID=

# Cost monitoring — v1.4
COST_DAILY_LIMIT=50
```

---

## Commands

```bash
# Development
npm run dev

# Build
npm run build

# Start
npm start

# Test
npm test

# Type check
npm run typecheck

# Lint
npm run lint
```

---

## Dockerfile

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["node", "dist/index.js"]
```
