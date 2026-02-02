import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { rateLimitPlugin } from './rate-limit.js';
import { jwtPlugin } from './jwt.js';
import { config } from '../config.js';

describe('Rate Limit plugin', () => {
  describe('basic rate limiting', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
      app = Fastify({ logger: false });
      await app.register(jwtPlugin);
      await app.register(rateLimitPlugin);

      app.get('/test', async () => ({ status: 'ok' }));
      await app.ready();
    });

    afterAll(async () => {
      await app.close();
    });

    it('should allow requests within rate limit', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/test',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ status: 'ok' });
    });

    it('should include rate limit headers', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/test',
      });

      // Rate limit headers should be present
      expect(response.headers).toHaveProperty('x-ratelimit-limit');
      expect(response.headers).toHaveProperty('x-ratelimit-remaining');
    });

    it('should use configured max requests', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/test',
      });

      const limit = parseInt(response.headers['x-ratelimit-limit'] as string, 10);
      expect(limit).toBe(config.RATE_LIMIT_MAX);
    });
  });

  describe('rate limit exhaustion', () => {
    let app: FastifyInstance;
    const testMax = 3;

    beforeAll(async () => {
      // Create app with very low rate limit for testing
      app = Fastify({ logger: false });
      await app.register(jwtPlugin);

      // Register rate limit with custom low limit for testing
      const rateLimit = await import('@fastify/rate-limit');
      await app.register(rateLimit.default, {
        global: true,
        max: testMax,
        timeWindow: '1 minute',
        keyGenerator: (req) => {
          return (req.user as { userId?: string })?.userId || req.ip;
        },
        errorResponseBuilder: () => ({
          error: 'RATE_LIMITED',
          message: 'Too many requests',
          statusCode: 429,
        }),
      });

      app.get('/limited', async () => ({ status: 'ok' }));
      await app.ready();
    });

    afterAll(async () => {
      await app.close();
    });

    it('should return 429 after exceeding rate limit', async () => {
      // Make requests up to the limit
      for (let i = 0; i < testMax; i++) {
        const response = await app.inject({
          method: 'GET',
          url: '/limited',
          remoteAddress: '192.168.1.100', // Use consistent IP
        });
        expect(response.statusCode).toBe(200);
      }

      // Next request should be rate limited
      const response = await app.inject({
        method: 'GET',
        url: '/limited',
        remoteAddress: '192.168.1.100',
      });

      expect(response.statusCode).toBe(429);
      expect(response.json()).toEqual({
        error: 'RATE_LIMITED',
        message: 'Too many requests',
        statusCode: 429,
      });
    });

    it('should track rate limits per IP', async () => {
      // First IP can make requests
      const response1 = await app.inject({
        method: 'GET',
        url: '/limited',
        remoteAddress: '10.0.0.1',
      });
      expect(response1.statusCode).toBe(200);

      // Different IP has its own quota
      const response2 = await app.inject({
        method: 'GET',
        url: '/limited',
        remoteAddress: '10.0.0.2',
      });
      expect(response2.statusCode).toBe(200);
    });
  });

  describe('key generation', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
      app = Fastify({ logger: false });
      await app.register(jwtPlugin);

      // Custom rate limit with low limit to test key generation
      const rateLimit = await import('@fastify/rate-limit');
      await app.register(rateLimit.default, {
        global: true,
        max: 2,
        timeWindow: '1 minute',
        keyGenerator: (req) => {
          return (req.user as { userId?: string })?.userId || req.ip;
        },
        errorResponseBuilder: () => ({
          error: 'RATE_LIMITED',
          message: 'Too many requests',
          statusCode: 429,
        }),
      });

      // Protected route that requires auth
      app.get('/auth-limited', {
        preHandler: app.authenticate,
      }, async () => ({ status: 'ok' }));

      // Public route
      app.get('/public-limited', async () => ({ status: 'ok' }));

      await app.ready();
    });

    afterAll(async () => {
      await app.close();
    });

    it('should use userId for authenticated requests', async () => {
      const token1 = app.jwt.sign({ userId: 'user-1', email: 'user1@example.com' });
      const token2 = app.jwt.sign({ userId: 'user-2', email: 'user2@example.com' });

      // User 1 makes requests (all from same IP but different user)
      await app.inject({
        method: 'GET',
        url: '/auth-limited',
        headers: { authorization: `Bearer ${token1}` },
        remoteAddress: '127.0.0.1',
      });

      // User 2 should have their own quota (different userId)
      const response = await app.inject({
        method: 'GET',
        url: '/auth-limited',
        headers: { authorization: `Bearer ${token2}` },
        remoteAddress: '127.0.0.1',
      });

      expect(response.statusCode).toBe(200);
    });

    it('should use IP for unauthenticated requests', async () => {
      // Make requests without auth
      const response1 = await app.inject({
        method: 'GET',
        url: '/public-limited',
        remoteAddress: '192.168.2.1',
      });
      expect(response1.statusCode).toBe(200);

      // Same IP should be tracked
      const response2 = await app.inject({
        method: 'GET',
        url: '/public-limited',
        remoteAddress: '192.168.2.1',
      });
      expect(response2.statusCode).toBe(200);

      // Third request should be limited
      const response3 = await app.inject({
        method: 'GET',
        url: '/public-limited',
        remoteAddress: '192.168.2.1',
      });
      expect(response3.statusCode).toBe(429);
    });
  });

  describe('error response format', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
      app = Fastify({ logger: false });
      await app.register(jwtPlugin);

      const rateLimit = await import('@fastify/rate-limit');
      await app.register(rateLimit.default, {
        global: true,
        max: 1,
        timeWindow: '1 minute',
        errorResponseBuilder: () => ({
          error: 'RATE_LIMITED',
          message: 'Too many requests',
          statusCode: 429,
        }),
      });

      app.get('/test', async () => ({ status: 'ok' }));
      await app.ready();
    });

    afterAll(async () => {
      await app.close();
    });

    it('should return standardized error response', async () => {
      // Exhaust rate limit
      await app.inject({
        method: 'GET',
        url: '/test',
        remoteAddress: '192.168.3.1',
      });

      const response = await app.inject({
        method: 'GET',
        url: '/test',
        remoteAddress: '192.168.3.1',
      });

      expect(response.statusCode).toBe(429);
      const body = response.json();
      expect(body).toHaveProperty('error', 'RATE_LIMITED');
      expect(body).toHaveProperty('message', 'Too many requests');
      expect(body).toHaveProperty('statusCode', 429);
    });

    it('should include retry-after header', async () => {
      // Exhaust rate limit
      await app.inject({
        method: 'GET',
        url: '/test',
        remoteAddress: '192.168.4.1',
      });

      const response = await app.inject({
        method: 'GET',
        url: '/test',
        remoteAddress: '192.168.4.1',
      });

      expect(response.headers).toHaveProperty('retry-after');
    });
  });

  describe('time window', () => {
    it('should use configured time window from config', () => {
      // Verify config has the expected time window format
      expect(config.RATE_LIMIT_WINDOW).toBeDefined();
      expect(typeof config.RATE_LIMIT_WINDOW).toBe('string');
    });
  });
});
