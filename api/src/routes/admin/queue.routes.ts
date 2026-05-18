import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../../config.js';
import { QUEUE_TOPOLOGY } from '../../services/queue-topology.js';

/**
 * Admin endpoints for observing and replaying the pipeline job queue.
 *
 * Uses the RabbitMQ management HTTP API (port 15672) for stats and DLQ
 * inspection — much simpler than implementing those over AMQP. The replay
 * endpoint pulls messages from the DLQ via the management API and re-publishes
 * them through the API's own confirm channel so we get publisher confirms.
 */

interface MgmtQueueInfo {
  messages?: number;
  messages_ready?: number;
  messages_unacknowledged?: number;
  consumers?: number;
}

interface MgmtMessageEnvelope {
  payload: string;
  payload_encoding: 'string' | 'base64';
  properties?: {
    headers?: Record<string, unknown>;
    priority?: number;
    message_id?: string;
  };
  routing_key?: string;
}

function requireAdmin(req: FastifyRequest, reply: FastifyReply): boolean {
  const key = req.headers['x-admin-key'];
  if (key !== config.ADMIN_API_KEY) {
    reply.code(401).send({ error: 'UNAUTHORIZED', message: 'Admin key required' });
    return false;
  }
  return true;
}

function managementBase(): { url: string; auth: string } {
  // amqp://user:pass@host:5672/vhost  →  http://host:15672  + Basic auth header
  const parsed = new URL(config.RABBITMQ_URL);
  const host = parsed.hostname || 'vie-rabbitmq';
  const user = decodeURIComponent(parsed.username || 'guest');
  const pass = decodeURIComponent(parsed.password || 'guest');
  const auth = `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
  // Default management port is 15672; we don't carry it in RABBITMQ_URL.
  return { url: `http://${host}:15672`, auth };
}

function vhostPath(): string {
  const parsed = new URL(config.RABBITMQ_URL);
  // RabbitMQ's default vhost is '/' which encodes to '%2F' in URLs.
  const raw = decodeURIComponent(parsed.pathname.replace(/^\//, '') || '/');
  return encodeURIComponent(raw);
}

function clampedInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === 'string' || typeof value === 'number' ? Number(value) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(Math.trunc(n), min), max);
}

async function fetchQueueInfo(queue: string): Promise<MgmtQueueInfo> {
  const { url, auth } = managementBase();
  const target = `${url}/api/queues/${vhostPath()}/${encodeURIComponent(queue)}`;
  const res = await fetch(target, { headers: { Authorization: auth, Accept: 'application/json' } });
  if (!res.ok) {
    throw new Error(`Management API ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as MgmtQueueInfo;
}

async function fetchDlqMessages(count: number): Promise<MgmtMessageEnvelope[]> {
  const { url, auth } = managementBase();
  const target = `${url}/api/queues/${vhostPath()}/${encodeURIComponent(QUEUE_TOPOLOGY.dlq)}/get`;
  // ackmode=ack_requeue_false consumes the message from the queue without
  // requeueing — same effect as a successful consumer ack. This is the
  // documented way to drain a queue via the management API.
  const res = await fetch(target, {
    method: 'POST',
    headers: {
      Authorization: auth,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      count,
      ackmode: 'ack_requeue_false',
      encoding: 'auto',
      truncate: 50000,
    }),
  });
  if (!res.ok) {
    throw new Error(`Management API ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as MgmtMessageEnvelope[];
}

export async function adminQueueRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /stats — combined view of main queue + DLQ depth
  fastify.get('/stats', async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    try {
      const [main, dlq] = await Promise.all([
        fetchQueueInfo(QUEUE_TOPOLOGY.queue),
        fetchQueueInfo(QUEUE_TOPOLOGY.dlq),
      ]);
      return reply.send({
        main: {
          messages: main.messages ?? 0,
          ready: main.messages_ready ?? 0,
          inFlight: main.messages_unacknowledged ?? 0,
          consumers: main.consumers ?? 0,
        },
        dlq: {
          messages: dlq.messages ?? 0,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      fastify.log.warn({ err }, 'Management API stats fetch failed');
      return reply.code(502).send({ error: 'MANAGEMENT_UNREACHABLE', message });
    }
  });

  // GET /dlq?limit=N — peek messages without acking
  fastify.get<{ Querystring: { limit?: string } }>('/dlq', async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const limit = clampedInt(req.query.limit, 20, 1, 100);
    try {
      const { url, auth } = managementBase();
      const target = `${url}/api/queues/${vhostPath()}/${encodeURIComponent(QUEUE_TOPOLOGY.dlq)}/get`;
      const res = await fetch(target, {
        method: 'POST',
        headers: { Authorization: auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          count: limit,
          ackmode: 'ack_requeue_true', // peek — leave in queue
          encoding: 'auto',
          truncate: 50000,
        }),
      });
      if (!res.ok) {
        throw new Error(`Management API ${res.status}: ${await res.text()}`);
      }
      const messages = (await res.json()) as MgmtMessageEnvelope[];
      return reply.send({
        messages: messages.map((m) => ({
          payload: tryParseJson(m.payload),
          routingKey: m.routing_key,
          messageId: m.properties?.message_id,
          priority: m.properties?.priority,
          headers: m.properties?.headers,
        })),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      fastify.log.warn({ err }, 'Management API dlq peek failed');
      return reply.code(502).send({ error: 'MANAGEMENT_UNREACHABLE', message });
    }
  });

  // POST /replay — drain DLQ and re-publish every message back through the main exchange
  fastify.post<{ Body: { max?: number } }>('/replay', async (req, reply) => {
    if (!requireAdmin(req, reply)) return;
    const cap = clampedInt(req.body?.max, 100, 1, 500);

    try {
      const messages = await fetchDlqMessages(cap);
      if (messages.length === 0) {
        // Empty DLQ short-circuits before any channel work — useful for monitoring.
        return reply.send({ replayed: 0 });
      }

      // Replay requires the live channel — only available when the rabbitmq
      // plugin is registered (i.e., USE_QUEUE_PIPELINE=true).
      if (!fastify.rabbitmq) {
        return reply.code(503).send({
          error: 'QUEUE_DISABLED',
          message: 'RabbitMQ plugin is not enabled — set USE_QUEUE_PIPELINE=true',
        });
      }
      const liveChannel = await fastify.rabbitmq.getChannel();

      let replayed = 0;
      for (const m of messages) {
        const decoded =
          m.payload_encoding === 'base64'
            ? Buffer.from(m.payload, 'base64').toString('utf8')
            : m.payload;

        // Reset attempt so the worker's retry policy starts fresh — otherwise
        // a DLQ replay re-hits the cap on first failure and lands right back
        // in the DLQ. Wrap in try/catch so non-JSON payloads still flow
        // through; the worker's validator will quarantine them.
        let body: Buffer;
        try {
          const obj = JSON.parse(decoded) as Record<string, unknown>;
          obj.attempt = 1;
          body = Buffer.from(JSON.stringify(obj), 'utf8');
        } catch {
          body = Buffer.from(decoded, 'utf8');
        }

        liveChannel.publish(QUEUE_TOPOLOGY.exchange, QUEUE_TOPOLOGY.routingKey, body, {
          persistent: true,
          priority: m.properties?.priority,
          contentType: 'application/json',
          messageId: m.properties?.message_id,
          headers: {
            ...(m.properties?.headers ?? {}),
            'x-attempt': 1,
            'x-replayed-at': new Date().toISOString(),
          },
        });
        replayed++;
      }
      await liveChannel.waitForConfirms();
      return reply.send({ replayed });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      fastify.log.error({ err }, 'DLQ replay failed');
      return reply.code(502).send({ error: 'REPLAY_FAILED', message });
    }
  });
}

function tryParseJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}
