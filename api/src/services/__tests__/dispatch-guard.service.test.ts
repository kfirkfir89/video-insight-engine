import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { FastifyBaseLogger } from 'fastify';
import { DispatchGuardService } from '../dispatch-guard.service.js';

/**
 * Minimal Redis surface DispatchGuardService consumes. We mock at the call
 * level (set / eval / defineCommand-installed releaseLock) rather than booting
 * an ioredis instance against a live server — keeps tests pure-unit and fast.
 */
interface MockRedis {
  set: ReturnType<typeof vi.fn>;
  releaseLock: ReturnType<typeof vi.fn>;
  defineCommand: ReturnType<typeof vi.fn>;
}

function makeMockRedis(): MockRedis {
  // The service should call defineCommand once (in its constructor) to install
  // the Lua release script as `client.releaseLock`. After that, `releaseLock`
  // is invoked like a normal client method.
  const mock: MockRedis = {
    set: vi.fn(),
    releaseLock: vi.fn(),
    defineCommand: vi.fn(),
  };
  return mock;
}

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  trace: vi.fn(),
  fatal: vi.fn(),
  child: vi.fn(),
  level: 'silent',
  silent: vi.fn(),
} as unknown as FastifyBaseLogger;

describe('DispatchGuardService', () => {
  let redis: MockRedis;
  let service: DispatchGuardService;

  beforeEach(() => {
    vi.clearAllMocks();
    redis = makeMockRedis();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    service = new DispatchGuardService(redis as any, 900, mockLogger);
  });

  describe('constructor', () => {
    it('installs the Lua releaseLock script via defineCommand', () => {
      // The service must register the CAS Lua script once at construction so
      // release() can safely compare-and-delete without a window where two
      // calls overwrite each other.
      expect(redis.defineCommand).toHaveBeenCalledWith(
        'releaseLock',
        expect.objectContaining({
          numberOfKeys: 1,
          lua: expect.stringContaining("redis.call('get', KEYS[1])"),
        }),
      );
    });
  });

  describe('acquire', () => {
    it('returns acquired:true with a token when SET NX EX succeeds', async () => {
      redis.set.mockResolvedValue('OK');

      const result = await service.acquire('summary-1');

      expect(result.acquired).toBe(true);
      expect(result.token).toMatch(/^[0-9a-f-]{36}$/); // uuid v4 shape
      // SET key value EX 900 NX (no XX, no PX) — verify the exact wire call.
      expect(redis.set).toHaveBeenCalledWith(
        'vie:api:dispatched:summary-1',
        result.token,
        'EX',
        900,
        'NX',
      );
    });

    it('returns acquired:false with null token when the key is already held', async () => {
      // ioredis returns null when SET NX fails (the key exists).
      redis.set.mockResolvedValue(null);

      const result = await service.acquire('summary-2');

      expect(result.acquired).toBe(false);
      expect(result.token).toBeNull();
    });

    it('emits distinct tokens across calls (no token reuse)', async () => {
      redis.set.mockResolvedValue('OK');
      const a = await service.acquire('s-a');
      const b = await service.acquire('s-b');
      expect(a.token).not.toBe(b.token);
    });

    it('fails open on Redis error — returns acquired:true with null token + logs warn', async () => {
      // The Mongo upsert is the primary dedup; the summarizer holds the last
      // line of defense. A Redis outage degrading to "occasional double-publish"
      // is strictly better than silently dropping a user's submission.
      redis.set.mockRejectedValue(new Error('ECONNREFUSED'));

      const result = await service.acquire('summary-down');

      expect(result.acquired).toBe(true);
      expect(result.token).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });

  describe('release', () => {
    it('runs the Lua CAS releaseLock with the original token', async () => {
      redis.releaseLock.mockResolvedValue(1);

      await service.release('summary-3', 'token-abc');

      expect(redis.releaseLock).toHaveBeenCalledWith(
        'vie:api:dispatched:summary-3',
        'token-abc',
      );
    });

    it('falls back to blind DEL when token is null (force-release on FAILED)', async () => {
      // internal.routes calls release(videoSummaryId, null) on terminal FAILED
      // — the original publisher's token isn't available cross-process. The
      // Lua script needs the token to do CAS; without it we do a blind DEL.
      // This is the only path that bypasses CAS — document the trade-off
      // (slightly racy, but FAILED is terminal so the race window is narrow).
      const del = vi.fn().mockResolvedValue(1);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (redis as any).del = del;

      await service.release('summary-fail', null);

      expect(del).toHaveBeenCalledWith('vie:api:dispatched:summary-fail');
      expect(redis.releaseLock).not.toHaveBeenCalled();
    });

    it('swallows Redis errors and logs warn (release is best-effort)', async () => {
      redis.releaseLock.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(service.release('summary-x', 'token')).resolves.toBeUndefined();
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });
});
