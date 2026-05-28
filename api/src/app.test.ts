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
});
