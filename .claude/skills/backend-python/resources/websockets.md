# WebSockets & Real-time

FastAPI WebSockets, connection management, rooms, and scaling.

<rules>
- ALWAYS authenticate WebSocket connections before accepting — verify token in query params (unauthenticated WebSockets allow anyone to receive private data)
- ALWAYS wrap the message loop in try/except/finally with disconnect cleanup (unhandled disconnects leak connection state in the manager)
- ALWAYS rate-limit WebSocket messages per user (unbounded message rates enable DoS via a single connection)
- ALWAYS use Redis pub/sub for multi-server WebSocket scaling (in-memory ConnectionManager only works for single-server deployments)
- NEVER accept WebSocket connections without authentication (bypasses all access control)
- NEVER send to disconnected sockets without catching exceptions (raises errors that crash the handler for other connections)
</rules>

---

## ConnectionManager

Track connections by socket_id, user_id, and room. Support send-to-socket, send-to-user, send-to-room, and broadcast.

```python
@dataclass
class ConnectedClient:
    websocket: WebSocket
    user_id: str
    rooms: set[str] = field(default_factory=set)
```

```python
class ConnectionManager:
    def __init__(self):
        self.connections: dict[str, ConnectedClient] = {}
        self.user_connections: dict[str, set[str]] = {}
        self.rooms: dict[str, set[str]] = {}
    async def connect(self, ws: WebSocket, user_id: str) -> str:
        await ws.accept()
        sid = str(uuid.uuid4())
        self.connections[sid] = ConnectedClient(websocket=ws, user_id=user_id)
        self.user_connections.setdefault(user_id, set()).add(sid)
        return sid
    def disconnect(self, sid: str) -> None:
        if (c := self.connections.pop(sid, None)):
            for rid in c.rooms: self.rooms.get(rid, set()).discard(sid)
            self.user_connections.get(c.user_id, set()).discard(sid)
```

---

## WebSocket Endpoint

Authenticate via query token, connect, handle messages in a loop, clean up on disconnect.

```python
@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = Query(...)):
    try:
        user = await get_user_from_token(token)
    except ValueError:
        await websocket.close(code=4001, reason="Invalid token")
        return
    socket_id = await manager.connect(websocket, user.id)
    try:
        while True:
            data = await websocket.receive_json()
            await handle_message(socket_id, user, data)
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(socket_id)
```

---

## Message Handlers

Route by message type. Validate room access before joining. Rate-limit chat messages (e.g., 10/10s per user).

```python
async def handle_message(socket_id: str, user: User, data: dict) -> None:
    handlers = {"chat:join": handle_join, "chat:message": handle_chat, "chat:typing": handle_typing}
    handler = handlers.get(data.get("type"))
    if handler:
        await handler(socket_id, user, data.get("payload", {}))
    else:
        await manager.send_to_socket(socket_id, {"type": "error", "message": "Unknown type"})
```

---

## Scaling with Redis Pub/Sub

For multi-server deployments, publish messages to a Redis channel and subscribe on each server to forward to local connections.

```python
async def broadcast_to_all_servers(message: dict, room: str | None = None) -> None:
    await pubsub.publish("ws:broadcast", {"room": room, "message": message})
```

Subscribe at startup. On receive, forward to local `manager.send_to_room()` or `manager.broadcast()`.

---

## Edge Cases

- **Multiple tabs per user**: One user can have multiple socket connections. Use `user_connections` dict (user_id -> set of socket_ids) to send to all tabs.
- **Presence after disconnect**: Clean up presence state in the `finally` block. Notify other users of offline status only after all of a user's connections are closed.
- **Error in handler**: Wrap `handle_message` in try/except to send error responses to the client without crashing the connection loop.

---

## Rules Summary

Authenticate WebSocket connections via query token before accepting. Use a ConnectionManager with socket, user, and room tracking. Clean up state in `finally` blocks on disconnect. Route messages by type with dedicated handlers. Rate-limit messages per user. Scale across servers with Redis pub/sub. Handle errors per-message to avoid dropping the entire connection.
