/**
 * CORS utilities for SSE (Server-Sent Events) endpoints.
 *
 * SSE endpoints bypass Fastify's CORS plugin because they use reply.raw,
 * so we need to set CORS headers manually.
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../config.js';

/**
 * Check if an origin is allowed for CORS.
 *
 * Uses the centralized ALLOWED_ORIGINS list from config which includes:
 * - FRONTEND_URL
 * - localhost:5173 (in development only)
 * - Any additional origins from CORS_ADDITIONAL_ORIGINS env var
 */
export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return false;
  return config.ALLOWED_ORIGINS.includes(origin);
}

/**
 * Set SSE CORS headers on the raw response.
 *
 * This should be called for SSE endpoints that use reply.raw instead of
 * Fastify's normal response handling.
 *
 * @param req - Fastify request object
 * @param reply - Fastify reply object
 * @returns true if origin was allowed and headers were set, false otherwise
 */
export function setSSECorsHeaders(req: FastifyRequest, reply: FastifyReply): boolean {
  const origin = req.headers.origin;

  if (origin && isAllowedOrigin(origin)) {
    reply.raw.setHeader('Access-Control-Allow-Origin', origin);
    reply.raw.setHeader('Access-Control-Allow-Credentials', 'true');
    return true;
  }

  return false;
}

/**
 * Set common SSE response headers.
 *
 * Sets Content-Type, Cache-Control, Connection, and X-Accel-Buffering
 * headers required for Server-Sent Events to work correctly.
 *
 * @param reply - Fastify reply object
 */
export function setSSEResponseHeaders(reply: FastifyReply): void {
  reply.raw.setHeader('Content-Type', 'text/event-stream');
  reply.raw.setHeader('Cache-Control', 'no-cache');
  reply.raw.setHeader('Connection', 'keep-alive');
  // Disable nginx buffering for real-time streaming
  reply.raw.setHeader('X-Accel-Buffering', 'no');
}

/**
 * Handle CORS preflight (OPTIONS) response for SSE endpoints.
 *
 * @param req - Fastify request object
 * @param reply - Fastify reply object
 * @returns Reply object with appropriate response
 */
export function handleSSEPreflight(req: FastifyRequest, reply: FastifyReply): FastifyReply {
  const origin = req.headers.origin;

  if (origin && isAllowedOrigin(origin)) {
    reply.header('Access-Control-Allow-Origin', origin);
    reply.header('Access-Control-Allow-Credentials', 'true');
    reply.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    reply.header('Access-Control-Allow-Headers', 'Authorization, Accept, Content-Type');
  }

  return reply.status(204).send();
}
