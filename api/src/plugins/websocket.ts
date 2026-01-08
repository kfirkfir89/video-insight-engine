import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import websocket from '@fastify/websocket';
import { WebSocket } from 'ws';

declare module 'fastify' {
  interface FastifyInstance {
    broadcast: (userId: string, event: object) => void;
  }
}

async function websocketSetup(fastify: FastifyInstance) {
  const connections = new Map<string, WebSocket>();

  await fastify.register(websocket);

  fastify.get('/ws', { websocket: true }, (socket, req) => {
    const token = (req.query as { token?: string }).token;

    if (!token) {
      socket.close(4001, 'No token');
      return;
    }

    try {
      const payload = fastify.jwt.verify<{ userId: string }>(token);
      connections.set(payload.userId, socket);

      socket.on('close', () => {
        connections.delete(payload.userId);
      });

      socket.send(JSON.stringify({ type: 'connected' }));
    } catch {
      socket.close(4001, 'Invalid token');
    }
  });

  fastify.decorate('broadcast', (userId: string, event: object) => {
    const socket = connections.get(userId);
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(event));
    }
  });
}

export const websocketPlugin = fp(websocketSetup);
