import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import rateLimit from '@fastify/rate-limit';

async function rateLimitSetup(fastify: FastifyInstance) {
  await fastify.register(rateLimit, {
    global: true,
    max: 100,
    timeWindow: '1 minute',
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
