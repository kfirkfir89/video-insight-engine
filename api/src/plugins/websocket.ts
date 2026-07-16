import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import websocket from '@fastify/websocket';
import { WebSocket } from 'ws';

declare module 'fastify' {
  interface FastifyInstance {
    broadcast: (userId: string, event: object) => void;
  }
}

/**
 * Auth rides in the `Sec-WebSocket-Protocol` header instead of the query
 * string — query strings land verbatim in access logs, so `?token=` leaks
 * live JWTs to any log aggregator. Clients connect with
 * `new WebSocket(url, ['vie-auth', token])`; the server validates the token
 * and selects `vie-auth` as the accepted subprotocol (browsers abort the
 * handshake if the server selects none of the offered protocols).
 */
const WS_AUTH_PROTOCOL = 'vie-auth';

function extractAuthToken(protocolHeader: string | undefined): string | null {
  if (!protocolHeader) return null;
  const offered = protocolHeader.split(',').map((p) => p.trim()).filter(Boolean);
  return offered.find((p) => p !== WS_AUTH_PROTOCOL) ?? null;
}

async function websocketSetup(fastify: FastifyInstance) {
  // Set-per-user so multiple tabs coexist: a Map<userId, WebSocket> registry
  // silently evicts the previous tab on every new connection, leaving only
  // the newest tab receiving broadcasts.
  //
  // SINGLE-REPLICA ASSUMPTION: this registry is process-local. Running more
  // than one API replica would require a shared pub/sub fan-out (e.g. Redis)
  // — see docs/INFRASTRUCTURE.md § Single-replica assumptions.
  const connections = new Map<string, Set<WebSocket>>();

  await fastify.register(websocket, {
    options: {
      handleProtocols: (protocols) =>
        protocols.has(WS_AUTH_PROTOCOL) ? WS_AUTH_PROTOCOL : false,
    },
  });

  fastify.get('/ws', { websocket: true }, (socket, req) => {
    const token = extractAuthToken(req.headers['sec-websocket-protocol']);

    if (!token) {
      socket.close(4001, 'No token');
      return;
    }

    try {
      const payload = fastify.jwt.verify<{ userId: string; type?: string }>(token);
      // Refresh tokens never authenticate live connections (see plugins/jwt.ts)
      if (payload.type === 'refresh') {
        socket.close(4001, 'Invalid token');
        return;
      }
      let sockets = connections.get(payload.userId);
      if (!sockets) {
        sockets = new Set();
        connections.set(payload.userId, sockets);
      }
      sockets.add(socket);

      socket.on('close', () => {
        const userSockets = connections.get(payload.userId);
        if (!userSockets) return;
        userSockets.delete(socket);
        if (userSockets.size === 0) {
          connections.delete(payload.userId);
        }
      });

      socket.send(JSON.stringify({ type: 'connected' }));
    } catch {
      socket.close(4001, 'Invalid token');
    }
  });

  fastify.decorate('broadcast', (userId: string, event: object) => {
    const sockets = connections.get(userId);
    if (!sockets) return;
    const serialized = JSON.stringify(event);
    for (const socket of sockets) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(serialized);
      }
    }
  });
}

export const websocketPlugin = fp(websocketSetup);
