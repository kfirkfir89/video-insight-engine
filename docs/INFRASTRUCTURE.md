# Infrastructure

Docker setup, networking, and environment configuration.

---

## Services Overview

| Service        | Image/Build           | Port        | Purpose           |
| -------------- | --------------------- | ----------- | ----------------- |
| vie-web        | ./web                 | 5173        | React frontend    |
| vie-api        | ./api                 | 3000        | Node.js backend   |
| vie-summarizer | ./summarizer          | 8000        | Python worker     |
| vie-explainer  | ./explainer           | 8001        | Python MCP server |
| vie-mongodb    | mongo:7               | 27017       | Database          |
| vie-rabbitmq   | rabbitmq:3-management | 5672, 15672 | Message queue     |

---

## Docker Compose

```yaml
version: "3.8"

services:
  # ═══════════════════════════════════════════════
  # INFRASTRUCTURE
  # ═══════════════════════════════════════════════

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

  # ═══════════════════════════════════════════════
  # APPLICATION SERVICES
  # ═══════════════════════════════════════════════

  vie-api:
    build:
      context: ./api
      dockerfile: Dockerfile
    container_name: vie-api
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: development
      PORT: 3000
      MONGODB_URI: mongodb://vie-mongodb:27017/video-insight-engine
      RABBITMQ_URI: amqp://${RABBITMQ_USER:-guest}:${RABBITMQ_PASS:-guest}@vie-rabbitmq:5672
      JWT_SECRET: ${JWT_SECRET:-dev-secret-change-in-production}
      JWT_EXPIRES_IN: ${JWT_EXPIRES_IN:-7d}
    networks:
      - vie-network
    depends_on:
      vie-mongodb:
        condition: service_healthy
      vie-rabbitmq:
        condition: service_healthy
      vie-explainer:
        condition: service_started

  vie-summarizer:
    build:
      context: ./summarizer
      dockerfile: Dockerfile
    container_name: vie-summarizer
    restart: unless-stopped
    ports:
      - "8000:8000"
    environment:
      PYTHONUNBUFFERED: 1
      MONGODB_URI: mongodb://vie-mongodb:27017/video-insight-engine
      RABBITMQ_URI: amqp://${RABBITMQ_USER:-guest}:${RABBITMQ_PASS:-guest}@vie-rabbitmq:5672
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
      ANTHROPIC_MODEL: ${ANTHROPIC_MODEL:-claude-sonnet-4-20250514}
    networks:
      - vie-network
    depends_on:
      vie-mongodb:
        condition: service_healthy
      vie-rabbitmq:
        condition: service_healthy

  vie-explainer:
    build:
      context: ./explainer
      dockerfile: Dockerfile
    container_name: vie-explainer
    restart: unless-stopped
    ports:
      - "8001:8001"
    environment:
      PYTHONUNBUFFERED: 1
      MONGODB_URI: mongodb://vie-mongodb:27017/video-insight-engine
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
      ANTHROPIC_MODEL: ${ANTHROPIC_MODEL:-claude-sonnet-4-20250514}
    networks:
      - vie-network
    depends_on:
      vie-mongodb:
        condition: service_healthy

  vie-web:
    build:
      context: ./web
      dockerfile: Dockerfile
    container_name: vie-web
    restart: unless-stopped
    ports:
      - "5173:5173"
    environment:
      VITE_API_URL: http://localhost:3000/api
      VITE_WS_URL: ws://localhost:3000/ws
    networks:
      - vie-network
    depends_on:
      - vie-api

networks:
  vie-network:
    driver: bridge

volumes:
  vie_mongodb_data:
  vie_rabbitmq_data:
```

---

## Environment Variables

### .env.example

```bash
# ════════════════════════════════════════════════════
# VIDEO INSIGHT ENGINE
# ════════════════════════════════════════════════════
# Copy to .env and fill in values

# ────────────────────────────────────────────────────
# Anthropic Claude API (REQUIRED)
# ────────────────────────────────────────────────────
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxxx
ANTHROPIC_MODEL=claude-sonnet-4-20250514

# ────────────────────────────────────────────────────
# JWT Authentication
# ────────────────────────────────────────────────────
JWT_SECRET=change-this-to-a-long-random-string
JWT_EXPIRES_IN=7d

# ────────────────────────────────────────────────────
# RabbitMQ (optional - defaults work for dev)
# ────────────────────────────────────────────────────
RABBITMQ_USER=guest
RABBITMQ_PASS=guest

# ────────────────────────────────────────────────────
# Frontend URLs (for production)
# ────────────────────────────────────────────────────
# VITE_API_URL=https://api.yourdomain.com/api
# VITE_WS_URL=wss://api.yourdomain.com/ws
```

---

## Network Topology

```
┌─────────────────────────────────────────────────────────────────┐
│                   vie-network (Docker bridge)                    │
│                                                                  │
│  External Access:                                                │
│  ├── :5173 → vie-web (Frontend)                                 │
│  ├── :3000 → vie-api (API)                                      │
│  └── :15672 → vie-rabbitmq (Management UI - dev only)           │
│                                                                  │
│  Internal Only:                                                  │
│  ├── vie-mongodb:27017                                          │
│  ├── vie-rabbitmq:5672                                          │
│  ├── vie-summarizer:8000                                        │
│  └── vie-explainer:8001                                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Service Dependencies

```
vie-mongodb ─────┬─────────────────────────────────┐
                 │                                 │
                 ▼                                 ▼
vie-rabbitmq ───► vie-api ◄─────────────── vie-explainer
                 │
                 ├──────────► vie-web
                 │
                 ▼
          vie-summarizer
```

Startup order:

1. vie-mongodb, vie-rabbitmq (parallel)
2. vie-explainer (needs MongoDB)
3. vie-api (needs all above)
4. vie-summarizer (needs MongoDB, RabbitMQ)
5. vie-web (needs vie-api)

---

## Commands

### Development

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f vie-api

# Rebuild after changes
docker-compose up -d --build vie-api

# Stop all
docker-compose down

# Stop and remove volumes (fresh start)
docker-compose down -v
```

### Health Checks

```bash
# API
curl http://localhost:3000/health

# Summarizer
curl http://localhost:8000/health

# MongoDB
docker exec vie-mongodb mongosh --eval "db.runCommand('ping')"

# RabbitMQ
curl -u guest:guest http://localhost:15672/api/healthchecks/node
```

---

## MongoDB Setup

Collections are created automatically. To set up indexes:

```javascript
// Connect to MongoDB
mongosh "mongodb://localhost:27017/video-insight-engine"

// System cache indexes
db.videoSummaryCache.createIndex({ youtubeId: 1 }, { unique: true })
db.videoSummaryCache.createIndex({ status: 1 })

db.systemExpansionCache.createIndex(
  { videoSummaryId: 1, targetType: 1, targetId: 1 },
  { unique: true }
)

// User data indexes
db.users.createIndex({ email: 1 }, { unique: true })

db.folders.createIndex({ userId: 1, type: 1, path: 1 })
db.folders.createIndex({ userId: 1, parentId: 1 })

db.userVideos.createIndex({ userId: 1, videoSummaryId: 1 }, { unique: true })
db.userVideos.createIndex({ userId: 1, folderId: 1 })

db.memorizedItems.createIndex({ userId: 1, folderId: 1 })
db.memorizedItems.createIndex({ userId: 1, "source.videoSummaryId": 1 })

db.userChats.createIndex({ userId: 1, memorizedItemId: 1 })
```

---

## RabbitMQ Setup

Queues and exchanges are created by services on startup:

```javascript
// Queues
summarize.jobs; // Durable, for video processing

// Exchanges
job.status; // Fanout, for status updates
```

Access management UI: http://localhost:15672 (guest/guest)

---

## Production Considerations

### Security

- Change JWT_SECRET to a strong random string
- Use environment-specific RabbitMQ credentials
- Don't expose MongoDB/RabbitMQ ports externally
- Use HTTPS for vie-api and vie-web

### Scaling

- vie-summarizer: Can run multiple instances (competing consumers)
- vie-api: Can run multiple instances (add load balancer)
- vie-explainer: One instance per vie-api (MCP connection)

### Monitoring

- Add health check endpoints to all services
- Set up log aggregation
- Monitor RabbitMQ queue depths
- Track LLM API usage and costs
