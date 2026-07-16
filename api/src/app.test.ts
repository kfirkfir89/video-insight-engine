import { describe, it, expect, vi } from 'vitest';
import { buildApp } from './app.js';

describe('buildApp', () => {
  describe('with container override', () => {
    it('should allow partial container override for testing', async () => {
      const mockAssistantClient = {
        chat: vi.fn().mockResolvedValue(new ReadableStream()),
      };

      const app = await buildApp({
        logger: false,
        container: {
          assistantClient: mockAssistantClient as unknown as typeof app.container.assistantClient,
        },
      });

      await app.ready();

      // Verify the mock was injected
      expect(app.container.assistantClient.chat).toBe(mockAssistantClient.chat);

      await app.close();
    });

    it('should use real container when no override provided', async () => {
      const app = await buildApp({
        logger: false,
      });

      await app.ready();

      // Verify container exists and has expected services
      expect(app.container).toBeDefined();
      expect(app.container.assistantClient).toBeDefined();
      expect(app.container.videoService).toBeDefined();
      expect(app.container.queuePublisher).toBeDefined();
      // Redis plugin wires the dispatchGuardService — must be present so
      // dispatchPipeline doesn't go through the no-op fallback in prod.
      expect(app.container.dispatchGuardService).toBeDefined();
      expect(app.redis).toBeDefined();

      await app.close();
    });
  });

  describe('health check', () => {
    it('should respond to /health endpoint', async () => {
      const app = await buildApp({ logger: false });
      await app.ready();

      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toHaveProperty('status', 'ok');

      await app.close();
    });
  });

  describe('HTTP server timeouts', () => {
    it('should apply requestTimeout (slow-loris) and connectionTimeout to the server', async () => {
      const app = await buildApp({ logger: false });
      await app.ready();

      // Config defaults: HTTP_REQUEST_TIMEOUT_MS=30000, HTTP_CONNECTION_TIMEOUT_MS=60000.
      // requestTimeout covers the request phase only, so SSE responses are
      // unaffected; SSE routes additionally opt out of the inactivity timeout
      // via disableSocketInactivityTimeout().
      expect(app.server.requestTimeout).toBe(30000);
      expect(app.server.timeout).toBe(60000);

      await app.close();
    });
  });

  describe('sentry plugin registration', () => {
    it('should boot cleanly when Sentry has no DSN (no-op mode)', async () => {
      // The plugin's onError hook is wired regardless of DSN; verifying the
      // app boots and serves traffic proves the plugin doesn't blow up when
      // Sentry is disabled.
      const app = await buildApp({ logger: false });
      await app.ready();

      const response = await app.inject({ method: 'GET', url: '/health' });
      expect(response.statusCode).toBe(200);

      await app.close();
    });
  });

  describe('request-id wiring', () => {
    it('should set x-request-id on the health response', async () => {
      const app = await buildApp({ logger: false });
      await app.ready();

      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      const id = response.headers['x-request-id'];
      expect(typeof id).toBe('string');
      expect(id).toMatch(/^[0-9a-f-]{36}$/);

      await app.close();
    });

    it('should honor an incoming x-request-id header', async () => {
      const app = await buildApp({ logger: false });
      await app.ready();

      const incoming = 'edge-trace-abcdef12';
      const response = await app.inject({
        method: 'GET',
        url: '/health',
        headers: { 'x-request-id': incoming },
      });

      expect(response.headers['x-request-id']).toBe(incoming);

      await app.close();
    });
  });

  describe('error envelope (docs/ERROR-HANDLING.md, project-score-9 4.5b)', () => {
    // Every error funneled through the global handler must emit the
    // documented `{ error, message, statusCode }` envelope; Zod failures
    // additionally carry `details.issues`.
    it('should emit the documented envelope for AppError subclasses', async () => {
      const app = await buildApp({ logger: false });
      const { NotFoundError } = await import('./utils/errors.js');
      app.get('/boom-app', async () => {
        throw new NotFoundError('Video');
      });
      await app.ready();

      const response = await app.inject({ method: 'GET', url: '/boom-app' });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({
        error: 'NOT_FOUND',
        message: 'Video not found',
        statusCode: 404,
      });

      await app.close();
    });

    it('should emit envelope + details.issues for Zod validation errors', async () => {
      const app = await buildApp({ logger: false });
      const { z } = await import('zod');
      app.post('/boom-zod', async (req) => {
        return z.object({ url: z.string().url() }).parse(req.body);
      });
      await app.ready();

      const response = await app.inject({
        method: 'POST',
        url: '/boom-zod',
        headers: { 'content-type': 'application/json' },
        payload: { url: 123 },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body).toMatchObject({
        error: 'VALIDATION_ERROR',
        statusCode: 400,
      });
      expect(typeof body.message).toBe('string');
      expect(Array.isArray(body.details.issues)).toBe(true);
      expect(body.details.issues[0]).toHaveProperty('path');
      expect(body.details.issues[0]).toHaveProperty('message');

      await app.close();
    });

    it('should emit the documented envelope for unexpected 500s', async () => {
      const app = await buildApp({ logger: false });
      app.get('/boom-500', async () => {
        throw new Error('kaboom');
      });
      await app.ready();

      const response = await app.inject({ method: 'GET', url: '/boom-500' });

      expect(response.statusCode).toBe(500);
      expect(response.json()).toEqual({
        error: 'INTERNAL_ERROR',
        message: 'kaboom', // non-production echoes the message
        statusCode: 500,
      });

      await app.close();
    });
  });
});
