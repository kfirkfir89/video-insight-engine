import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildTestApp, createMockContainer, type MockContainer } from '../../../test/helpers.js';
import { config } from '../../../config.js';

describe('admin queue routes', () => {
  let app: FastifyInstance;
  let mockContainer: MockContainer;
  const adminHeaders = { 'x-admin-key': config.ADMIN_API_KEY };

  beforeAll(async () => {
    mockContainer = createMockContainer();
    app = await buildTestApp(mockContainer);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  describe('auth', () => {
    it('returns 401 when admin key is missing', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/admin/queue/stats' });
      expect(res.statusCode).toBe(401);
    });

    it('returns 401 when admin key is wrong', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/queue/stats',
        headers: { 'x-admin-key': 'nope' },
      });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('GET /api/admin/queue/stats', () => {
    it('returns depth + dlq depth from the management API', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
        const u = String(url);
        if (u.includes('vie.pipeline.jobs')) {
          return new Response(JSON.stringify({ messages: 5, messages_unacknowledged: 1 }), { status: 200 });
        }
        if (u.includes('vie.pipeline.dlq')) {
          return new Response(JSON.stringify({ messages: 2, messages_unacknowledged: 0 }), { status: 200 });
        }
        return new Response('not found', { status: 404 });
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/queue/stats',
        headers: adminHeaders,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.main.messages).toBe(5);
      expect(body.main.inFlight).toBe(1);
      expect(body.dlq.messages).toBe(2);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('returns 502 when the management API is unreachable', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('connect ECONNREFUSED'));
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/queue/stats',
        headers: adminHeaders,
      });
      expect(res.statusCode).toBe(502);
    });
  });

  describe('POST /api/admin/queue/replay', () => {
    it('returns 0 replayed when DLQ has no messages', async () => {
      // /get returns an array of messages — empty here means nothing to replay
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response('[]', { status: 200 }),
      );

      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/queue/replay',
        headers: adminHeaders,
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ replayed: 0 });
    });

    it('returns 503 when the queue plugin is disabled and DLQ has messages', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify([
            {
              payload: '{"videoSummaryId":"x"}',
              payload_encoding: 'string',
              properties: { message_id: 'm1' },
              routing_key: 'video.process.dead',
            },
          ]),
          { status: 200 },
        ),
      );

      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/queue/replay',
        headers: adminHeaders,
      });
      // Test env doesn't register the rabbitmq plugin, so replay needs the
      // queue path enabled to actually re-publish.
      expect(res.statusCode).toBe(503);
      expect(res.json().error).toBe('QUEUE_DISABLED');
    });
  });
});
