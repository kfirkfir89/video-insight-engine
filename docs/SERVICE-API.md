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
| amqplib                   | RabbitMQ client   |
| @modelcontextprotocol/sdk | MCP client        |

---

## Project Structure

```
api/
├── Dockerfile
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts                  # Entry point
    ├── config.ts                 # Environment config
    │
    ├── plugins/
    │   ├── mongodb.ts            # Database connection
    │   ├── rabbitmq.ts           # Queue connection
    │   ├── jwt.ts                # Authentication
    │   ├── websocket.ts          # Real-time updates
    │   └── mcp.ts                # MCP client to explainer
    │
    ├── routes/
    │   ├── auth.routes.ts
    │   ├── folders.routes.ts
    │   ├── videos.routes.ts
    │   ├── memorize.routes.ts
    │   └── explain.routes.ts
    │
    ├── services/
    │   ├── auth.service.ts
    │   ├── folder.service.ts
    │   ├── video.service.ts
    │   ├── memorize.service.ts
    │   └── cache.service.ts
    │
    ├── schemas/
    │   ├── auth.schema.ts
    │   ├── folder.schema.ts
    │   ├── video.schema.ts
    │   └── memorize.schema.ts
    │
    └── types/
        └── index.ts
```

---

## Environment Variables

```bash
PORT=3000
MONGODB_URI=mongodb://vie-mongodb:27017/video-insight-engine
RABBITMQ_URI=amqp://guest:guest@vie-rabbitmq:5672
JWT_SECRET=your-secret-here
JWT_EXPIRES_IN=7d
```

---

## Key Implementations

### Entry Point

```typescript
// src/index.ts
import Fastify from "fastify";
import { config } from "./config";
import { mongodbPlugin } from "./plugins/mongodb";
import { rabbitmqPlugin } from "./plugins/rabbitmq";
import { jwtPlugin } from "./plugins/jwt";
import { websocketPlugin } from "./plugins/websocket";
import { mcpPlugin } from "./plugins/mcp";
import { authRoutes } from "./routes/auth.routes";
import { foldersRoutes } from "./routes/folders.routes";
import { videosRoutes } from "./routes/videos.routes";
import { memorizeRoutes } from "./routes/memorize.routes";
import { explainRoutes } from "./routes/explain.routes";

const fastify = Fastify({ logger: true });

// Plugins
await fastify.register(mongodbPlugin);
await fastify.register(rabbitmqPlugin);
await fastify.register(jwtPlugin);
await fastify.register(websocketPlugin);
await fastify.register(mcpPlugin);

// Routes
await fastify.register(authRoutes, { prefix: "/api/auth" });
await fastify.register(foldersRoutes, { prefix: "/api/folders" });
await fastify.register(videosRoutes, { prefix: "/api/videos" });
await fastify.register(memorizeRoutes, { prefix: "/api/memorize" });
await fastify.register(explainRoutes, { prefix: "/api/explain" });

// Health check
fastify.get("/health", async () => ({ status: "ok" }));

await fastify.listen({ port: config.port, host: "0.0.0.0" });
```

### Cache-First Video Submission

```typescript
// src/services/video.service.ts

export async function createVideo(
  userId: string,
  url: string,
  folderId?: string
) {
  const youtubeId = extractYoutubeId(url);
  if (!youtubeId) throw new Error("Invalid YouTube URL");

  // 1. Check cache
  const cached = await db
    .collection("videoSummaryCache")
    .findOne({ youtubeId });

  if (cached?.status === "completed") {
    // Cache HIT - just create user reference
    const userVideo = await db.collection("userVideos").insertOne({
      userId: new ObjectId(userId),
      videoSummaryId: cached._id,
      youtubeId,
      title: cached.title,
      channel: cached.channel,
      duration: cached.duration,
      thumbnailUrl: cached.thumbnailUrl,
      status: "completed",
      folderId: folderId ? new ObjectId(folderId) : null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return { video: userVideo, cached: true };
  }

  if (cached?.status === "processing") {
    // Already processing - create reference and wait
    const userVideo = await db.collection("userVideos").insertOne({
      userId: new ObjectId(userId),
      videoSummaryId: cached._id,
      youtubeId,
      status: "processing",
      folderId: folderId ? new ObjectId(folderId) : null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return { video: userVideo, cached: false };
  }

  // Cache MISS - create cache entry and queue job
  const cacheEntry = await db.collection("videoSummaryCache").insertOne({
    youtubeId,
    url,
    status: "pending",
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Publish job to queue
  await rabbitmq.publish("summarize.jobs", {
    videoSummaryId: cacheEntry.insertedId.toString(),
    youtubeId,
    url,
    userId, // For WebSocket notification
  });

  const userVideo = await db.collection("userVideos").insertOne({
    userId: new ObjectId(userId),
    videoSummaryId: cacheEntry.insertedId,
    youtubeId,
    status: "pending",
    folderId: folderId ? new ObjectId(folderId) : null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return { video: userVideo, cached: false };
}
```

### MCP Client Plugin

```typescript
// src/plugins/mcp.ts

import { Client } from "@modelcontextprotocol/sdk/client";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio";
import { FastifyInstance } from "fastify";

export async function mcpPlugin(fastify: FastifyInstance) {
  const transport = new StdioClientTransport({
    command: process.env.EXPLAINER_MCP_COMMAND || "python",
    args: (process.env.EXPLAINER_MCP_ARGS || "-m src.server").split(" "),
    cwd: process.env.EXPLAINER_MCP_CWD || "../explainer",
  });

  const client = new Client({
    name: "vie-api",
    version: "1.0.0",
  });

  await client.connect(transport);

  // Decorate fastify with MCP methods
  fastify.decorate("mcp", {
    explainAuto: async (
      videoSummaryId: string,
      targetType: string,
      targetId: string
    ) => {
      const result = await client.callTool("explain_auto", {
        videoSummaryId,
        targetType,
        targetId,
      });

      if (result.isError) {
        throw new Error(result.content[0].text);
      }

      return result.content[0].text;
    },

    explainChat: async (
      memorizedItemId: string,
      userId: string,
      message: string,
      chatId?: string
    ) => {
      const result = await client.callTool("explain_chat", {
        memorizedItemId,
        userId,
        message,
        ...(chatId && { chatId }),
      });

      if (result.isError) {
        throw new Error(result.content[0].text);
      }

      return JSON.parse(result.content[0].text);
    },
  });

  // Cleanup on close
  fastify.addHook("onClose", async () => {
    await client.close();
  });
}
```

### Explain Routes

```typescript
// src/routes/explain.routes.ts

export async function explainRoutes(fastify: FastifyInstance) {
  // GET /api/explain/:videoSummaryId/:targetType/:targetId
  fastify.get(
    "/:videoSummaryId/:targetType/:targetId",
    {
      preHandler: [fastify.authenticate],
      schema: {
        params: z.object({
          videoSummaryId: z.string(),
          targetType: z.enum(["section", "concept"]),
          targetId: z.string(),
        }),
      },
    },
    async (req, reply) => {
      const { videoSummaryId, targetType, targetId } = req.params;

      const expansion = await fastify.mcp.explainAuto(
        videoSummaryId,
        targetType,
        targetId
      );

      return { expansion };
    }
  );

  // POST /api/explain/chat
  fastify.post(
    "/chat",
    {
      preHandler: [fastify.authenticate],
      schema: {
        body: z.object({
          memorizedItemId: z.string(),
          message: z.string(),
          chatId: z.string().optional(),
        }),
      },
    },
    async (req, reply) => {
      const { memorizedItemId, message, chatId } = req.body;
      const userId = req.user.id;

      const result = await fastify.mcp.explainChat(
        memorizedItemId,
        userId,
        message,
        chatId
      );

      return result;
    }
  );
}
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

---

## Commands

```bash
# Development
npm run dev

# Build
npm run build

# Start
npm start

# Type check
npm run typecheck

# Lint
npm run lint
```
