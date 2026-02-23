# API Reference

Complete API documentation for all Video Insight Engine services.

---

## Table of Contents

- [REST API](#rest-api) - vie-api HTTP endpoints
- [WebSocket API](#websocket-api) - Real-time updates
- [MCP Explainer API](#mcp-explainer-api) - AI explanation tools
- [SSE Streaming API](#sse-streaming-api) - Progressive summarization

---

# REST API

All endpoints served by `vie-api` on port 3000.

Base URL: `/api`

---

## Authentication

### POST /auth/register

Create new account.

**Request:**

```json
{
  "email": "user@example.com",
  "password": "SecurePass123",
  "name": "John Doe"
}
```

**Response (201):**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": 900,
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

**Cookies Set:**

```
Set-Cookie: refreshToken=xxx; HttpOnly; Secure; SameSite=Strict; Path=/api/auth/refresh; Max-Age=604800
```

---

### POST /auth/login

**Request:**

```json
{
  "email": "user@example.com",
  "password": "SecurePass123"
}
```

**Response (200):**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": 900,
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

**Cookies Set:**

```
Set-Cookie: refreshToken=xxx; HttpOnly; Secure; SameSite=Strict; Path=/api/auth/refresh; Max-Age=604800
```

---

### POST /auth/refresh

Get new access token using refresh token cookie.

**Cookies Required:** `refreshToken` (HttpOnly cookie)

**Response (200):**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": 900
}
```

**Error (401):**

```json
{
  "error": "REFRESH_EXPIRED",
  "message": "Session expired, please login again",
  "statusCode": 401
}
```

---

### POST /auth/logout

Clear refresh token and end session.

**Cookies Required:** `refreshToken` (HttpOnly cookie)

**Response (200):**

```json
{
  "success": true
}
```

**Cookies Cleared:**

```
Set-Cookie: refreshToken=; HttpOnly; Path=/api/auth/refresh; Max-Age=0
```

---

### GET /auth/me

Get current user.

**Headers:** `Authorization: Bearer {accessToken}`

**Response (200):**

```json
{
  "id": "507f1f77bcf86cd799439011",
  "email": "user@example.com",
  "name": "John Doe"
}
```

---

## Folders

### GET /folders

List folders by type.

**Query:** `?type=summarized|memorized`

**Response (200):**

```json
{
  "folders": [
    {
      "id": "507f1f77bcf86cd799439012",
      "name": "AI Learning",
      "type": "summarized",
      "parentId": null,
      "path": "/AI Learning",
      "level": 1,
      "color": "#3B82F6",
      "icon": "folder"
    }
  ]
}
```

---

### POST /folders

Create folder.

**Request:**

```json
{
  "name": "React Tutorials",
  "type": "summarized",
  "parentId": "507f1f77bcf86cd799439012",
  "color": "#10B981",
  "icon": "code"
}
```

**Response (201):**

```json
{
  "id": "507f1f77bcf86cd799439013",
  "name": "React Tutorials",
  "type": "summarized",
  "parentId": "507f1f77bcf86cd799439012",
  "path": "/AI Learning/React Tutorials",
  "level": 2
}
```

---

### PATCH /folders/:id

Update folder.

**Request:**

```json
{
  "name": "React & Hooks",
  "parentId": null
}
```

**Response (200):** Updated folder object.

---

### DELETE /folders/:id

Delete folder. Contents moved to parent (or unfiled).

**Response:** `204 No Content`

---

## Videos

### GET /videos

List user's videos.

**Query:** `?folderId=xxx` (optional)

**Response (200):**

```json
{
  "videos": [
    {
      "id": "507f1f77bcf86cd799439014",
      "videoSummaryId": "507f1f77bcf86cd799439020",
      "youtubeId": "dQw4w9WgXcQ",
      "title": "React Hooks Tutorial",
      "channel": "Fireship",
      "duration": 1200,
      "thumbnailUrl": "https://img.youtube.com/...",
      "status": "completed",
      "folderId": "507f1f77bcf86cd799439013",
      "createdAt": "2024-01-15T10:00:00Z"
    }
  ]
}
```

---

### GET /videos/:id

Get video with summary.

**Response (200):**

```json
{
  "video": {
    "id": "507f1f77bcf86cd799439014",
    "youtubeId": "dQw4w9WgXcQ",
    "title": "React Hooks Tutorial",
    "status": "completed"
  },
  "summary": {
    "tldr": "Comprehensive guide to React Hooks...",
    "keyTakeaways": ["useState for state", "useEffect for side effects"],
    "chapters": [
      {
        "id": "ch-001",
        "timestamp": "00:00",
        "startSeconds": 0,
        "endSeconds": 180,
        "title": "Introduction",
        "isCreatorChapter": true,
        "content": [
          {"blockId": "uuid-1", "type": "paragraph", "text": "..."}
        ],
        "summary": "Overview of React Hooks...",
        "bullets": ["What are hooks", "Why use them"]
      }
    ],
    "concepts": [
      {
        "id": "con-001",
        "name": "useState",
        "definition": "Hook for managing state in functional components",
        "timestamp": "02:30"
      }
    ]
  }
}
```

---

### POST /videos

Submit YouTube URL for summarization.

**Request:**

```json
{
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "folderId": "507f1f77bcf86cd799439013"
}
```

**Logic:**

1. Extract `youtubeId` from URL
2. Check `videoSummaryCache` for existing summary
3. If **HIT**: create `userVideo` reference, return immediately
4. If **MISS**: create cache entry, publish job, return with `status: pending`

**Response (201) - Cache Hit:**

```json
{
  "video": {
    "id": "507f1f77bcf86cd799439014",
    "videoSummaryId": "507f1f77bcf86cd799439020",
    "youtubeId": "dQw4w9WgXcQ",
    "status": "completed",
    "title": "React Hooks Tutorial"
  },
  "cached": true
}
```

**Response (201) - Cache Miss:**

```json
{
  "video": {
    "id": "507f1f77bcf86cd799439014",
    "videoSummaryId": "507f1f77bcf86cd799439020",
    "youtubeId": "dQw4w9WgXcQ",
    "status": "pending"
  },
  "cached": false
}
```

---

### DELETE /videos/:id

Remove video from user's library.

**Note:** Only removes `userVideo` reference. Cache and memorized items unaffected.

**Response:** `204 No Content`

---

## Playlists

### POST /playlists/preview

Preview a playlist before importing.

**Rate Limit:** 30 requests per hour

**Request:**

```json
{
  "url": "https://www.youtube.com/playlist?list=PLxxx",
  "maxVideos": 100
}
```

**Response (200):**

```json
{
  "playlist": {
    "playlistId": "PLxxx",
    "title": "React Tutorial Series",
    "channel": "Fireship",
    "thumbnailUrl": "https://img.youtube.com/...",
    "totalVideos": 15,
    "videos": [
      {
        "videoId": "dQw4w9WgXcQ",
        "title": "React Hooks",
        "position": 0,
        "duration": 1200,
        "thumbnailUrl": "https://img.youtube.com/...",
        "isCached": true
      }
    ],
    "cachedCount": 5
  }
}
```

---

### POST /playlists/import

Import a playlist, creating a folder and adding all videos.

**Rate Limit:** 5 requests per 24 hours

**Request:**

```json
{
  "url": "https://www.youtube.com/playlist?list=PLxxx",
  "folderId": "507f1f77bcf86cd799439013",
  "maxVideos": 100
}
```

**Response (201):**

```json
{
  "folder": {
    "id": "507f1f77bcf86cd799439013",
    "name": "React Tutorial Series"
  },
  "videos": [
    {
      "id": "507f1f77bcf86cd799439014",
      "videoSummaryId": "507f1f77bcf86cd799439020",
      "youtubeId": "dQw4w9WgXcQ",
      "title": "React Hooks",
      "status": "completed",
      "position": 0
    }
  ],
  "totalVideos": 15,
  "cachedCount": 5,
  "processingCount": 10,
  "failedCount": 0
}
```

---

### GET /playlists/:playlistId/videos

Get videos in a playlist, sorted by position.

**Response (200):**

```json
{
  "videos": [
    {
      "id": "507f1f77bcf86cd799439014",
      "videoSummaryId": "507f1f77bcf86cd799439020",
      "youtubeId": "dQw4w9WgXcQ",
      "title": "React Hooks",
      "channel": "Fireship",
      "duration": 1200,
      "thumbnailUrl": "https://img.youtube.com/...",
      "status": "completed",
      "folderId": "507f1f77bcf86cd799439013",
      "playlistInfo": {
        "playlistId": "PLxxx",
        "playlistTitle": "React Tutorial Series",
        "position": 0,
        "totalVideos": 15
      },
      "createdAt": "2024-01-15T10:00:00Z"
    }
  ]
}
```

---

## Explain

### GET /explain/:videoSummaryId/:targetType/:targetId

Get auto-generated expansion for a section or concept ("Go Deeper").

**Parameters:**

- `videoSummaryId`: ID of videoSummaryCache entry
- `targetType`: `section` or `concept`
- `targetId`: UUID of section or concept

**Logic:** Calls MCP `explain_auto` tool on vie-explainer. Results are cached in `systemExpansionCache`.

**Response (200):**

```json
{
  "expansion": "# Documentation: Foundation & The Autolyse Phase\n\n**Video Section:** Mixing Ingredients..."
}
```

---

### POST /explain/video-chat

Send a message about a video. Ephemeral — no server-side persistence.

**Request:**

```json
{
  "videoSummaryId": "507f1f77bcf86cd799439020",
  "message": "What are the main ingredients?",
  "chatHistory": [
    { "role": "user", "content": "Hello" },
    { "role": "assistant", "content": "Hi! How can I help?" }
  ]
}
```

**Logic:** Calls MCP `video_chat` tool on vie-explainer. Chat history is passed from client-side React state.

**Response (200):**

```json
{
  "response": "The main ingredients for this bread recipe are..."
}
```

---

## Memorize

### GET /memorize

List memorized items.

**Query:** `?folderId=xxx` (optional)

**Response (200):**

```json
{
  "items": [
    {
      "id": "507f1f77bcf86cd799439030",
      "title": "React Hooks Fundamentals",
      "sourceType": "video_section",
      "source": {
        "videoTitle": "React Hooks Tutorial",
        "youtubeUrl": "https://youtube.com/watch?v=xxx&t=120"
      },
      "folderId": "507f1f77bcf86cd799439013",
      "tags": ["react", "hooks"],
      "createdAt": "2024-01-15T10:00:00Z"
    }
  ]
}
```

---

### GET /memorize/:id

Get memorized item with full content.

**Response (200):**

```json
{
  "item": {
    "id": "507f1f77bcf86cd799439030",
    "title": "React Hooks Fundamentals",
    "sourceType": "video_section",
    "source": {
      "videoSummaryId": "507f1f77bcf86cd799439020",
      "youtubeId": "dQw4w9WgXcQ",
      "videoTitle": "React Hooks Tutorial",
      "videoThumbnail": "https://img.youtube.com/...",
      "youtubeUrl": "https://youtube.com/watch?v=dQw4w9WgXcQ&t=120",
      "startSeconds": 120,
      "endSeconds": 480,
      "content": {
        "sections": [
          {
            "id": "sec-001",
            "timestamp": "02:00",
            "title": "useState Basics",
            "summary": "...",
            "bullets": ["..."]
          }
        ]
      }
    },
    "notes": "Remember to always include dependencies...",
    "tags": ["react", "hooks"]
  }
}
```

---

### POST /memorize

Create memorized item.

**Request (video section):**

```json
{
  "title": "React Hooks Fundamentals",
  "sourceType": "video_section",
  "videoSummaryId": "507f1f77bcf86cd799439020",
  "sectionIds": ["sec-001", "sec-002"],
  "startSeconds": 120,
  "endSeconds": 480,
  "folderId": "507f1f77bcf86cd799439013",
  "tags": ["react", "hooks"]
}
```

**Request (video concept):**

```json
{
  "title": "Understanding useState",
  "sourceType": "video_concept",
  "videoSummaryId": "507f1f77bcf86cd799439020",
  "conceptId": "con-001"
}
```

**Request (system expansion):**

```json
{
  "title": "Deep Dive: useState",
  "sourceType": "system_expansion",
  "videoSummaryId": "507f1f77bcf86cd799439020",
  "expansionId": "507f1f77bcf86cd799439050"
}
```

**Response (201):** Created item with cached content.

---

### PATCH /memorize/:id

Update memorized item.

**Request:**

```json
{
  "title": "React Hooks - Complete Guide",
  "notes": "Updated notes...",
  "tags": ["react", "hooks", "state"],
  "folderId": "507f1f77bcf86cd799439014"
}
```

**Response (200):** Updated item.

---

### DELETE /memorize/:id

Delete memorized item.

**Response:** `204 No Content`

---

### GET /memorize/:id/chats

List chats for memorized item.

**Response (200):**

```json
{
  "chats": [
    {
      "id": "507f1f77bcf86cd799439040",
      "title": "Understanding hooks",
      "messageCount": 5,
      "updatedAt": "2024-01-15T12:00:00Z"
    }
  ]
}
```

---

## Error Responses

All errors follow this format:

```json
{
  "error": "NOT_FOUND",
  "message": "Video not found",
  "statusCode": 404
}
```

Common error codes:

- `400` - Bad Request (validation)
- `401` - Unauthorized
- `404` - Not Found
- `409` - Conflict (duplicate)
- `500` - Internal Server Error

---

# WebSocket API

Real-time updates for async operations.

---

## Connection

**Endpoint:** `ws://localhost:3000/ws`

**Authentication:** Token as query parameter

```javascript
const token = localStorage.getItem("token");
const ws = new WebSocket(`ws://localhost:3000/ws?token=${token}`);
```

---

## Message Format

All messages are JSON:

```json
{
  "type": "event.name",
  "payload": { ... }
}
```

---

## Events

### video.status

Video processing status update.

**Payload:**

```json
{
  "type": "video.status",
  "payload": {
    "videoSummaryId": "507f1f77bcf86cd799439020",
    "userVideoId": "507f1f77bcf86cd799439014",
    "youtubeId": "dQw4w9WgXcQ",
    "status": "processing" | "completed" | "failed",
    "progress": 45,
    "message": "Extracting sections...",
    "error": null
  }
}
```

**Status flow:**

1. `pending` - Job created, HTTP POST sent to summarizer
2. `processing` - Summarizer started processing
3. `completed` - Summary ready
4. `failed` - Error occurred

**Progress values:**

- 10: Fetching transcript
- 30: Cleaning text
- 50: Detecting sections
- 70: Summarizing sections
- 90: Extracting concepts
- 100: Complete

---

### expansion.status

Expansion generation status (for explain_auto on cache miss).

**Payload:**

```json
{
  "type": "expansion.status",
  "payload": {
    "videoSummaryId": "507f1f77bcf86cd799439020",
    "targetType": "section",
    "targetId": "550e8400-e29b-41d4-a716-446655440001",
    "status": "processing" | "completed" | "failed",
    "error": null
  }
}
```

---

### chat.message

New chat message (for streaming support).

**Payload (complete):**

```json
{
  "type": "chat.message",
  "payload": {
    "chatId": "507f1f77bcf86cd799439040",
    "role": "assistant",
    "content": "Here's an example...",
    "done": true
  }
}
```

**Payload (streaming):**

```json
{
  "type": "chat.message",
  "payload": {
    "chatId": "507f1f77bcf86cd799439040",
    "role": "assistant",
    "content": "Here's",
    "done": false
  }
}
```

---

## Client Implementation

```typescript
// src/hooks/useWebSocket.ts

export function useWebSocket() {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    const ws = new WebSocket(`${import.meta.env.VITE_WS_URL}?token=${token}`);

    ws.onopen = () => {
      console.log("WebSocket connected");
    };

    ws.onmessage = (event) => {
      const { type, payload } = JSON.parse(event.data);

      switch (type) {
        case "video.status":
          // Update video in cache
          queryClient.setQueryData(
            ["video", payload.userVideoId],
            (old: any) => ({ ...old, status: payload.status })
          );

          // Invalidate list if completed
          if (payload.status === "completed") {
            queryClient.invalidateQueries(["videos"]);
          }
          break;

        case "expansion.status":
          if (payload.status === "completed") {
            queryClient.invalidateQueries([
              "expansion",
              payload.videoSummaryId,
              payload.targetType,
              payload.targetId,
            ]);
          }
          break;

        case "chat.message":
          // Handle streaming or completed message
          break;
      }
    };

    ws.onclose = () => {
      console.log("WebSocket disconnected");
      // Implement reconnection logic
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    wsRef.current = ws;

    return () => {
      ws.close();
    };
  }, [queryClient]);

  return wsRef;
}
```

---

## Server Implementation (vie-api)

```typescript
// src/plugins/websocket.ts

import fastifyWebsocket from "@fastify/websocket";

export async function websocketPlugin(fastify: FastifyInstance) {
  await fastify.register(fastifyWebsocket);

  // Store connections by userId
  const connections = new Map<string, WebSocket>();

  fastify.get("/ws", { websocket: true }, (socket, req) => {
    const token = req.query.token as string;

    try {
      const { userId } = fastify.jwt.verify(token);
      connections.set(userId, socket);

      socket.on("close", () => {
        connections.delete(userId);
      });
    } catch {
      socket.close(4001, "Unauthorized");
    }
  });

  // Expose broadcast function
  fastify.decorate("broadcast", (userId: string, event: any) => {
    const socket = connections.get(userId);
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(event));
    }
  });
}
```

---

## HTTP Callback Integration

Status updates flow from summarizer via HTTP callback:

```
vie-summarizer
      │
      │ HTTP POST to /internal/status
      ▼
vie-api
      │
      │ Broadcast via WebSocket
      ▼
vie-web (user's browser)
```

---

# MCP Explainer API

Model Context Protocol (MCP) tools exposed by `vie-explainer`.

**Transport:** Streamable HTTP at `http://vie-explainer:8001/mcp`
**Protocol:** MCP spec 2025-03-26

---

## Overview

`vie-explainer` is an MCP server with two tools:

| Tool           | Purpose                                    | Cached? |
| -------------- | ------------------------------------------ | ------- |
| `explain_auto` | Generate documentation for section/concept | Yes (systemExpansionCache) |
| `video_chat`   | Chat about a video being viewed            | No (ephemeral) |

---

## Connection

`vie-api` connects as MCP client using Streamable HTTP:

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const transport = new StreamableHTTPClientTransport(
  new URL("http://vie-explainer:8001/mcp")
);

const client = new Client({ name: "vie-api", version: "1.0.0" });
await client.connect(transport);
```

---

## Tool: explain_auto

Generate detailed documentation for a video section or concept. Results are cached in `systemExpansionCache` and reused across all users.

### Schema

```json
{
  "name": "explain_auto",
  "inputSchema": {
    "type": "object",
    "properties": {
      "video_summary_id": { "type": "string", "description": "MongoDB ObjectId of video summary" },
      "target_type": { "type": "string", "enum": ["section", "concept"] },
      "target_id": { "type": "string", "description": "UUID of the section or concept" }
    },
    "required": ["video_summary_id", "target_type", "target_id"]
  }
}
```

### Output

Returns markdown string as MCP text content.

### Flow

```
Check systemExpansionCache → HIT: return cached
                            → MISS: load summary → build prompt → LLM → save → return
```

---

## Tool: video_chat

Chat about a specific video. Answers are grounded in the video's content. Ephemeral — no server-side persistence. Chat history is passed by the caller.

### Schema

```json
{
  "name": "video_chat",
  "inputSchema": {
    "type": "object",
    "properties": {
      "video_summary_id": { "type": "string", "description": "MongoDB ObjectId of video summary" },
      "user_message": { "type": "string", "description": "User's question about the video" },
      "chat_history": {
        "type": "array",
        "items": { "type": "object", "properties": { "role": { "type": "string" }, "content": { "type": "string" } } },
        "description": "Previous messages for multi-turn conversation",
        "nullable": true
      }
    },
    "required": ["video_summary_id", "user_message"]
  }
}
```

### Output

Returns assistant response string as MCP text content.

### Flow

```
Load video summary → build context → system prompt + chat_history + user_message → LLM → return
```

---

## Usage from vie-api

```typescript
// ExplainerClient (api/src/services/explainer-client.ts)
// Uses callToolWithTimeout wrapper with 30s timeout

// explain_auto
const expansion = await client.callTool({
  name: "explain_auto",
  arguments: {
    video_summary_id: videoSummaryId,
    target_type: targetType,
    target_id: targetId,
  },
});

// video_chat
const response = await client.callTool({
  name: "video_chat",
  arguments: {
    video_summary_id: videoSummaryId,
    user_message: message,
    chat_history: chatHistory ?? null,
  },
});
```

---

# SSE Streaming API

Progressive summarization via Server-Sent Events.

---

## Overview

The summarization pipeline uses SSE to stream results progressively, allowing the frontend to display content as it becomes available.

**Endpoint:** `GET /api/summarize/stream/{videoSummaryId}`

---

## Event Types

| Event | Phase | Description |
|-------|-------|-------------|
| `phase` | All | Indicates which processing phase started |
| `metadata` | 1 | Video metadata (title, channel, duration, context with category) |
| `chapters` | 1 | Creator chapters if available |
| `sponsor_segments` | 1 | SponsorBlock segments |
| `transcript_ready` | 1 | Transcript extraction complete |
| `description_analysis` | 2 | Links, resources extracted from description |
| `synthesis_complete` | 2 | TLDR and key takeaways |
| `chapter_ready` | 2-3 | Individual chapter summary with content blocks |
| `concepts_complete` | 4 | Key concepts extracted |
| `done` | 5 | Processing complete |

---

## Streaming Phases

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    STREAMING PHASES (SSE Events)                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  PHASE 1: EXTRACTION (~1-30 seconds, depends on transcript source)         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  yt-dlp Extraction + Transcript Fallback Chain                      │   │
│  │                                                                      │   │
│  │  Output events:                                                      │   │
│  │    - metadata (title, channel, thumbnail, duration)                 │   │
│  │    - chapters (if creator chapters exist)                            │   │
│  │    - sponsor_segments (SponsorBlock API)                             │   │
│  │    - transcript_ready                                                │   │
│  │    - VideoContext with CATEGORY (coding/cooking/music/etc)          │   │
│  │                                                                      │   │
│  │  Transcript source chain (first success wins):                      │   │
│  │    1. S3 cache          → phase: transcript_cached (~instant)       │   │
│  │    2. yt-dlp captions   → phase: transcript (~1-3s)                 │   │
│  │    3. Gemini audio      → phase: audio_transcription (~5-15s)      │   │
│  │    4. Whisper audio     → phase: whisper_transcription (~10-30s)    │   │
│  │    5. Metadata fallback → phase: metadata_fallback (music only)    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  PHASE 2: PARALLEL ANALYSIS (~2-5 seconds)                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Three tasks run simultaneously using asyncio.gather():              │   │
│  │                                                                      │   │
│  │  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐     │   │
│  │  │ Task A: Desc     │ │ Task B: TLDR     │ │ Task C: First    │     │   │
│  │  │ Analysis         │ │ Generation       │ │ Section          │     │   │
│  │  │ (Haiku ~1-2s)    │ │ (Sonnet ~2-3s)   │ │ (Sonnet ~3-5s)   │     │   │
│  │  └──────────────────┘ └──────────────────┘ └──────────────────┘     │   │
│  │                                                                      │   │
│  │  Output events: description_analysis, synthesis_complete,            │   │
│  │                 chapter_ready (index 0)                              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  PHASE 3: CHAPTER SUMMARIES (progressive, ~3-5s per batch)                 │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Process remaining chapters in batches (CHAPTER_BATCH_SIZE = 3)     │   │
│  │                                                                      │   │
│  │  Batch 1: Chapters 2-4 (parallel) → chapter_ready events            │   │
│  │  Batch 2: Chapters 5-7 (parallel) → chapter_ready events            │   │
│  │  ...                                                                 │   │
│  │                                                                      │   │
│  │  Each chapter uses PERSONA internally for content block styling     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  PHASE 4: CONCEPTS (~3-5 seconds)                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Extract key concepts from timestamped transcript                   │   │
│  │  Output event: concepts_complete                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  PHASE 5: SAVE & DONE                                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  - Save complete result to MongoDB                                  │   │
│  │  - Emit "done" event with processingTimeMs                          │   │
│  │  - Emit "[DONE]" to close SSE stream                                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Event Payloads

### phase

```json
{ "event": "phase", "phase": "metadata" | "transcript" | "transcript_cached" | "audio_transcription" | "whisper_transcription" | "metadata_fallback" | "parallel_analysis" | "chapter_detect" | "chapter_summaries" | "concepts" | "master_summary" }
```

**Transcript sub-phases** (emitted within Phase 1 based on transcript source):

| Phase | When |
|-------|------|
| `transcript` | Starting transcript extraction (always emitted first) |
| `transcript_cached` | Transcript found in S3 cache |
| `audio_transcription` | No captions available; starting audio transcription (Gemini) |
| `whisper_transcription` | Gemini failed or unavailable; falling back to Whisper |
| `metadata_fallback` | All transcript sources failed for music video; using title/description as transcript |

### metadata

```json
{
  "event": "metadata",
  "title": "React Hooks Tutorial",
  "channel": "Fireship",
  "duration": 627,
  "thumbnailUrl": "https://i.ytimg.com/vi/xxx/maxresdefault.jpg",
  "context": {
    "category": "coding",
    "youtubeCategory": "Science & Technology",
    "tags": ["react", "javascript", "hooks", "programming"],
    "displayTags": ["#React", "#JavaScript", "#Hooks"]
  }
}
```

### chapters

```json
{
  "event": "chapters",
  "chapters": [
    {
      "startSeconds": 0,
      "endSeconds": 120,
      "title": "Introduction"
    }
  ],
  "isCreatorChapters": true
}
```

### transcript_ready

```json
{
  "event": "transcript_ready",
  "duration": 627
}
```

### description_analysis

```json
{
  "event": "description_analysis",
  "links": [
    { "url": "https://github.com/...", "type": "github", "label": "Source code" }
  ],
  "resources": [],
  "socialLinks": [
    { "platform": "twitter", "url": "https://twitter.com/..." }
  ]
}
```

### synthesis_complete

```json
{
  "event": "synthesis_complete",
  "tldr": "This video explains how to use React Hooks...",
  "keyTakeaways": [
    "useState is the most fundamental hook",
    "useEffect handles side effects",
    "Custom hooks enable code reuse"
  ]
}
```

### chapter_ready

```json
{
  "event": "chapter_ready",
  "index": 0,
  "chapter": {
    "id": "uuid-1234",
    "timestamp": "00:00",
    "startSeconds": 0,
    "endSeconds": 120,
    "title": "Introduction",
    "originalTitle": "Introduction",
    "isCreatorChapter": true,
    "content": [
      { "blockId": "uuid-a1b2", "type": "paragraph", "text": "In this chapter..." },
      { "blockId": "uuid-c3d4", "type": "bullets", "items": ["Point 1", "Point 2"] }
    ],
    "summary": "Legacy summary text",
    "bullets": ["Legacy bullet 1", "Legacy bullet 2"]
  }
}
```

### concepts_complete

```json
{
  "event": "concepts_complete",
  "concepts": [
    {
      "id": "uuid-5678",
      "name": "useState",
      "definition": "A React hook for managing state in functional components",
      "timestamp": "2:30"
    }
  ]
}
```

### done

```json
{
  "event": "done",
  "videoSummaryId": "507f1f77bcf86cd799439020",
  "processingTimeMs": 25432
}
```

---

## Client Implementation

```typescript
// apps/web/src/hooks/use-summary-stream.ts

export function useSummaryStream(videoSummaryId: string | null) {
  const [state, setState] = useState<StreamState>({ phase: 'idle' });

  useEffect(() => {
    if (!videoSummaryId) return;

    const eventSource = new EventSource(
      `/api/summarize/stream/${videoSummaryId}`
    );

    eventSource.onmessage = (event) => {
      if (event.data === '[DONE]') {
        eventSource.close();
        return;
      }

      const data = JSON.parse(event.data);

      switch (data.event) {
        case 'metadata':
          setState(s => ({ ...s, metadata: data }));
          break;

        case 'synthesis_complete':
          setState(s => ({ ...s, tldr: data.tldr, keyTakeaways: data.keyTakeaways }));
          break;

        case 'chapter_ready':
          setState(s => ({
            ...s,
            chapters: [...(s.chapters || []), data.chapter]
          }));
          break;

        case 'concepts_complete':
          setState(s => ({ ...s, concepts: data.concepts }));
          break;

        case 'done':
          setState(s => ({ ...s, phase: 'complete', processingTimeMs: data.processingTimeMs }));
          break;
      }
    };

    eventSource.onerror = () => {
      setState(s => ({ ...s, phase: 'error' }));
      eventSource.close();
    };

    return () => eventSource.close();
  }, [videoSummaryId]);

  return state;
}
```

---

## LLM Calls Summary

For a typical 10-chapter video:

| Phase | Model | Calls | Parallel? |
|-------|-------|-------|-----------|
| Phase 2 | Haiku | 1 (description) | Yes |
| Phase 2 | Sonnet | 1 (TLDR) | Yes |
| Phase 2 | Sonnet | 1 (first chapter) | Yes |
| Phase 3 | Sonnet | 9 (remaining chapters) | Batched (3) |
| Phase 4 | Sonnet | 1 (concepts) | No |

**Total: ~13 LLM calls, ~20-30 seconds**
