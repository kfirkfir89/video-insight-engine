import { describe, it, expect, afterEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildTestApp, createMockContainer } from '../test/helpers.js';

describe('health routes', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    vi.restoreAllMocks();
    await app?.close();
  });

  async function buildApp(): Promise<FastifyInstance> {
    app = await buildTestApp(createMockContainer());
    await app.ready();
    return app;
  }

  describe('GET /health (liveness)', () => {
    it('should return 200 ok', async () => {
      await buildApp();
      const res = await app.inject({ method: 'GET', url: '/health' });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toHaveProperty('status', 'ok');
    });

    it('should stay 200 even when dependencies are down — liveness, not readiness', async () => {
      await buildApp();
      vi.spyOn(app.mongo.db, 'command').mockRejectedValue(new Error('mongo down'));
      vi.spyOn(app.redis, 'ping').mockRejectedValue(new Error('redis down'));

      const res = await app.inject({ method: 'GET', url: '/health' });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('GET /ready (readiness)', () => {
    it('should return 200 with all checks ok when dependencies respond', async () => {
      await buildApp();
      vi.spyOn(app.mongo.db, 'command').mockResolvedValue({ ok: 1 });
      vi.spyOn(app.redis, 'ping').mockResolvedValue('PONG');

      const res = await app.inject({ method: 'GET', url: '/ready' });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.status).toBe('ready');
      expect(body.checks).toEqual({ mongodb: 'ok', redis: 'ok' });
    });

    it('should return 503 when the Mongo ping fails', async () => {
      await buildApp();
      vi.spyOn(app.mongo.db, 'command').mockRejectedValue(new Error('mongo down'));
      vi.spyOn(app.redis, 'ping').mockResolvedValue('PONG');

      const res = await app.inject({ method: 'GET', url: '/ready' });

      expect(res.statusCode).toBe(503);
      const body = res.json();
      expect(body.status).toBe('unavailable');
      expect(body.checks.mongodb).toBe('failed');
      expect(body.checks.redis).toBe('ok');
    });

    it('should return 503 when the Redis ping fails', async () => {
      await buildApp();
      vi.spyOn(app.mongo.db, 'command').mockResolvedValue({ ok: 1 });
      vi.spyOn(app.redis, 'ping').mockRejectedValue(new Error('redis down'));

      const res = await app.inject({ method: 'GET', url: '/ready' });

      expect(res.statusCode).toBe(503);
      expect(res.json().checks.redis).toBe('failed');
    });

    it('should not include a rabbitmq check when the queue pipeline is disabled', async () => {
      await buildApp();
      vi.spyOn(app.mongo.db, 'command').mockResolvedValue({ ok: 1 });
      vi.spyOn(app.redis, 'ping').mockResolvedValue('PONG');

      const res = await app.inject({ method: 'GET', url: '/ready' });

      expect(res.statusCode).toBe(200);
      expect(res.json().checks).not.toHaveProperty('rabbitmq');
    });

    it('should include a passing rabbitmq check when the broker channel is available', async () => {
      app = await buildTestApp(createMockContainer());
      app.decorate('rabbitmq', {
        getChannel: vi.fn().mockResolvedValue({}),
        isReady: () => true,
      });
      await app.ready();
      vi.spyOn(app.mongo.db, 'command').mockResolvedValue({ ok: 1 });
      vi.spyOn(app.redis, 'ping').mockResolvedValue('PONG');

      const res = await app.inject({ method: 'GET', url: '/ready' });

      expect(res.statusCode).toBe(200);
      expect(res.json().checks.rabbitmq).toBe('ok');
    });

    it('should return 503 when the broker channel cannot be acquired', async () => {
      app = await buildTestApp(createMockContainer());
      app.decorate('rabbitmq', {
        getChannel: vi.fn().mockRejectedValue(new Error('broker down')),
        isReady: () => false,
      });
      await app.ready();
      vi.spyOn(app.mongo.db, 'command').mockResolvedValue({ ok: 1 });
      vi.spyOn(app.redis, 'ping').mockResolvedValue('PONG');

      const res = await app.inject({ method: 'GET', url: '/ready' });

      expect(res.statusCode).toBe(503);
      const body = res.json();
      expect(body.checks.rabbitmq).toBe('failed');
      expect(body.checks.mongodb).toBe('ok');
    });
  });
});
