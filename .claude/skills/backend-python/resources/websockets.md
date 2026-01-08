# WebSockets & Real-time (Python)

FastAPI WebSockets, rooms, authentication, and real-time patterns.

---

## FastAPI WebSocket Setup

### DO ✅

```python
# lib/websocket.py
from fastapi import WebSocket, WebSocketDisconnect
from dataclasses import dataclass, field
from typing import Callable, Awaitable
import json


@dataclass
class ConnectedClient:
    websocket: WebSocket
    user_id: str
    rooms: set[str] = field(default_factory=set)


class ConnectionManager:
    """Manage WebSocket connections."""

    def __init__(self):
        self.connections: dict[str, ConnectedClient] = {}  # socket_id -> client
        self.user_connections: dict[str, set[str]] = {}    # user_id -> socket_ids
        self.rooms: dict[str, set[str]] = {}               # room_id -> socket_ids

    async def connect(
        self,
        websocket: WebSocket,
        user_id: str,
    ) -> str:
        """Accept connection and register client."""
        await websocket.accept()

        socket_id = str(uuid.uuid4())
        client = ConnectedClient(websocket=websocket, user_id=user_id)
        self.connections[socket_id] = client

        # Track user's connections
        if user_id not in self.user_connections:
            self.user_connections[user_id] = set()
        self.user_connections[user_id].add(socket_id)

        return socket_id

    def disconnect(self, socket_id: str) -> None:
        """Remove client on disconnect."""
        client = self.connections.get(socket_id)
        if not client:
            return

        # Remove from rooms
        for room_id in client.rooms:
            if room_id in self.rooms:
                self.rooms[room_id].discard(socket_id)

        # Remove from user connections
        if client.user_id in self.user_connections:
            self.user_connections[client.user_id].discard(socket_id)
            if not self.user_connections[client.user_id]:
                del self.user_connections[client.user_id]

        del self.connections[socket_id]

    def join_room(self, socket_id: str, room_id: str) -> None:
        """Add client to a room."""
        client = self.connections.get(socket_id)
        if not client:
            return

        if room_id not in self.rooms:
            self.rooms[room_id] = set()
        self.rooms[room_id].add(socket_id)
        client.rooms.add(room_id)

    def leave_room(self, socket_id: str, room_id: str) -> None:
        """Remove client from a room."""
        client = self.connections.get(socket_id)
        if not client:
            return

        if room_id in self.rooms:
            self.rooms[room_id].discard(socket_id)
        client.rooms.discard(room_id)

    async def send_to_socket(self, socket_id: str, message: dict) -> None:
        """Send message to specific socket."""
        client = self.connections.get(socket_id)
        if client:
            await client.websocket.send_json(message)

    async def send_to_user(self, user_id: str, message: dict) -> None:
        """Send message to all of user's connections."""
        socket_ids = self.user_connections.get(user_id, set())
        for socket_id in socket_ids:
            await self.send_to_socket(socket_id, message)

    async def send_to_room(
        self,
        room_id: str,
        message: dict,
        exclude: str | None = None,
    ) -> None:
        """Send message to all clients in a room."""
        socket_ids = self.rooms.get(room_id, set())
        for socket_id in socket_ids:
            if socket_id != exclude:
                await self.send_to_socket(socket_id, message)

    async def broadcast(self, message: dict, exclude: str | None = None) -> None:
        """Send message to all connected clients."""
        for socket_id in self.connections:
            if socket_id != exclude:
                await self.send_to_socket(socket_id, message)

    def is_user_online(self, user_id: str) -> bool:
        """Check if user has any active connections."""
        return user_id in self.user_connections

    def get_online_users(self) -> list[str]:
        """Get list of online user IDs."""
        return list(self.user_connections.keys())


# Global manager instance
manager = ConnectionManager()
```

---

## WebSocket Endpoint

### DO ✅

```python
# routes/websocket.py
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, Depends
from lib.websocket import manager
from lib.auth import verify_token

router = APIRouter()


async def get_user_from_token(token: str) -> User:
    """Verify token and get user."""
    try:
        payload = verify_token(token)
        user = await user_service.get_by_id(payload["sub"])
        if not user:
            raise ValueError("User not found")
        return user
    except Exception:
        raise ValueError("Invalid token")


@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str = Query(...),
):
    """Main WebSocket endpoint."""
    # Authenticate
    try:
        user = await get_user_from_token(token)
    except ValueError as e:
        await websocket.close(code=4001, reason=str(e))
        return

    # Connect
    socket_id = await manager.connect(websocket, user.id)
    logger.info(f"User {user.id} connected with socket {socket_id}")

    try:
        # Send connection confirmation
        await websocket.send_json({
            "type": "connected",
            "socket_id": socket_id,
            "user_id": user.id,
        })

        # Handle messages
        while True:
            data = await websocket.receive_json()
            await handle_message(socket_id, user, data)

    except WebSocketDisconnect:
        logger.info(f"User {user.id} disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        manager.disconnect(socket_id)
        # Notify others user went offline
        await manager.broadcast({
            "type": "presence:offline",
            "user_id": user.id,
        })
```

---

## Message Handlers

### DO ✅

```python
# handlers/websocket_handlers.py
from typing import Any


async def handle_message(socket_id: str, user: User, data: dict) -> None:
    """Route incoming messages to handlers."""
    message_type = data.get("type")
    payload = data.get("payload", {})

    handlers: dict[str, Callable] = {
        "chat:join": handle_join_room,
        "chat:leave": handle_leave_room,
        "chat:message": handle_chat_message,
        "chat:typing": handle_typing,
        "presence:status": handle_presence_status,
    }

    handler = handlers.get(message_type)
    if handler:
        await handler(socket_id, user, payload)
    else:
        await manager.send_to_socket(socket_id, {
            "type": "error",
            "message": f"Unknown message type: {message_type}",
        })


async def handle_join_room(socket_id: str, user: User, payload: dict) -> None:
    """Handle joining a chat room."""
    room_id = payload.get("room_id")
    if not room_id:
        return

    # Verify access
    has_access = await chat_service.can_access_room(user.id, room_id)
    if not has_access:
        await manager.send_to_socket(socket_id, {
            "type": "error",
            "message": "Access denied",
        })
        return

    manager.join_room(socket_id, room_id)

    # Notify room
    await manager.send_to_room(room_id, {
        "type": "chat:user_joined",
        "user_id": user.id,
        "room_id": room_id,
    }, exclude=socket_id)

    # Send message history
    messages = await chat_service.get_recent_messages(room_id, limit=50)
    await manager.send_to_socket(socket_id, {
        "type": "chat:history",
        "room_id": room_id,
        "messages": [m.model_dump() for m in messages],
    })


async def handle_leave_room(socket_id: str, user: User, payload: dict) -> None:
    """Handle leaving a chat room."""
    room_id = payload.get("room_id")
    if not room_id:
        return

    manager.leave_room(socket_id, room_id)

    await manager.send_to_room(room_id, {
        "type": "chat:user_left",
        "user_id": user.id,
        "room_id": room_id,
    })


async def handle_chat_message(socket_id: str, user: User, payload: dict) -> None:
    """Handle sending a chat message."""
    room_id = payload.get("room_id")
    content = payload.get("content", "").strip()

    if not room_id or not content:
        return

    # Save message
    message = await chat_service.create_message(
        room_id=room_id,
        user_id=user.id,
        content=content,
    )

    # Broadcast to room
    await manager.send_to_room(room_id, {
        "type": "chat:message",
        "message": message.model_dump(),
    })


async def handle_typing(socket_id: str, user: User, payload: dict) -> None:
    """Handle typing indicator."""
    room_id = payload.get("room_id")
    is_typing = payload.get("is_typing", False)

    if not room_id:
        return

    await manager.send_to_room(room_id, {
        "type": "chat:typing",
        "user_id": user.id,
        "room_id": room_id,
        "is_typing": is_typing,
    }, exclude=socket_id)


async def handle_presence_status(socket_id: str, user: User, payload: dict) -> None:
    """Handle presence status update."""
    status = payload.get("status")  # online, away, busy, etc.

    await manager.broadcast({
        "type": "presence:status_changed",
        "user_id": user.id,
        "status": status,
    }, exclude=socket_id)
```

---

## Notifications from API Routes

### DO ✅

```python
# Send notifications from anywhere in the app
from lib.websocket import manager


async def send_notification(
    user_id: str,
    notification: dict,
) -> None:
    """Send real-time notification to user."""
    await manager.send_to_user(user_id, {
        "type": "notification",
        "notification": notification,
    })


# Usage in API routes
@router.post("/api/messages")
async def create_message(
    body: CreateMessageRequest,
    current_user: User = Depends(get_current_user),
):
    message = await message_service.create(body, current_user.id)

    # Notify via WebSocket
    await manager.send_to_room(body.room_id, {
        "type": "chat:message",
        "message": message.model_dump(),
    })

    return message


@router.post("/api/notifications")
async def create_notification(
    body: CreateNotificationRequest,
    current_user: User = Depends(get_current_user),
):
    notification = await notification_service.create(body)

    # Push to connected clients
    await send_notification(body.user_id, notification.model_dump())

    return notification
```

---

## Rate Limiting

### DO ✅

```python
from collections import defaultdict
from datetime import datetime, timedelta


class RateLimiter:
    """Rate limit WebSocket messages."""

    def __init__(self):
        self.limits: dict[str, list[datetime]] = defaultdict(list)

    def check(
        self,
        key: str,
        limit: int,
        window_seconds: int,
    ) -> bool:
        """Check if action is within rate limit."""
        now = datetime.now()
        window_start = now - timedelta(seconds=window_seconds)

        # Clean old entries
        self.limits[key] = [t for t in self.limits[key] if t > window_start]

        # Check limit
        if len(self.limits[key]) >= limit:
            return False

        # Record action
        self.limits[key].append(now)
        return True


rate_limiter = RateLimiter()


async def handle_chat_message(socket_id: str, user: User, payload: dict) -> None:
    """Handle chat message with rate limiting."""
    # Rate limit: 10 messages per 10 seconds
    if not rate_limiter.check(f"chat:{user.id}", limit=10, window_seconds=10):
        await manager.send_to_socket(socket_id, {
            "type": "error",
            "message": "Rate limit exceeded. Please slow down.",
        })
        return

    # Process message...
```

---

## Presence System

### DO ✅

```python
class PresenceManager:
    """Track user presence and status."""

    def __init__(self):
        self.statuses: dict[str, str] = {}  # user_id -> status

    def set_status(self, user_id: str, status: str) -> None:
        self.statuses[user_id] = status

    def get_status(self, user_id: str) -> str:
        if user_id not in manager.user_connections:
            return "offline"
        return self.statuses.get(user_id, "online")

    def get_all_statuses(self) -> dict[str, str]:
        result = {}
        for user_id in manager.user_connections:
            result[user_id] = self.statuses.get(user_id, "online")
        return result


presence = PresenceManager()


@router.get("/api/presence")
async def get_presence(
    user_ids: list[str] = Query(default=[]),
):
    """Get presence status for users."""
    return {
        user_id: presence.get_status(user_id)
        for user_id in user_ids
    }


@router.get("/api/online-users")
async def get_online_users():
    """Get all online users."""
    return presence.get_all_statuses()
```

---

## Scaling with Redis Pub/Sub

### DO ✅

```python
# lib/pubsub.py
import aioredis
import json


class RedisPubSub:
    """Redis pub/sub for multi-server WebSocket scaling."""

    def __init__(self):
        self.redis: aioredis.Redis | None = None
        self.pubsub: aioredis.client.PubSub | None = None

    async def connect(self, redis_url: str) -> None:
        self.redis = await aioredis.from_url(redis_url)
        self.pubsub = self.redis.pubsub()

    async def subscribe(self, channel: str, handler: Callable) -> None:
        """Subscribe to a channel."""
        await self.pubsub.subscribe(channel)

        async def listen():
            async for message in self.pubsub.listen():
                if message["type"] == "message":
                    data = json.loads(message["data"])
                    await handler(data)

        asyncio.create_task(listen())

    async def publish(self, channel: str, message: dict) -> None:
        """Publish message to channel."""
        await self.redis.publish(channel, json.dumps(message))


pubsub = RedisPubSub()


# Initialize on startup
@app.on_event("startup")
async def startup():
    await pubsub.connect(settings.REDIS_URL)

    # Subscribe to broadcast channel
    async def handle_broadcast(data: dict):
        # Forward to local connections
        if data.get("room"):
            await manager.send_to_room(data["room"], data["message"])
        elif data.get("user_id"):
            await manager.send_to_user(data["user_id"], data["message"])
        else:
            await manager.broadcast(data["message"])

    await pubsub.subscribe("ws:broadcast", handle_broadcast)


# Use pub/sub for cross-server messaging
async def broadcast_to_all_servers(message: dict, room: str | None = None) -> None:
    """Broadcast message across all server instances."""
    await pubsub.publish("ws:broadcast", {
        "room": room,
        "message": message,
    })
```

---

## Error Handling

### DO ✅

```python
async def handle_message(socket_id: str, user: User, data: dict) -> None:
    """Handle message with error catching."""
    try:
        message_type = data.get("type")
        payload = data.get("payload", {})

        handler = handlers.get(message_type)
        if handler:
            await handler(socket_id, user, payload)
        else:
            await manager.send_to_socket(socket_id, {
                "type": "error",
                "code": "UNKNOWN_TYPE",
                "message": f"Unknown message type: {message_type}",
            })

    except ValidationError as e:
        await manager.send_to_socket(socket_id, {
            "type": "error",
            "code": "VALIDATION_ERROR",
            "message": str(e),
        })

    except PermissionError as e:
        await manager.send_to_socket(socket_id, {
            "type": "error",
            "code": "PERMISSION_DENIED",
            "message": str(e),
        })

    except Exception as e:
        logger.exception(f"WebSocket handler error: {e}")
        await manager.send_to_socket(socket_id, {
            "type": "error",
            "code": "INTERNAL_ERROR",
            "message": "An unexpected error occurred",
        })
```

---

## Quick Reference

| Operation | Method |
|-----------|--------|
| Send to socket | `manager.send_to_socket(socket_id, msg)` |
| Send to user | `manager.send_to_user(user_id, msg)` |
| Send to room | `manager.send_to_room(room_id, msg)` |
| Broadcast all | `manager.broadcast(msg)` |
| Join room | `manager.join_room(socket_id, room_id)` |
| Leave room | `manager.leave_room(socket_id, room_id)` |

| Event | Description |
|-------|-------------|
| `connect` | Client connected |
| `disconnect` | Client disconnected |
| `receive_json` | Message received |
| `send_json` | Send message |

| Scaling | Tool |
|---------|------|
| Multi-server | Redis pub/sub |
| Sticky sessions | Required |
| Load balancer | nginx, Traefik |
