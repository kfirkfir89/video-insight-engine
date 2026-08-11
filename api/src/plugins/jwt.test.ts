import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { jwtPlugin } from './jwt.js';
import { config } from '../config.js';
import { AppError } from '../utils/errors.js';

describe('JWT plugin', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(jwtPlugin);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('token signing', () => {
    it('should sign a token with userId payload', () => {
      const payload = { userId: 'user-123', email: 'test@example.com' };
      const token = app.jwt.sign(payload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should sign token with configured expiration', () => {
      const payload = { userId: 'user-123' };
      const token = app.jwt.sign(payload);
      const decoded = app.jwt.decode(token) as { exp: number; iat: number };

      expect(decoded).toBeDefined();
      expect(decoded.exp).toBeGreaterThan(decoded.iat);
    });
  });

  describe('token verification', () => {
    it('should verify a valid token', async () => {
      const payload = { userId: 'user-123', email: 'test@example.com' };
      const token = app.jwt.sign(payload);
      const verified = app.jwt.verify(token);

      expect(verified).toMatchObject(payload);
    });

    it('should reject an invalid token', () => {
      const invalidToken = 'invalid.token.here';

      expect(() => app.jwt.verify(invalidToken)).toThrow();
    });

    it('should reject a tampered token', () => {
      const payload = { userId: 'user-123' };
      const token = app.jwt.sign(payload);
      // Tamper with the token
      const tampered = token.slice(0, -5) + 'xxxxx';

      expect(() => app.jwt.verify(tampered)).toThrow();
    });

    it('should reject token signed with different secret', () => {
      // Create a separate app with different secret
      const createFakeToken = () => {
        // Simulate a token from different source
        const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
        const payload = Buffer.from(JSON.stringify({ userId: 'hacker' })).toString('base64url');
        const fakeSignature = 'fake-signature';
        return `${header}.${payload}.${fakeSignature}`;
      };

      const fakeToken = createFakeToken();
      expect(() => app.jwt.verify(fakeToken)).toThrow();
    });
  });

  describe('expiration handling', () => {
    it('should reject expired token', async () => {
      // Sign with very short expiration (1 second)
      const payload = { userId: 'user-123' };
      const token = app.jwt.sign(payload, { expiresIn: '1s' });

      // Wait for expiration (1.5 seconds to be safe)
      await new Promise(resolve => setTimeout(resolve, 1500));

      expect(() => app.jwt.verify(token)).toThrow();
    });

    it('should accept token within validity period', () => {
      const payload = { userId: 'user-123' };
      const token = app.jwt.sign(payload, { expiresIn: '1h' });

      const verified = app.jwt.verify(token);
      expect(verified).toMatchObject(payload);
    });
  });

  describe('authenticate decorator', () => {
    let authApp: FastifyInstance;

    beforeAll(async () => {
      authApp = Fastify({ logger: false });
      await authApp.register(jwtPlugin);

      // Add a protected route for testing
      authApp.get('/protected', {
        preHandler: authApp.authenticate,
      }, async (request) => {
        return { userId: request.user.userId };
      });

      await authApp.ready();
    });

    afterAll(async () => {
      await authApp.close();
    });

    it('should allow access with valid token', async () => {
      const token = authApp.jwt.sign({ userId: 'user-123', email: 'test@example.com' });

      const response = await authApp.inject({
        method: 'GET',
        url: '/protected',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ userId: 'user-123' });
    });

    it('should return 401 without token', async () => {
      const response = await authApp.inject({
        method: 'GET',
        url: '/protected',
      });

      expect(response.statusCode).toBe(401);
      expect(response.json()).toEqual({
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
        statusCode: 401,
      });
    });

    it('should return 401 TOKEN_INVALID with invalid token', async () => {
      const response = await authApp.inject({
        method: 'GET',
        url: '/protected',
        headers: {
          authorization: 'Bearer invalid.token.here',
        },
      });

      expect(response.statusCode).toBe(401);
      expect(response.json()).toEqual({
        error: 'TOKEN_INVALID',
        message: 'Invalid token',
        statusCode: 401,
      });
    });

    it('should return 401 TOKEN_EXPIRED with expired token', async () => {
      const expiredToken = authApp.jwt.sign({ userId: 'user-123' }, { expiresIn: '1s' });

      // Wait for expiration (1.5 seconds to be safe)
      await new Promise(resolve => setTimeout(resolve, 1500));

      const response = await authApp.inject({
        method: 'GET',
        url: '/protected',
        headers: {
          authorization: `Bearer ${expiredToken}`,
        },
      });

      expect(response.statusCode).toBe(401);
      expect(response.json()).toEqual({
        error: 'TOKEN_EXPIRED',
        message: 'Token has expired',
        statusCode: 401,
      });
    });

    it('should return 401 with malformed authorization header', async () => {
      const response = await authApp.inject({
        method: 'GET',
        url: '/protected',
        headers: {
          authorization: 'NotBearer token',
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('request user decoration', () => {
    let userApp: FastifyInstance;

    beforeAll(async () => {
      userApp = Fastify({ logger: false });
      await userApp.register(jwtPlugin);

      userApp.get('/user-info', {
        preHandler: userApp.authenticate,
      }, async (request) => {
        return {
          userId: request.user.userId,
          email: request.user.email,
        };
      });

      await userApp.ready();
    });

    afterAll(async () => {
      await userApp.close();
    });

    it('should populate request.user with token payload', async () => {
      const payload = { userId: 'user-456', email: 'user@example.com' };
      const token = userApp.jwt.sign(payload);

      const response = await userApp.inject({
        method: 'GET',
        url: '/user-info',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        userId: 'user-456',
        email: 'user@example.com',
      });
    });
  });

  describe('authenticateInternal decorator', () => {
    let internalApp: FastifyInstance;

    beforeAll(async () => {
      internalApp = Fastify({ logger: false });
      await internalApp.register(jwtPlugin);

      internalApp.get('/internal-test', {
        preHandler: internalApp.authenticateInternal,
      }, async (request) => {
        return { userId: request.user.userId };
      });

      // authenticateInternal throws domain errors; mirror the real app's
      // AppError → status mapping so they surface as 401.
      internalApp.setErrorHandler((error, _request, reply) => {
        const status = error instanceof AppError ? error.status : 500;
        return reply.status(status).send({ error: error.message });
      });

      await internalApp.ready();
    });

    afterAll(async () => {
      await internalApp.close();
    });

    it('should return 401 when the internal secret is missing', async () => {
      const response = await internalApp.inject({
        method: 'GET',
        url: '/internal-test',
        headers: { 'x-user-id': 'u1' },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 401 when the internal secret is invalid', async () => {
      const response = await internalApp.inject({
        method: 'GET',
        url: '/internal-test',
        headers: { 'x-internal-secret': 'wrong-secret', 'x-user-id': 'u1' },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 401 when a correct-prefix-but-shorter secret is sent', async () => {
      const response = await internalApp.inject({
        method: 'GET',
        url: '/internal-test',
        headers: {
          'x-internal-secret': config.INTERNAL_SECRET.slice(0, -1),
          'x-user-id': 'u1',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 401 when X-User-Id is missing', async () => {
      const response = await internalApp.inject({
        method: 'GET',
        url: '/internal-test',
        headers: { 'x-internal-secret': config.INTERNAL_SECRET },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should bind X-User-Id as req.user with a valid secret', async () => {
      const response = await internalApp.inject({
        method: 'GET',
        url: '/internal-test',
        headers: { 'x-internal-secret': config.INTERNAL_SECRET, 'x-user-id': 'u1' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ userId: 'u1' });
    });
  });
});
