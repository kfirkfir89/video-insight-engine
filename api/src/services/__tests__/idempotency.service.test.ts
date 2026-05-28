import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IdempotencyService, computeContentKey } from '../idempotency.service.js';
import type { IdempotencyRepository } from '../../repositories/idempotency.repository.js';

const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  trace: vi.fn(),
  fatal: vi.fn(),
  child: vi.fn(),
  level: 'silent',
  silent: vi.fn(),
};

describe('IdempotencyService', () => {
  let mockRepo: {
    findByHash: ReturnType<typeof vi.fn>;
    reserveHash: ReturnType<typeof vi.fn>;
    completeHash: ReturnType<typeof vi.fn>;
    invalidateByHash: ReturnType<typeof vi.fn>;
    invalidateStaleCompleted: ReturnType<typeof vi.fn>;
    invalidateByVideoSummaryId: ReturnType<typeof vi.fn>;
  };
  let service: IdempotencyService;

  beforeEach(() => {
    mockRepo = {
      findByHash: vi.fn(),
      reserveHash: vi.fn(),
      completeHash: vi.fn().mockResolvedValue(undefined),
      invalidateByHash: vi.fn().mockResolvedValue(undefined),
      invalidateStaleCompleted: vi.fn().mockResolvedValue(undefined),
      invalidateByVideoSummaryId: vi.fn().mockResolvedValue(undefined),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    service = new IdempotencyService(mockRepo as unknown as IdempotencyRepository, mockLogger as any);
  });

  describe('computeKey', () => {
    it('produces a 64-char hex SHA-256 string', () => {
      const hash = service.computeKey({
        userId: 'user1',
        youtubeId: 'dQw4w9WgXcQ',
      });
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('returns identical hashes for identical inputs', () => {
      const a = service.computeKey({ userId: 'u1', youtubeId: 'abc12345678' });
      const b = service.computeKey({ userId: 'u1', youtubeId: 'abc12345678' });
      expect(a).toBe(b);
    });

    it('returns different hashes for different userIds (same video)', () => {
      const a = service.computeKey({ userId: 'u1', youtubeId: 'abc12345678' });
      const b = service.computeKey({ userId: 'u2', youtubeId: 'abc12345678' });
      expect(a).not.toBe(b);
    });

    it('returns different hashes for different youtubeIds (same user)', () => {
      const a = service.computeKey({ userId: 'u1', youtubeId: 'abc12345678' });
      const b = service.computeKey({ userId: 'u1', youtubeId: 'xyz12345678' });
      expect(a).not.toBe(b);
    });

    it('returns different hashes for different provider configs', () => {
      const a = service.computeKey({
        userId: 'u1',
        youtubeId: 'abc12345678',
        providers: { default: 'anthropic' },
      });
      const b = service.computeKey({
        userId: 'u1',
        youtubeId: 'abc12345678',
        providers: { default: 'openai' },
      });
      expect(a).not.toBe(b);
    });

    it('treats absent providers and equivalent providers as the same hash', () => {
      const a = service.computeKey({ userId: 'u1', youtubeId: 'abc12345678' });
      const b = service.computeKey({
        userId: 'u1',
        youtubeId: 'abc12345678',
        providers: undefined,
      });
      expect(a).toBe(b);
    });

    it('produces a stable hash regardless of key insertion order in providers', () => {
      const a = service.computeKey({
        userId: 'u1',
        youtubeId: 'abc12345678',
        providers: { default: 'anthropic', fast: 'openai', fallback: 'gemini' },
      });
      const b = service.computeKey({
        userId: 'u1',
        youtubeId: 'abc12345678',
        providers: { fallback: 'gemini', default: 'anthropic', fast: 'openai' },
      });
      expect(a).toBe(b);
    });

    it('mixes the client-supplied Idempotency-Key into the hash without replacing the payload', () => {
      // Same clientKey + same payload → same hash (caller can safely retry the same submit).
      const a = service.computeKey({
        userId: 'u1',
        youtubeId: 'abc12345678',
        clientKey: 'my-client-key-123',
      });
      const b = service.computeKey({
        userId: 'u1',
        youtubeId: 'abc12345678',
        clientKey: 'my-client-key-123',
      });
      expect(a).toBe(b);
    });

    it('refuses to collide when the same client key is reused with a DIFFERENT youtubeId', () => {
      // Critical: prevents the Stripe-style footgun where reusing a key with a new
      // URL silently returns the old video. Different payload → different hash.
      const a = service.computeKey({
        userId: 'u1',
        youtubeId: 'abc12345678',
        clientKey: 'my-client-key-123',
      });
      const b = service.computeKey({
        userId: 'u1',
        youtubeId: 'different00',
        clientKey: 'my-client-key-123',
      });
      expect(a).not.toBe(b);
    });

    it('refuses to collide when the same client key is reused with a different provider config', () => {
      const a = service.computeKey({
        userId: 'u1',
        youtubeId: 'abc12345678',
        providers: { default: 'anthropic' },
        clientKey: 'shared',
      });
      const b = service.computeKey({
        userId: 'u1',
        youtubeId: 'abc12345678',
        providers: { default: 'openai' },
        clientKey: 'shared',
      });
      expect(a).not.toBe(b);
    });

    it('scopes client-supplied keys per user so they cannot collide across users', () => {
      const a = service.computeKey({
        userId: 'u1',
        youtubeId: 'abc12345678',
        clientKey: 'shared',
      });
      const b = service.computeKey({
        userId: 'u2',
        youtubeId: 'abc12345678',
        clientKey: 'shared',
      });
      expect(a).not.toBe(b);
    });

    it('produces a different hash with vs without the clientKey (key is part of the identity)', () => {
      const a = service.computeKey({ userId: 'u1', youtubeId: 'abc12345678' });
      const b = service.computeKey({
        userId: 'u1',
        youtubeId: 'abc12345678',
        clientKey: 'some-key',
      });
      expect(a).not.toBe(b);
    });
  });

  describe('computeContentKey', () => {
    it('produces a 64-char hex SHA-256 string', () => {
      const hash = service.computeContentKey({
        youtubeId: 'dQw4w9WgXcQ',
        version: 1,
      });
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('returns identical hashes for identical inputs', () => {
      const a = service.computeContentKey({ youtubeId: 'abc12345678', version: 1 });
      const b = service.computeContentKey({ youtubeId: 'abc12345678', version: 1 });
      expect(a).toBe(b);
    });

    it('is user-independent — two distinct users cannot diverge', () => {
      // The whole point: no userId in the payload, so cross-user submissions
      // for the same content converge on one row via the upsert layer.
      const a = service.computeContentKey({ youtubeId: 'abc12345678', version: 1 });
      const b = service.computeContentKey({ youtubeId: 'abc12345678', version: 1 });
      expect(a).toBe(b);
    });

    it('returns different hashes for different youtubeIds', () => {
      const a = service.computeContentKey({ youtubeId: 'abc12345678', version: 1 });
      const b = service.computeContentKey({ youtubeId: 'xyz12345678', version: 1 });
      expect(a).not.toBe(b);
    });

    it('returns different hashes for different versions', () => {
      // bypassCache version-bump must produce a distinct key — otherwise the
      // new attempt would attach to the stale row and never run.
      const v1 = service.computeContentKey({ youtubeId: 'abc12345678', version: 1 });
      const v2 = service.computeContentKey({ youtubeId: 'abc12345678', version: 2 });
      expect(v1).not.toBe(v2);
    });

    it('returns different hashes for different provider configs', () => {
      const a = service.computeContentKey({
        youtubeId: 'abc12345678',
        version: 1,
        providers: { default: 'anthropic' },
      });
      const b = service.computeContentKey({
        youtubeId: 'abc12345678',
        version: 1,
        providers: { default: 'openai' },
      });
      expect(a).not.toBe(b);
    });

    it('treats absent providers and `undefined` providers as the same hash', () => {
      // Legacy rows have no providers field; new submits without an override
      // pass `undefined`. Backfill correctness depends on these matching.
      const a = service.computeContentKey({ youtubeId: 'abc12345678', version: 1 });
      const b = service.computeContentKey({
        youtubeId: 'abc12345678',
        version: 1,
        providers: undefined,
      });
      expect(a).toBe(b);
    });

    it('is stable regardless of key insertion order in providers', () => {
      const a = service.computeContentKey({
        youtubeId: 'abc12345678',
        version: 1,
        providers: { default: 'anthropic', fast: 'openai', fallback: 'gemini' },
      });
      const b = service.computeContentKey({
        youtubeId: 'abc12345678',
        version: 1,
        providers: { fallback: 'gemini', default: 'anthropic', fast: 'openai' },
      });
      expect(a).toBe(b);
    });

    it('shares canonicalization with computeKey so equivalent provider configs match across hash families', () => {
      // If the two hash families ever disagreed on whether two configs are
      // equivalent, the route-level gate would dedup but the cache-layer
      // upsert would not (or vice versa). They must use the exact same
      // canonicalizeProviders implementation.
      const minimal = { default: 'anthropic' } as const;
      const expanded = { default: 'anthropic', fallback: undefined } as const;
      const a = service.computeContentKey({
        youtubeId: 'abc12345678',
        version: 1,
        providers: minimal,
      });
      const b = service.computeContentKey({
        youtubeId: 'abc12345678',
        version: 1,
        providers: expanded,
      });
      expect(a).toBe(b);
    });

    it('does not collide with the user-scoped computeKey for any realistic input', () => {
      // Different payload shape entirely (no userId, no clientKey, has v{N}).
      // This is more of a sanity guard than a strict requirement, but a
      // collision would indicate a payload-construction mistake.
      const content = service.computeContentKey({ youtubeId: 'abc12345678', version: 1 });
      const user = service.computeKey({ userId: 'u1', youtubeId: 'abc12345678' });
      expect(content).not.toBe(user);
    });
  });

  describe('module-level computeContentKey (for one-off callers)', () => {
    it('produces the same hash as the service method for identical inputs', () => {
      // The mongodb plugin's backfill loop uses the module-level function
      // because constructing IdempotencyService just for a hash is overkill.
      // The two paths MUST agree or the backfill would write keys that don't
      // match what new submits compute.
      const a = computeContentKey({ youtubeId: 'abc12345678', version: 1 });
      const b = service.computeContentKey({ youtubeId: 'abc12345678', version: 1 });
      expect(a).toBe(b);
    });

    it('treats absent providers and explicit undefined the same way', () => {
      const a = computeContentKey({ youtubeId: 'abc12345678', version: 1 });
      const b = computeContentKey({ youtubeId: 'abc12345678', version: 1, providers: undefined });
      expect(a).toBe(b);
    });
  });

  describe('findHit', () => {
    it('delegates to the repository', async () => {
      mockRepo.findByHash.mockResolvedValue({ hash: 'abc' });
      const result = await service.findHit('abc');
      expect(mockRepo.findByHash).toHaveBeenCalledWith('abc');
      expect(result).toEqual({ hash: 'abc' });
    });
  });

  describe('reserveHash', () => {
    it('forwards to the repository with PIPELINE_VERSION and IDEMPOTENCY_TTL_SECONDS from config', async () => {
      mockRepo.reserveHash.mockResolvedValue({ created: true, doc: { hash: 'h1' } });

      await service.reserveHash({
        hash: 'h1',
        userId: 'u1',
        youtubeId: 'abc12345678',
      });

      expect(mockRepo.reserveHash).toHaveBeenCalledWith(
        expect.objectContaining({
          hash: 'h1',
          userId: 'u1',
          youtubeId: 'abc12345678',
          pipelineVersion: expect.any(String),
          ttlSeconds: expect.any(Number),
        }),
      );
    });

    it('returns the repository result verbatim (created flag + doc)', async () => {
      const stub = { created: false, doc: { hash: 'h1', status: 'completed' } };
      mockRepo.reserveHash.mockResolvedValue(stub);

      const result = await service.reserveHash({
        hash: 'h1',
        userId: 'u1',
        youtubeId: 'abc12345678',
      });

      expect(result).toBe(stub);
    });
  });

  describe('completeHash', () => {
    it('forwards to the repository', async () => {
      await service.completeHash({
        hash: 'h1',
        videoSummaryId: 's1',
        userVideoId: 'v1',
      });

      expect(mockRepo.completeHash).toHaveBeenCalledWith({
        hash: 'h1',
        videoSummaryId: 's1',
        userVideoId: 'v1',
      });
    });
  });

  describe('invalidateByHash', () => {
    it('forwards to the repository', async () => {
      await service.invalidateByHash('h1');
      expect(mockRepo.invalidateByHash).toHaveBeenCalledWith('h1');
    });
  });

  describe('invalidateStaleCompleted', () => {
    it('forwards hash + videoSummaryId to the repository', async () => {
      await service.invalidateStaleCompleted('h1', 's1');
      expect(mockRepo.invalidateStaleCompleted).toHaveBeenCalledWith('h1', 's1');
    });
  });

  describe('invalidateByVideoSummaryId', () => {
    it('forwards to the repository', async () => {
      await service.invalidateByVideoSummaryId('s1');
      expect(mockRepo.invalidateByVideoSummaryId).toHaveBeenCalledWith('s1');
    });

    it('swallows repository errors and logs a warning', async () => {
      mockRepo.invalidateByVideoSummaryId.mockRejectedValue(new Error('mongo down'));
      await expect(service.invalidateByVideoSummaryId('s1')).resolves.toBeUndefined();
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });
});
