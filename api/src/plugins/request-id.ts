import { randomUUID } from 'crypto';
import type { IncomingMessage } from 'http';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

export const REQUEST_ID_HEADER = 'x-request-id';

// Tightly scoped: only ASCII safe chars, 8–128 long. Loose enough to accept any
// UUID variant or short opaque ids, strict enough to reject log-injection
// attempts (newlines, semicolons, unicode tricks) before the value reaches pino.
const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;

/**
 * Fastify `genReqId` hook. Honors an incoming `x-request-id` header when it
 * matches the safe pattern; otherwise generates a fresh UUID v4. Exported so
 * `buildApp` can wire it into the Fastify constructor (plugins can't change
 * constructor options after Fastify is built).
 */
export function genRequestId(req: IncomingMessage): string {
  const headerValue = req.headers[REQUEST_ID_HEADER];
  if (typeof headerValue === 'string' && REQUEST_ID_PATTERN.test(headerValue)) {
    return headerValue;
  }
  return randomUUID();
}

async function requestIdSetup(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('onSend', async (request, reply) => {
    reply.header(REQUEST_ID_HEADER, request.id);
  });
}

export const requestIdPlugin = fp(requestIdSetup, { name: 'request-id-plugin' });
