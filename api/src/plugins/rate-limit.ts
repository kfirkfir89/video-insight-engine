import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import rateLimit from '@fastify/rate-limit';
import { config } from '../config.js';

async function rateLimitSetup(fastify: FastifyInstance) {
  // Issue #16: Use configurable rate limits from environment
  await fastify.register(rateLimit, {
    global: true,
    max: config.RATE_LIMIT_MAX,
    timeWindow: config.RATE_LIMIT_WINDOW,
    keyGenerator: (req) => {
      return req.user?.userId || req.ip;
    },
    errorResponseBuilder: () => ({
      error: 'RATE_LIMITED',
      message: 'Too many requests',
      statusCode: 429,
    }),
  });
}

export const rateLimitPlugin = fp(rateLimitSetup);
