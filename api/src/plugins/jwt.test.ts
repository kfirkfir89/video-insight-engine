import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { jwtPlugin } from './jwt.js';
import { config } from '../config.js';

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
        message: 'Invalid or expired token',
        statusCode: 401,
      });
    });

    it('should return 401 with invalid token', async () => {
      const response = await authApp.inject({
        method: 'GET',
        url: '/protected',
        headers: {
          authorization: 'Bearer invalid.token.here',
        },
      });

      expect(response.statusCode).toBe(401);
      expect(response.json()).toMatchObject({
        error: 'UNAUTHORIZED',
        message: 'Invalid or expired token',
      });
    });

    it('should return 401 with expired token', async () => {
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
      expect(response.json()).toMatchObject({
        error: 'UNAUTHORIZED',
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
});
