import type { FastifyRequest } from 'fastify';

/**
 * Opt a long-lived SSE connection out of the server-wide socket inactivity
 * timeout (`connectionTimeout` in app.ts / HTTP_CONNECTION_TIMEOUT_MS).
 *
 * Without this, an SSE stream that goes quiet for longer than the timeout —
 * e.g. an assistant tool call that takes a while, or a pipeline stage between
 * keepalives — gets its socket destroyed mid-stream.
 *
 * Guarded because light-my-request (`app.inject`) fakes the socket without a
 * `setTimeout` implementation.
 */
export function disableSocketInactivityTimeout(req: FastifyRequest): void {
  const socket: { setTimeout?: unknown } | undefined = req.raw.socket;
  if (socket && typeof socket.setTimeout === 'function') {
    socket.setTimeout(0);
  }
}
