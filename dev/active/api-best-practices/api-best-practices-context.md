# API Best Practices Refactor - Context

**Last Updated:** 2026-02-01

---

## Key Files to Modify

### Core Bootstrap (Phase 1-2)
| File | Current | Change |
|------|---------|--------|
| `api/src/index.ts` | All-in-one | Simplify to import server.ts |
| `api/src/app.ts` | N/A | NEW - buildApp() function |
| `api/src/server.ts` | N/A | NEW - Server startup + process handlers |
| `api/src/container.ts` | N/A | NEW - DI container |
| `api/src/plugins/helmet.ts` | N/A | NEW - Security headers |
| `api/src/plugins/mongodb.ts` | Connection only | Add index creation |

### Repositories (Phase 3)
| File | Creates |
|------|---------|
| `api/src/repositories/video.repository.ts` | VideoRepository class |
| `api/src/repositories/folder.repository.ts` | FolderRepository class |
| `api/src/repositories/memorize.repository.ts` | MemorizeRepository class |
| `api/src/repositories/user.repository.ts` | UserRepository class |
| `api/src/repositories/index.ts` | Export all |

### Services to Refactor (Phase 3)
| File | Change |
|------|--------|
| `api/src/services/video.service.ts` | Use VideoRepository, inject logger |
| `api/src/services/folder.service.ts` | Convert to class, use FolderRepository |
| `api/src/services/memorize.service.ts` | Use MemorizeRepository |
| `api/src/services/playlist.service.ts` | Inject VideoService |
| `api/src/services/summarizer-client.ts` | Fix exponential backoff, inject logger |

### Routes to Update (Phase 2)
| File | Change |
|------|--------|
| `api/src/routes/videos.routes.ts` | Use `fastify.container.videoService` |
| `api/src/routes/folders.routes.ts` | Use `fastify.container.folderService` |
| `api/src/routes/memorize.routes.ts` | Use `fastify.container.memorizeService` |
| `api/src/routes/playlists.routes.ts` | Use container, add rate limit |
| `api/src/routes/auth.routes.ts` | Use `fastify.container.authService` |

### Tests (Phase 4)
| File | Purpose |
|------|---------|
| `api/src/__tests__/setup.ts` | Test configuration, MongoDB memory server |
| `api/src/__tests__/factories/*.ts` | Test data factories |
| `api/src/__tests__/routes/*.test.ts` | Route integration tests |
| `api/src/__tests__/services/*.test.ts` | Service unit tests |

---

## Code Patterns

### buildApp Pattern (fastify.md)
```typescript
// app.ts
export async function buildApp(options?: BuildAppOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options?.logger ?? {
      level: config.LOG_LEVEL,
      transport: isDev ? { target: 'pino-pretty' } : undefined,
    },
  });

  // Plugins
  await app.register(helmet);
  await app.register(cors, corsOptions);
  await app.register(rateLimit);
  await app.register(mongodb);
  await app.register(jwt);

  // Container (DI)
  const container = createContainer(app.mongo.db, app.log);
  app.decorate('container', container);

  // Routes
  await app.register(routes);

  return app;
}
```

### Container Pattern (services.md)
```typescript
// container.ts
export interface Container {
  // Repositories
  videoRepository: VideoRepository;
  folderRepository: FolderRepository;
  memorizeRepository: MemorizeRepository;
  userRepository: UserRepository;

  // Services
  authService: AuthService;
  videoService: VideoService;
  folderService: FolderService;
  memorizeService: MemorizeService;
  playlistService: PlaylistService;
  summarizerClient: SummarizerClient;
  explainerClient: ExplainerClient;
}

export function createContainer(db: Db, logger: FastifyBaseLogger): Container {
  // Repositories
  const videoRepository = new VideoRepository(db);
  const folderRepository = new FolderRepository(db);
  const memorizeRepository = new MemorizeRepository(db);
  const userRepository = new UserRepository(db);

  // Services (inject dependencies)
  const authService = new AuthService(userRepository, logger);
  const videoService = new VideoService(videoRepository, logger);
  const folderService = new FolderService(folderRepository, logger);
  const memorizeService = new MemorizeService(memorizeRepository, videoRepository, logger);
  const summarizerClient = new SummarizerClient(logger);
  const explainerClient = new ExplainerClient(logger);
  const playlistService = new PlaylistService(videoService, folderService, summarizerClient, logger);

  return {
    videoRepository,
    folderRepository,
    memorizeRepository,
    userRepository,
    authService,
    videoService,
    folderService,
    memorizeService,
    playlistService,
    summarizerClient,
    explainerClient,
  };
}
```

### Repository Pattern (services.md)
```typescript
// repositories/video.repository.ts
export class VideoRepository {
  private readonly collection: Collection<VideoSummaryCacheDocument>;
  private readonly userVideosCollection: Collection<UserVideoDocument>;

  constructor(db: Db) {
    this.collection = db.collection('videoSummaryCache');
    this.userVideosCollection = db.collection('userVideos');
  }

  async findById(id: string): Promise<VideoSummary | null> {
    const doc = await this.collection.findOne({ _id: new ObjectId(id) });
    return doc ? this.toEntity(doc) : null;
  }

  async findByYoutubeId(youtubeId: string): Promise<VideoSummary | null> {
    const doc = await this.collection.findOne({ youtubeId });
    return doc ? this.toEntity(doc) : null;
  }

  async create(data: CreateVideoData): Promise<VideoSummary> {
    const doc = { ...data, createdAt: new Date(), updatedAt: new Date() };
    const result = await this.collection.insertOne(doc);
    return this.toEntity({ ...doc, _id: result.insertedId });
  }

  // Convert DB document to domain entity
  private toEntity(doc: VideoSummaryCacheDocument): VideoSummary {
    return {
      id: doc._id.toString(),
      youtubeId: doc.youtubeId,
      title: doc.title,
      status: doc.status,
      summary: doc.summary,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }
}
```

### Process Handlers (errors.md)
```typescript
// server.ts
export async function startServer(): Promise<void> {
  const app = await buildApp();

  // Process handlers
  process.on('unhandledRejection', (reason, promise) => {
    app.log.error({ reason, promise }, 'Unhandled Rejection');
  });

  process.on('uncaughtException', (error) => {
    app.log.error(error, 'Uncaught Exception');
    process.exit(1);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    app.log.info(`${signal} received, shutting down gracefully`);
    await app.close();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // Start
  await app.listen({ port: config.PORT, host: '0.0.0.0' });
  app.log.info(`Server running on port ${config.PORT}`);
}
```

### MongoDB Indexes (mongodb.md)
```typescript
// plugins/mongodb.ts - Add after connection
app.addHook('onReady', async () => {
  const db = app.mongo.db;

  // videoSummaryCache
  await db.collection('videoSummaryCache').createIndexes([
    { key: { youtubeId: 1 }, unique: true },
    { key: { status: 1 } },
  ]);

  // userVideos
  await db.collection('userVideos').createIndexes([
    { key: { userId: 1, videoSummaryId: 1 }, unique: true },
    { key: { userId: 1, folderId: 1 } },
    { key: { userId: 1, createdAt: -1 } },
  ]);

  // folders
  await db.collection('folders').createIndexes([
    { key: { userId: 1, type: 1, path: 1 } },
    { key: { userId: 1, parentId: 1 } },
  ]);

  // memorizedItems
  await db.collection('memorizedItems').createIndexes([
    { key: { userId: 1, folderId: 1 } },
    { key: { userId: 1, 'source.videoSummaryId': 1 } },
    { key: { userId: 1, createdAt: -1 } },
  ]);

  app.log.info('MongoDB indexes created');
});
```

### Helmet Configuration (security.md)
```typescript
// plugins/helmet.ts
import helmet from '@fastify/helmet';
import fp from 'fastify-plugin';

export const helmetPlugin = fp(async (app) => {
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", config.FRONTEND_URL],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
    },
  });
});
```

---

## Dependencies

### New Dev Dependencies
```bash
npm install -D vitest @vitest/coverage-v8 mongodb-memory-server
```

### Fastify Type Augmentation
```typescript
// types/fastify.d.ts
import { Container } from '../container';

declare module 'fastify' {
  interface FastifyInstance {
    container: Container;
  }
}
```

---

## Key Decisions

### Why Repository Pattern?
1. **Testability**: Mock repositories in service tests
2. **Single Responsibility**: Services do business logic, repos do data access
3. **Schema Independence**: Change DB schema without touching services
4. **Reusability**: Same repo methods used across services

### Why DI Container?
1. **No new instances per request**: Services are singletons
2. **Easy testing**: Swap implementations for mocks
3. **Explicit dependencies**: Clear what each service needs
4. **Centralized wiring**: One place to see all dependencies

### Why buildApp()?
1. **Testability**: Test routes with `app.inject()` without starting server
2. **Separation**: App config separate from server lifecycle
3. **Reusability**: Same app for tests, dev, production

---

## Testing Strategy

### Test Types
| Type | Coverage | Tools |
|------|----------|-------|
| Unit (Services) | 90% | Vitest, mocked repos |
| Integration (Routes) | 80% | Vitest, app.inject(), memory MongoDB |
| E2E | Critical paths | Playwright (existing) |

### Test File Structure
```
api/src/__tests__/
├── setup.ts                # Global setup, memory MongoDB
├── factories/
│   ├── user.factory.ts     # createUser(), createUserInput()
│   ├── video.factory.ts    # createVideo(), createVideoInput()
│   └── folder.factory.ts   # createFolder()
├── routes/
│   ├── auth.routes.test.ts
│   ├── videos.routes.test.ts
│   └── folders.routes.test.ts
└── services/
    ├── video.service.test.ts
    └── folder.service.test.ts
```

---

## Migration Notes

### Breaking Changes
- None expected (internal refactor only)

### Backwards Compatibility
- All API endpoints unchanged
- All request/response formats unchanged
- Only internal architecture changes

### Rollback Plan
1. Revert to previous commit
2. No database changes to undo
