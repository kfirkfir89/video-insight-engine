import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { Redis } from 'ioredis';

/**
 * The Redis plugin is intentionally thin — it boots a connection on startup,
 * exposes `fastify.redis`, and closes on shutdown. We don't talk to a real
 * Redis here; the plugin must not crash the app when the connection fails
 * (matches the rabbitmq.ts contract). End-to-end Redis behaviour is covered
 * by the dispatch-guard integration tests.
 */
describe('Redis plugin', () => {
  let app: FastifyInstance;

  beforeEach(() => {
    app = Fastify({ logger: false });
  });

  afterEach(async () => {
    await app.close();
  });

  it('decorates fastify with a Redis client', async () => {
    const { redisPlugin } = await import('./redis.js');
    await app.register(redisPlugin);
    await app.ready();

    expect(app.redis).toBeDefined();
    expect(app.redis).toBeInstanceOf(Redis);
  });

  it('does not crash the app if the initial Redis connection fails', async () => {
    // Point at a deliberately broken URL — the plugin must tolerate this so
    // health checks stay green during transient Redis restarts. Mirror the
    // rabbitmq.ts pattern: log the error, decorate anyway, retry on demand.
    const originalUrl = process.env.REDIS_URL;
    process.env.REDIS_URL = 'redis://127.0.0.1:1'; // port 1 = guaranteed refused
    vi.resetModules();

    try {
      const { redisPlugin } = await import('./redis.js');
      // ioredis throws on first command if lazyConnect:false and host unreachable.
      // With our plugin's settings, registration must still resolve.
      await expect(app.register(redisPlugin).ready()).resolves.not.toThrow();
    } finally {
      if (originalUrl) process.env.REDIS_URL = originalUrl;
      else delete process.env.REDIS_URL;
      vi.resetModules();
    }
  });

  it('closes the Redis connection on app close', async () => {
    const { redisPlugin } = await import('./redis.js');
    await app.register(redisPlugin);
    await app.ready();

    const quitSpy = vi.spyOn(app.redis, 'quit');
    await app.close();
    expect(quitSpy).toHaveBeenCalled();
  });
});
