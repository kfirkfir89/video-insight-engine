import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { Redis } from 'ioredis';
import { config } from '../config.js';

declare module 'fastify' {
  interface FastifyInstance {
    redis: Redis;
  }
}

/**
 * Redis connection plugin. Models on `api/src/plugins/rabbitmq.ts` —
 * connect on startup, decorate `fastify.redis`, close on shutdown,
 * and never crash the app if Redis is unreachable (mirror rabbitmq.ts:104
 * "Don't crash the app — the publisher path surfaces a 503 on first publish
 * attempt instead. This keeps health checks green during transient broker
 * restarts.").
 *
 * The downstream consumer is `DispatchGuardService`, which fails open if
 * any Redis call throws, so a degraded Redis means "occasional double-publish
 * caught by the summarizer's own lock" rather than "user submission silently
 * dropped."
 */
/**
 * Reconnect forever with linear backoff capped at 2s. Never returns null —
 * a null return permanently ends the ioredis client, so a brief (~30s)
 * Redis outage would kill the dispatch-guard for the rest of the process
 * lifetime instead of healing on reconnect. Exported for regression tests.
 */
export function redisRetryStrategy(times: number): number {
  return Math.min(times * 200, 2000);
}

async function redis(fastify: FastifyInstance): Promise<void> {
  const client = new Redis(config.REDIS_URL, {
    // Match the rabbitmq.ts ergonomics: connect eagerly but tolerate failure.
    // ioredis defaults to lazyConnect: false; we keep that so the plugin
    // surfaces connection issues immediately in the logs instead of waiting
    // for the first dispatch-guard call.
    lazyConnect: false,
    // ─── Fail-open tuning ──────────────────────────────────────────────
    // The dispatch-guard's fail-open contract says "Redis outage means
    // occasional double-publish caught by the summarizer's own lock". For
    // that contract to be useful under traffic, the catch in
    // DispatchGuardService MUST fire in milliseconds — not seconds. With
    // offline-queue ON + 3 retries, 100 concurrent POST /api/videos during
    // a Redis outage would each block 2-6s waiting on Redis before
    // failing open. Net effect: a fail-open path that's actually fail-slow.
    //
    // Tuning targets two scenarios:
    //   1. Hard outage (Redis container down, network partition): fail-open
    //      within ~500ms so caller-visible latency is bounded.
    //   2. Transient hiccup (GC pause, brief network blip): tolerate p99
    //      latency without false-positive timing out.
    //
    // `commandTimeout: 500` is generous against healthy Redis (typical p99
    // <10ms) but short enough that a real outage doesn't tie up the request
    // queue. `maxRetriesPerRequest: 0` skips ioredis's internal retry — the
    // fail-open path already handles the throw, and an extra retry layer just
    // delays the inevitable fail-open without adding correctness. The prior
    // 200ms+1retry tuning was observed to flap during normal GC pauses; this
    // is a small relaxation that quiets false positives without weakening the
    // fail-fast guarantee.
    maxRetriesPerRequest: 0,
    // Off: a command issued while disconnected fails immediately instead of
    // queuing until reconnect. Dispatch-guard's call site already handles
    // the throw via fail-open; queuing only hides the outage.
    enableOfflineQueue: false,
    // Hard ceiling per command. SET NX EX is a single round-trip — 500ms
    // is generous against a healthy Redis and short enough to fail fast
    // when Redis is unreachable. Tune via observed p99 latency if real
    // outages mask as healthy traffic.
    commandTimeout: 500,
    retryStrategy: redisRetryStrategy,
  });

  client.on('error', (err) => {
    // Demote to warn — the fail-open contract means errors here don't break
    // user flows. info-level would hide real outages; error-level would
    // page on every dev-environment restart.
    fastify.log.warn({ err, url: redactUrl(config.REDIS_URL) }, 'Redis client error');
  });
  client.on('connect', () => {
    fastify.log.info({ url: redactUrl(config.REDIS_URL) }, 'Redis connected');
  });

  fastify.decorate('redis', client);

  fastify.addHook('onClose', async () => {
    try {
      await client.quit();
    } catch (err) {
      fastify.log.debug({ err }, 'Redis quit error (ignored)');
    }
  });
}

function redactUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.password) u.password = '***';
    return u.toString();
  } catch {
    return 'redis://(unparseable)';
  }
}

export const redisPlugin = fp(redis, { name: 'redis' });
