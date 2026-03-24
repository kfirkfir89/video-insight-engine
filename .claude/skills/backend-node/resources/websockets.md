# WebSockets & Real-time

Socket.IO setup, authentication, rooms, presence, rate limiting, and scaling.

<rules>
- ALWAYS authenticate WebSocket connections in the `io.use()` middleware — verify JWT before allowing connection (causes unauthenticated access to real-time events)
- ALWAYS join users to a personal room `user:{userId}` on connection for targeted messaging (causes inability to send user-specific notifications)
- ALWAYS validate payloads in event handlers before processing (causes injection and crashes from malformed data)
- ALWAYS wrap event handlers with error handling — socket errors should emit to sender, never crash the process (causes server crash from unhandled socket errors)
- ALWAYS use Redis adapter for multi-server deployments (causes lost messages when users connect to different instances)
- NEVER trust client-provided room names — verify access before `socket.join()` (causes unauthorized room access)
- NEVER use `io.emit()` for user-specific data — use `io.to(room).emit()` (causes data leakage to all connected clients)
</rules>

---

## Socket.IO Setup with Auth

```typescript
import { Server as SocketIOServer } from 'socket.io';

export async function initializeSocket(app: FastifyInstance) {
  const io = new SocketIOServer(app.server, {
    cors: { origin: config.CORS_ORIGINS, credentials: true }, pingTimeout: 60000,
  });
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) return next(new Error('Authentication required'));
      socket.data.user = await verifyToken(token);
      next();
    } catch { next(new Error('Invalid token')); }
  });
  io.on('connection', (socket) => {
    socket.join(`user:${socket.data.user.id}`);
    registerChatHandlers(socket);
    socket.on('disconnect', (reason) => logger.info({ userId: socket.data.user.id, reason }, 'Disconnected'));
  });
}
```

---

## Event Handlers

```typescript
export function registerChatHandlers(socket: Socket) {
  const userId = socket.data.user.id;

  socket.on('chat:join', async ({ roomId }: { roomId: string }) => {
    if (!await chatService.canAccessRoom(userId, roomId)) {
      return socket.emit('error', { message: 'Access denied' });
    }
    socket.join(`room:${roomId}`);
    const messages = await chatService.getRecentMessages(roomId, 50);
    socket.emit('chat:history', { roomId, messages });
  });

  socket.on('chat:message', async ({ roomId, content }: { roomId: string; content: string }) => {
    if (!content?.trim()) return socket.emit('error', { message: 'Empty message' });
    const message = await chatService.createMessage({ roomId, userId, content: content.trim() });
    getIO().to(`room:${roomId}`).emit('chat:message', message);
  });
}
```

---

## Presence System

```typescript
const onlineUsers = new Map<string, Set<string>>();

export function registerPresence(socket: Socket) {
  const userId = socket.data.user.id;
  if (!onlineUsers.has(userId)) {
    onlineUsers.set(userId, new Set());
    socket.broadcast.emit('presence:online', { userId });
  }
  onlineUsers.get(userId)!.add(socket.id);

  socket.on('disconnect', () => {
    const sockets = onlineUsers.get(userId);
    sockets?.delete(socket.id);
    if (sockets?.size === 0) {
      onlineUsers.delete(userId);
      socket.broadcast.emit('presence:offline', { userId });
    }
  });
}
```

---

## Rate Limiting & Error Handling

```typescript
function checkRateLimit(socketId: string, event: string, limit: number, windowMs: number): boolean {
  const key = `${socketId}:${event}`;
  const now = Date.now();
  const current = rateLimits.get(key);
  if (!current || now > current.resetAt) { rateLimits.set(key, { count: 1, resetAt: now + windowMs }); return true; }
  if (current.count >= limit) return false;
  current.count++;
  return true;
}

function withErrorHandling<T>(handler: (socket: Socket, payload: T) => Promise<void>) {
  return async (socket: Socket, payload: T) => {
    try { await handler(socket, payload); }
    catch (error) {
      socket.emit('error', { message: error instanceof AppError ? error.message : 'Internal error' });
    }
  };
}
```

---

## Scaling with Redis Adapter

```typescript
import { createAdapter } from '@socket.io/redis-adapter';
const pubClient = createClient({ url: config.REDIS_URL });
const subClient = pubClient.duplicate();
await Promise.all([pubClient.connect(), subClient.connect()]);
io.adapter(createAdapter(pubClient, subClient));
// Room operations now work across all server instances
```

---

## Emitting from HTTP Routes

```typescript
app.post('/api/messages', async (request, reply) => {
  const message = await messageService.create(request.body);
  getIO().to(`room:${message.roomId}`).emit('chat:message', message);
  return message;
});
```

---

## Edge Cases

- **Multiple tabs**: One user can have multiple socket connections. Track by `Set<socketId>` per userId. Only emit "offline" when the last socket disconnects.
- **Reconnection with stale token**: Socket.IO auto-reconnects with the same auth. If the token expired, the reconnection fails silently. Clients must refresh the token before reconnecting.
- **Room cleanup**: Socket.IO automatically removes sockets from rooms on disconnect. No manual cleanup needed for standard room membership.

---

## Rules Summary

WebSocket connections authenticate via JWT in the `io.use()` middleware before any events are processed. Users auto-join a personal `user:{userId}` room for targeted messaging. Event handlers verify room access before joining, validate payloads, and wrap in error handling that emits to the sender rather than crashing. Rate limiting is per-socket per-event. Presence tracks online users via socket ID sets, emitting online/offline only on first connect and last disconnect. Multi-server deployments use the Redis adapter for cross-instance room operations. HTTP routes can emit to WebSocket rooms via the shared `getIO()` instance.
