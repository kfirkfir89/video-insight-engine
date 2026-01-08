# WebSockets & Real-time (Node.js)

Socket.IO, rooms, authentication, and real-time patterns.

---

## Socket.IO Setup

### DO ✅

```typescript
// lib/socket.ts
import { Server as SocketIOServer, Socket } from 'socket.io';
import { FastifyInstance } from 'fastify';
import { verifyToken } from './auth.js';

let io: SocketIOServer;

export function getIO(): SocketIOServer {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
}

export async function initializeSocket(app: FastifyInstance): Promise<void> {
  io = new SocketIOServer(app.server, {
    cors: {
      origin: config.CORS_ORIGINS,
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication required'));
      }

      const payload = await verifyToken(token);
      socket.data.user = payload;
      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  // Connection handler
  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.data.user.id}`);

    // Join user's personal room
    socket.join(`user:${socket.data.user.id}`);

    // Register event handlers
    registerChatHandlers(socket);
    registerNotificationHandlers(socket);

    socket.on('disconnect', (reason) => {
      console.log(`User disconnected: ${socket.data.user.id}, reason: ${reason}`);
    });

    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  });
}
```

---

## Event Handlers

### DO ✅

```typescript
// handlers/chat.handlers.ts
import { Socket } from 'socket.io';

interface JoinRoomPayload {
  roomId: string;
}

interface SendMessagePayload {
  roomId: string;
  content: string;
}

interface TypingPayload {
  roomId: string;
  isTyping: boolean;
}

export function registerChatHandlers(socket: Socket): void {
  const userId = socket.data.user.id;

  // Join a chat room
  socket.on('chat:join', async (payload: JoinRoomPayload) => {
    const { roomId } = payload;

    // Verify user has access to room
    const hasAccess = await chatService.canAccessRoom(userId, roomId);
    if (!hasAccess) {
      socket.emit('error', { message: 'Access denied' });
      return;
    }

    socket.join(`room:${roomId}`);
    socket.to(`room:${roomId}`).emit('chat:user-joined', {
      userId,
      roomId,
      timestamp: new Date(),
    });

    // Send recent messages
    const messages = await chatService.getRecentMessages(roomId, 50);
    socket.emit('chat:history', { roomId, messages });
  });

  // Leave a chat room
  socket.on('chat:leave', (payload: JoinRoomPayload) => {
    const { roomId } = payload;
    socket.leave(`room:${roomId}`);
    socket.to(`room:${roomId}`).emit('chat:user-left', {
      userId,
      roomId,
      timestamp: new Date(),
    });
  });

  // Send a message
  socket.on('chat:message', async (payload: SendMessagePayload) => {
    const { roomId, content } = payload;

    // Validate
    if (!content?.trim()) {
      socket.emit('error', { message: 'Message cannot be empty' });
      return;
    }

    // Save message
    const message = await chatService.createMessage({
      roomId,
      userId,
      content: content.trim(),
    });

    // Broadcast to room
    getIO().to(`room:${roomId}`).emit('chat:message', {
      id: message.id,
      roomId,
      userId,
      content: message.content,
      createdAt: message.createdAt,
    });
  });

  // Typing indicator
  socket.on('chat:typing', (payload: TypingPayload) => {
    const { roomId, isTyping } = payload;
    socket.to(`room:${roomId}`).emit('chat:typing', {
      userId,
      roomId,
      isTyping,
    });
  });
}
```

---

## Notification Handlers

### DO ✅

```typescript
// handlers/notification.handlers.ts
export function registerNotificationHandlers(socket: Socket): void {
  const userId = socket.data.user.id;

  // Mark notification as read
  socket.on('notification:read', async (payload: { notificationId: string }) => {
    await notificationService.markAsRead(payload.notificationId, userId);
  });

  // Mark all as read
  socket.on('notification:read-all', async () => {
    await notificationService.markAllAsRead(userId);
    socket.emit('notification:all-read');
  });
}

// Send notification from anywhere in the app
export function sendNotification(
  userId: string,
  notification: {
    type: string;
    title: string;
    body: string;
    data?: Record<string, unknown>;
  }
): void {
  getIO().to(`user:${userId}`).emit('notification', {
    id: randomUUID(),
    ...notification,
    createdAt: new Date(),
  });
}

// Broadcast to all users
export function broadcastAnnouncement(message: string): void {
  getIO().emit('announcement', {
    message,
    timestamp: new Date(),
  });
}
```

---

## Rooms & Namespaces

### DO ✅

```typescript
// Namespaces for different features
const chatNamespace = io.of('/chat');
const notificationsNamespace = io.of('/notifications');

// Chat namespace with its own auth
chatNamespace.use(authMiddleware);
chatNamespace.on('connection', (socket) => {
  registerChatHandlers(socket);
});

// Notifications namespace
notificationsNamespace.use(authMiddleware);
notificationsNamespace.on('connection', (socket) => {
  socket.join(`user:${socket.data.user.id}`);
});

// Room management
async function createRoom(roomId: string, memberIds: string[]): Promise<void> {
  // Add all members to room
  for (const memberId of memberIds) {
    const sockets = await io.in(`user:${memberId}`).fetchSockets();
    for (const socket of sockets) {
      socket.join(`room:${roomId}`);
    }
  }
}

// Get room members
async function getRoomMembers(roomId: string): Promise<string[]> {
  const sockets = await io.in(`room:${roomId}`).fetchSockets();
  return sockets.map((s) => s.data.user.id);
}

// Emit to specific room
function emitToRoom(roomId: string, event: string, data: unknown): void {
  io.to(`room:${roomId}`).emit(event, data);
}
```

---

## Presence System

### DO ✅

```typescript
// Track online users
const onlineUsers = new Map<string, Set<string>>(); // userId -> Set of socketIds

export function registerPresenceHandlers(socket: Socket): void {
  const userId = socket.data.user.id;

  // Add to online users
  if (!onlineUsers.has(userId)) {
    onlineUsers.set(userId, new Set());
    // User just came online
    socket.broadcast.emit('presence:online', { userId });
  }
  onlineUsers.get(userId)!.add(socket.id);

  // Update status
  socket.on('presence:status', (payload: { status: string }) => {
    socket.broadcast.emit('presence:status-changed', {
      userId,
      status: payload.status,
    });
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    const userSockets = onlineUsers.get(userId);
    if (userSockets) {
      userSockets.delete(socket.id);
      if (userSockets.size === 0) {
        onlineUsers.delete(userId);
        // User went offline
        socket.broadcast.emit('presence:offline', { userId });
      }
    }
  });
}

// Check if user is online
export function isUserOnline(userId: string): boolean {
  return onlineUsers.has(userId);
}

// Get all online users
export function getOnlineUsers(): string[] {
  return Array.from(onlineUsers.keys());
}
```

---

## Rate Limiting

### DO ✅

```typescript
// Rate limit socket events
const rateLimits = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(
  socketId: string,
  event: string,
  limit: number,
  windowMs: number
): boolean {
  const key = `${socketId}:${event}`;
  const now = Date.now();

  const current = rateLimits.get(key);

  if (!current || now > current.resetAt) {
    rateLimits.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (current.count >= limit) {
    return false;
  }

  current.count++;
  return true;
}

// Apply to handlers
socket.on('chat:message', async (payload) => {
  if (!checkRateLimit(socket.id, 'chat:message', 10, 10000)) {
    socket.emit('error', { message: 'Rate limit exceeded. Slow down!' });
    return;
  }

  // Process message...
});
```

---

## Error Handling

### DO ✅

```typescript
// Wrap handlers with error handling
function withErrorHandling<T>(
  handler: (socket: Socket, payload: T) => Promise<void>
) {
  return async (socket: Socket, payload: T) => {
    try {
      await handler(socket, payload);
    } catch (error) {
      console.error('Socket handler error:', error);
      socket.emit('error', {
        message: error instanceof AppError ? error.message : 'Internal error',
        code: error instanceof AppError ? error.code : 'INTERNAL_ERROR',
      });
    }
  };
}

// Usage
socket.on('chat:message', withErrorHandling(async (socket, payload) => {
  // Handler code...
}));

// Global error handling
io.engine.on('connection_error', (err) => {
  console.error('Connection error:', err);
});
```

---

## Scaling with Redis

### DO ✅

```typescript
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

const pubClient = createClient({ url: config.REDIS_URL });
const subClient = pubClient.duplicate();

await Promise.all([pubClient.connect(), subClient.connect()]);

io.adapter(createAdapter(pubClient, subClient));

// Now Socket.IO works across multiple server instances!

// Emit to all servers
io.emit('global-event', data);

// Room operations work across servers
io.to('room:123').emit('message', data);
```

---

## Client Integration (API Routes)

### DO ✅

```typescript
// Emit from HTTP routes
app.post('/api/messages', async (request, reply) => {
  const message = await messageService.create(request.body);

  // Emit to WebSocket clients
  getIO().to(`room:${message.roomId}`).emit('chat:message', message);

  return message;
});

// Emit from background jobs
async function processNotification(job: Job) {
  const { userId, notification } = job.data;

  // Save to database
  await notificationService.create(userId, notification);

  // Push to connected clients
  getIO().to(`user:${userId}`).emit('notification', notification);
}
```

---

## Quick Reference

| Pattern | Use Case |
|---------|----------|
| `socket.emit()` | To sender only |
| `socket.broadcast.emit()` | To all except sender |
| `io.emit()` | To all connected |
| `io.to(room).emit()` | To specific room |
| `socket.join(room)` | Join a room |
| `socket.leave(room)` | Leave a room |

| Event | Description |
|-------|-------------|
| `connection` | Client connected |
| `disconnect` | Client disconnected |
| `error` | Error occurred |

| Scaling | Tool |
|---------|------|
| Multi-server | Redis adapter |
| Sticky sessions | Required with adapter |
| Load balancing | nginx, HAProxy |
