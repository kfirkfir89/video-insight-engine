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

1. `pending` → Job created, HTTP POST sent to summarizer
2. `processing` → Summarizer started processing
3. `completed` → Summary ready
4. `failed` → Error occurred

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

New chat message (for streaming support, future).

**Payload:**

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

For streaming (future):

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

```typescript
// vie-api internal status endpoint

fastify.post('/internal/status', async (request, reply) => {
  const event = request.body as StatusEvent;

  // Broadcast to user
  fastify.broadcast(event.payload.userId, event);

  return { received: true };
});
```

```python
# vie-summarizer sending status updates

async def send_status_update(
    video_summary_id: str,
    user_id: str,
    status: str,
    progress: int,
    message: str = None,
    error: str = None,
):
    """Send status update to API for WebSocket broadcast."""
    async with httpx.AsyncClient() as client:
        await client.post(
            f"{settings.API_URL}/internal/status",
            json={
                "type": "video.status",
                "payload": {
                    "videoSummaryId": video_summary_id,
                    "userId": user_id,
                    "status": status,
                    "progress": progress,
                    "message": message,
                    "error": error,
                }
            }
        )
```
