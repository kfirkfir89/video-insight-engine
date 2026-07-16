import { FastifyInstance } from 'fastify';

/**
 * Liveness vs readiness:
 *
 * - `GET /health` is pure liveness — "the process is up and the event loop is
 *   responsive". It deliberately touches NO dependencies so that a Mongo or
 *   Redis outage never makes the orchestrator restart-loop a healthy process.
 * - `GET /ready` is readiness — "this instance can serve real traffic". It
 *   pings MongoDB and Redis, plus the RabbitMQ channel when the queue
 *   pipeline is enabled (the plugin is only registered under
 *   USE_QUEUE_PIPELINE=true). Load balancers and `depends_on` healthchecks
 *   should gate on this one.
 *
 * Failure details are logged, never returned — the response only carries
 * per-check ok/failed so no internal error text leaks to unauthenticated
 * callers.
 */

/** Per-check ceiling so a hung dependency can't stall the readiness probe. */
const READINESS_CHECK_TIMEOUT_MS = 2000;

interface ReadinessCheck {
  name: string;
  run: () => Promise<unknown>;
}

async function withTimeout(promise: Promise<unknown>, ms: number): Promise<unknown> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`readiness check timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export async function healthRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
  }));

  fastify.get('/ready', async (req, reply) => {
    const checks: ReadinessCheck[] = [
      { name: 'mongodb', run: () => fastify.mongo.db.command({ ping: 1 }) },
      { name: 'redis', run: () => fastify.redis.ping() },
    ];
    if (fastify.hasDecorator('rabbitmq') && fastify.rabbitmq) {
      checks.push({ name: 'rabbitmq', run: () => fastify.rabbitmq.getChannel() });
    }

    const results = await Promise.allSettled(
      checks.map((check) => withTimeout(check.run(), READINESS_CHECK_TIMEOUT_MS)),
    );

    const statuses: Record<string, 'ok' | 'failed'> = {};
    let allOk = true;
    results.forEach((result, i) => {
      const ok = result.status === 'fulfilled';
      statuses[checks[i].name] = ok ? 'ok' : 'failed';
      if (!ok) {
        allOk = false;
        req.log.warn({ check: checks[i].name, err: result.reason }, 'Readiness check failed');
      }
    });

    return reply.code(allOk ? 200 : 503).send({
      status: allOk ? 'ready' : 'unavailable',
      checks: statuses,
      timestamp: new Date().toISOString(),
    });
  });
}
