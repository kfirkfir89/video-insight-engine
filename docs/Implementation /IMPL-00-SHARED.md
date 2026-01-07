# Implementation Phase 0: Shared Infrastructure

> **Run this FIRST before starting any parallel tracks.**
> All other implementation tracks depend on this phase being complete.

---

## Prerequisites

- Docker & Docker Compose installed
- Node.js 20+ installed
- Python 3.11+ installed
- pnpm installed (`npm install -g pnpm`)

---

## Checklist

### 0.1 Project Structure

- [ ] Create root directories

```bash
mkdir -p video-insight-engine/{api,apps/web,workers/summarizer,workers/explainer}
mkdir -p video-insight-engine/{packages/types,packages/utils}
mkdir -p video-insight-engine/{docs,dev/active,scripts}
mkdir -p video-insight-engine/.claude/{skills,agents,commands,hooks}
```

- [ ] Initialize git

```bash
cd video-insight-engine
git init
echo "node_modules/\n.env\n*.log\ndist/\n__pycache__/\n.venv/" > .gitignore
```

---

### 0.2 Environment Configuration

- [ ] Create `.env.example`

```bash
# ═══════════════════════════════════════════════════
# VIDEO INSIGHT ENGINE - Environment Variables
# ═══════════════════════════════════════════════════

# Anthropic (REQUIRED)
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxxx
ANTHROPIC_MODEL=claude-sonnet-4-20250514

# JWT Authentication
JWT_SECRET=change-this-to-64-char-random-string
JWT_REFRESH_SECRET=change-this-to-another-64-char-string
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Server
PORT=3000
NODE_ENV=development

# MongoDB
MONGODB_URI=mongodb://vie-mongodb:27017/video-insight-engine

# RabbitMQ
RABBITMQ_URI=amqp://guest:guest@vie-rabbitmq:5672
RABBITMQ_USER=guest
RABBITMQ_PASS=guest

# Frontend
VITE_API_URL=http://localhost:3000/api
VITE_WS_URL=ws://localhost:3000/ws
```

- [ ] Copy to `.env` and add real `ANTHROPIC_API_KEY`

```bash
cp .env.example .env
# Edit .env and add your API key
```

---

### 0.3 Docker Compose

- [ ] Create `docker-compose.yml`

```yaml
version: "3.8"

services:
  # ═══════════════════════════════════════════════════
  # INFRASTRUCTURE
  # ═══════════════════════════════════════════════════

  vie-mongodb:
    image: mongo:7
    container_name: vie-mongodb
    restart: unless-stopped
    ports:
      - "27017:27017"
    volumes:
      - vie_mongodb_data:/data/db
    environment:
      MONGO_INITDB_DATABASE: video-insight-engine
    networks:
      - vie-network
    healthcheck:
      test: echo 'db.runCommand("ping").ok' | mongosh localhost:27017/test --quiet
      interval: 10s
      timeout: 5s
      retries: 5

  vie-rabbitmq:
    image: rabbitmq:3-management
    container_name: vie-rabbitmq
    restart: unless-stopped
    ports:
      - "5672:5672"
      - "15672:15672"
    volumes:
      - vie_rabbitmq_data:/var/lib/rabbitmq
    environment:
      RABBITMQ_DEFAULT_USER: ${RABBITMQ_USER:-guest}
      RABBITMQ_DEFAULT_PASS: ${RABBITMQ_PASS:-guest}
    networks:
      - vie-network
    healthcheck:
      test: rabbitmq-diagnostics -q ping
      interval: 10s
      timeout: 5s
      retries: 5

  # ═══════════════════════════════════════════════════
  # APPLICATION SERVICES (uncomment as implemented)
  # ═══════════════════════════════════════════════════

  # vie-api:
  #   build: ./api
  #   container_name: vie-api
  #   ports:
  #     - "3000:3000"
  #   env_file: .env
  #   networks:
  #     - vie-network
  #   depends_on:
  #     vie-mongodb:
  #       condition: service_healthy
  #     vie-rabbitmq:
  #       condition: service_healthy

  # vie-web:
  #   build: ./apps/web
  #   container_name: vie-web
  #   ports:
  #     - "5173:5173"
  #   env_file: .env
  #   networks:
  #     - vie-network

  # vie-summarizer:
  #   build: ./workers/summarizer
  #   container_name: vie-summarizer
  #   ports:
  #     - "8000:8000"
  #   env_file: .env
  #   networks:
  #     - vie-network
  #   depends_on:
  #     vie-mongodb:
  #       condition: service_healthy
  #     vie-rabbitmq:
  #       condition: service_healthy

  # vie-explainer:
  #   build: ./workers/explainer
  #   container_name: vie-explainer
  #   ports:
  #     - "8001:8001"
  #   env_file: .env
  #   networks:
  #     - vie-network
  #   depends_on:
  #     vie-mongodb:
  #       condition: service_healthy

networks:
  vie-network:
    driver: bridge

volumes:
  vie_mongodb_data:
  vie_rabbitmq_data:
```

---

### 0.4 Shared Types Package

- [ ] Initialize `packages/types`

```bash
cd packages/types
pnpm init
```

- [ ] Create `packages/types/package.json`

```json
{
  "name": "@vie/types",
  "version": "0.1.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "devDependencies": {
    "typescript": "^5.3.0"
  }
}
```

- [ ] Create `packages/types/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "declaration": true,
    "outDir": "dist",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

- [ ] Create `packages/types/src/index.ts`

```typescript
// ═══════════════════════════════════════════════════
// VIDEO INSIGHT ENGINE - Shared Types
// ═══════════════════════════════════════════════════

// ─────────────────────────────────────────────────────
// Status Types
// ─────────────────────────────────────────────────────

export type ProcessingStatus = 
  | 'pending' 
  | 'processing' 
  | 'completed' 
  | 'failed';

export type FolderType = 'summarized' | 'memorized';

export type SourceType = 
  | 'video_section' 
  | 'video_concept' 
  | 'system_expansion';

export type TargetType = 'section' | 'concept';

// ─────────────────────────────────────────────────────
// Video Summary Types
// ─────────────────────────────────────────────────────

export interface Section {
  id: string;
  timestamp: string;
  startSeconds: number;
  endSeconds: number;
  title: string;
  summary: string;
  bullets: string[];
}

export interface Concept {
  id: string;
  name: string;
  definition: string | null;
  timestamp: string | null;
}

export interface VideoSummary {
  tldr: string;
  keyTakeaways: string[];
  sections: Section[];
  concepts: Concept[];
}

// ─────────────────────────────────────────────────────
// API Response Types
// ─────────────────────────────────────────────────────

export interface AuthResponse {
  accessToken: string;
  expiresIn: number;
  user: {
    id: string;
    email: string;
    name: string;
  };
}

export interface VideoResponse {
  id: string;
  videoSummaryId: string;
  youtubeId: string;
  title: string;
  channel: string | null;
  duration: number | null;
  thumbnailUrl: string | null;
  status: ProcessingStatus;
  folderId: string | null;
  createdAt: string;
}

export interface FolderResponse {
  id: string;
  name: string;
  type: FolderType;
  parentId: string | null;
  path: string;
  level: number;
  color: string | null;
  icon: string | null;
}

// ─────────────────────────────────────────────────────
// WebSocket Event Types
// ─────────────────────────────────────────────────────

export interface VideoStatusEvent {
  type: 'video.status';
  payload: {
    videoSummaryId: string;
    userVideoId: string;
    youtubeId: string;
    status: ProcessingStatus;
    progress: number;
    message?: string;
    error?: string;
  };
}

export interface ExpansionStatusEvent {
  type: 'expansion.status';
  payload: {
    videoSummaryId: string;
    targetType: TargetType;
    targetId: string;
    status: ProcessingStatus;
    error?: string;
  };
}

export type WebSocketEvent = VideoStatusEvent | ExpansionStatusEvent;

// ─────────────────────────────────────────────────────
// Error Types
// ─────────────────────────────────────────────────────

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}

export const ErrorCodes = {
  // Auth
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  EMAIL_EXISTS: 'EMAIL_EXISTS',
  REFRESH_EXPIRED: 'REFRESH_EXPIRED',
  
  // Video
  INVALID_YOUTUBE_URL: 'INVALID_YOUTUBE_URL',
  VIDEO_NOT_FOUND: 'VIDEO_NOT_FOUND',
  NO_TRANSCRIPT: 'NO_TRANSCRIPT',
  VIDEO_TOO_LONG: 'VIDEO_TOO_LONG',
  VIDEO_TOO_SHORT: 'VIDEO_TOO_SHORT',
  VIDEO_UNAVAILABLE: 'VIDEO_UNAVAILABLE',
  
  // General
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;
```

---

### 0.5 MongoDB Indexes Script

- [ ] Create `scripts/setup-mongo.js`

```javascript
// Run with: mongosh mongodb://localhost:27017/video-insight-engine scripts/setup-mongo.js

// System Cache
db.videoSummaryCache.createIndex({ youtubeId: 1 }, { unique: true });
db.videoSummaryCache.createIndex({ status: 1 });

db.systemExpansionCache.createIndex(
  { videoSummaryId: 1, targetType: 1, targetId: 1 },
  { unique: true }
);
db.systemExpansionCache.createIndex({ status: 1 });

// User Data
db.users.createIndex({ email: 1 }, { unique: true });

db.folders.createIndex({ userId: 1, type: 1, path: 1 });
db.folders.createIndex({ userId: 1, parentId: 1 });

db.userVideos.createIndex({ userId: 1, videoSummaryId: 1 }, { unique: true });
db.userVideos.createIndex({ userId: 1, folderId: 1 });
db.userVideos.createIndex({ userId: 1, createdAt: -1 });

db.memorizedItems.createIndex({ userId: 1, folderId: 1 });
db.memorizedItems.createIndex({ userId: 1, 'source.videoSummaryId': 1 });
db.memorizedItems.createIndex({ userId: 1, tags: 1 });
db.memorizedItems.createIndex({ userId: 1, createdAt: -1 });

db.userChats.createIndex({ userId: 1, memorizedItemId: 1 });
db.userChats.createIndex({ userId: 1, updatedAt: -1 });

print('✅ All indexes created');
```

---

### 0.6 Start Infrastructure

- [ ] Start MongoDB and RabbitMQ

```bash
docker-compose up -d vie-mongodb vie-rabbitmq
```

- [ ] Verify health

```bash
# Wait for services
sleep 10

# Check MongoDB
docker exec vie-mongodb mongosh --eval "db.runCommand('ping')"

# Check RabbitMQ
curl -u guest:guest http://localhost:15672/api/healthchecks/node
```

- [ ] Run MongoDB setup

```bash
docker exec -i vie-mongodb mongosh video-insight-engine < scripts/setup-mongo.js
```

---

### 0.7 Root Package.json (Monorepo)

- [ ] Create root `package.json`

```json
{
  "name": "video-insight-engine",
  "private": true,
  "scripts": {
    "dev": "docker-compose up -d && concurrently \"pnpm --filter @vie/api dev\" \"pnpm --filter @vie/web dev\"",
    "build": "pnpm -r build",
    "docker:up": "docker-compose up -d",
    "docker:down": "docker-compose down",
    "docker:logs": "docker-compose logs -f",
    "types:build": "pnpm --filter @vie/types build"
  },
  "devDependencies": {
    "concurrently": "^8.2.0"
  }
}
```

- [ ] Create `pnpm-workspace.yaml`

```yaml
packages:
  - 'packages/*'
  - 'api'
  - 'apps/*'
```

---

## Verification

Run these commands to verify Phase 0 is complete:

```bash
# 1. Docker services running
docker-compose ps
# Expected: vie-mongodb and vie-rabbitmq both "Up (healthy)"

# 2. MongoDB accessible
docker exec vie-mongodb mongosh --eval "db.videoSummaryCache.getIndexes()"
# Expected: Shows youtubeId index

# 3. RabbitMQ UI accessible
curl -s -o /dev/null -w "%{http_code}" http://guest:guest@localhost:15672/api/overview
# Expected: 200

# 4. Types package builds
cd packages/types && pnpm build
# Expected: dist/ folder created with .js and .d.ts files
```

---

## Next Steps

Once all verification passes, proceed to **parallel tracks**:

| Track | File | Can Start After |
|-------|------|-----------------|
| API | [IMPL-01-API.md](./IMPL-01-API.md) | Phase 0 complete |
| Web | [IMPL-02-WEB.md](./IMPL-02-WEB.md) | Phase 0 complete |
| Summarizer | [IMPL-03-SUMMARIZER.md](./IMPL-03-SUMMARIZER.md) | Phase 0 complete |
| Explainer | [IMPL-04-EXPLAINER.md](./IMPL-04-EXPLAINER.md) | Phase 0 complete |

**All tracks can run in parallel!**

Integration testing: [IMPL-05-INTEGRATION.md](./IMPL-05-INTEGRATION.md)
