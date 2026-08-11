import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { FastifyBaseLogger } from 'fastify';
import { QueuePublisher } from '../queue-publisher.service.js';
import { QUEUE_TOPOLOGY, PRIORITY_FREE, PRIORITY_PAID } from '../queue-topology.js';
import { QueuePublishError } from '../../utils/errors.js';

const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  trace: vi.fn(),
  fatal: vi.fn(),
  child: vi.fn(() => mockLogger),
  level: 'silent',
  silent: vi.fn(),
} as unknown as FastifyBaseLogger;

interface MockChannel {
  publish: ReturnType<typeof vi.fn>;
}

function createSuccessfulChannel(): MockChannel {
  return {
    publish: vi.fn((_exchange, _routingKey, _content, _options, callback) => {
      // Simulate async confirm
      setImmediate(() => callback?.(null));
      return true;
    }),
  };
}

function createRejectingChannel(reason: Error): MockChannel {
  return {
    publish: vi.fn((_exchange, _routingKey, _content, _options, callback) => {
      setImmediate(() => callback?.(reason));
      return true;
    }),
  };
}

function createNeverConfirmingChannel(): MockChannel {
  return {
    publish: vi.fn(() => true),
  };
}

const validInput = {
  videoSummaryId: 'abc123def456789012345678',
  youtubeId: 'dQw4w9WgXcQ',
  url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  userId: 'user-1',
  tier: 'free' as const,
};

describe('QueuePublisher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('publishVideoJob', () => {
    it('publishes to the configured exchange with the configured routing key', async () => {
      const channel = createSuccessfulChannel();
      const publisher = new QueuePublisher(async () => channel as never, mockLogger);

      await publisher.publishVideoJob(validInput);

      expect(channel.publish).toHaveBeenCalledTimes(1);
      const [exchange, routingKey] = channel.publish.mock.calls[0];
      expect(exchange).toBe(QUEUE_TOPOLOGY.exchange);
      expect(routingKey).toBe(QUEUE_TOPOLOGY.routingKey);
    });

    it('sends a JSON-serialized payload with the validated shape', async () => {
      const channel = createSuccessfulChannel();
      const publisher = new QueuePublisher(async () => channel as never, mockLogger);

      const payload = await publisher.publishVideoJob(validInput);

      const buffer = channel.publish.mock.calls[0][2] as Buffer;
      const parsed = JSON.parse(buffer.toString('utf8'));
      expect(parsed.videoSummaryId).toBe(validInput.videoSummaryId);
      expect(parsed.youtubeId).toBe(validInput.youtubeId);
      expect(parsed.tier).toBe('free');
      expect(parsed.attempt).toBe(1);
      expect(parsed.requestId).toBeTruthy();
      expect(payload.priority).toBe(PRIORITY_FREE);
    });

    it('assigns higher priority to paid tiers', async () => {
      const channel = createSuccessfulChannel();
      const publisher = new QueuePublisher(async () => channel as never, mockLogger);

      const free = await publisher.publishVideoJob({ ...validInput, tier: 'free' });
      const pro = await publisher.publishVideoJob({ ...validInput, tier: 'pro' });
      const team = await publisher.publishVideoJob({ ...validInput, tier: 'team' });

      expect(free.priority).toBe(PRIORITY_FREE);
      expect(pro.priority).toBe(PRIORITY_PAID);
      expect(team.priority).toBe(PRIORITY_PAID);

      const options = channel.publish.mock.calls.map(call => call[3]);
      expect(options[0].priority).toBe(PRIORITY_FREE);
      expect(options[1].priority).toBe(PRIORITY_PAID);
      expect(options[2].priority).toBe(PRIORITY_PAID);
    });

    it('marks messages persistent and stamps headers for observability', async () => {
      const channel = createSuccessfulChannel();
      const publisher = new QueuePublisher(async () => channel as never, mockLogger);

      await publisher.publishVideoJob({ ...validInput, tier: 'pro' });

      const options = channel.publish.mock.calls[0][3];
      expect(options.persistent).toBe(true);
      expect(options.contentType).toBe('application/json');
      expect(options.headers).toEqual({
        'x-attempt': 1,
        'x-tier': 'pro',
      });
    });

    it('preserves a caller-supplied requestId for trace correlation', async () => {
      const channel = createSuccessfulChannel();
      const publisher = new QueuePublisher(async () => channel as never, mockLogger);

      const payload = await publisher.publishVideoJob({
        ...validInput,
        requestId: 'trace-abc-123',
      });

      expect(payload.requestId).toBe('trace-abc-123');
    });

    it('throws QueuePublishError when the broker rejects the publish', async () => {
      const channel = createRejectingChannel(new Error('queue full'));
      const publisher = new QueuePublisher(async () => channel as never, mockLogger);

      await expect(publisher.publishVideoJob(validInput)).rejects.toThrow(QueuePublishError);
    });

    it('rejects payloads with malformed youtubeId before touching the channel', async () => {
      const channel = createSuccessfulChannel();
      const publisher = new QueuePublisher(async () => channel as never, mockLogger);

      await expect(
        publisher.publishVideoJob({ ...validInput, youtubeId: 'too-short' }),
      ).rejects.toThrow();
      expect(channel.publish).not.toHaveBeenCalled();
    });

    it('times out when broker never confirms', async () => {
      // Override config timeout to keep this test fast — read inside the
      // publisher path. We just need a channel whose callback never fires.
      const channel = createNeverConfirmingChannel();
      const publisher = new QueuePublisher(async () => channel as never, mockLogger);

      vi.useFakeTimers();
      const promise = publisher.publishVideoJob(validInput).catch((err) => err);
      await vi.advanceTimersByTimeAsync(6000);

      const err = await promise;
      expect(err).toBeInstanceOf(QueuePublishError);
      expect((err as Error).message).toMatch(/timed out/);
      vi.useRealTimers();
    });

    it('records attempt count for retry/replay flows', async () => {
      const channel = createSuccessfulChannel();
      const publisher = new QueuePublisher(async () => channel as never, mockLogger);

      const payload = await publisher.publishVideoJob({ ...validInput, attempt: 3 });
      expect(payload.attempt).toBe(3);

      const options = channel.publish.mock.calls[0][3];
      expect(options.headers['x-attempt']).toBe(3);
    });
  });
});
