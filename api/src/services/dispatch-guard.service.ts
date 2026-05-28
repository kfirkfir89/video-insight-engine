import { randomUUID } from 'node:crypto';
import { Redis } from 'ioredis';
import type { FastifyBaseLogger } from 'fastify';

/**
 * Lua compare-and-delete: only release the lock if the caller still owns it
 * (the stored value matches the token). Prevents a slow original publisher
 * from clearing a lock that a fresh attempt has since re-acquired after TTL
 * expiry. Ported verbatim from `services/summarizer/src/services/cache/
 * pipeline_event_stream.py` `_RELEASE_LOCK_LUA` so the two services share the
 * same release semantics.
 */
const RELEASE_LOCK_LUA = `
if redis.call('get', KEYS[1]) == ARGV[1] then
    return redis.call('del', KEYS[1])
else
    return 0
end
`;

/** Extend ioredis with the installed releaseLock command (defineCommand). */
type RedisWithRelease = Redis & {
  releaseLock(key: string, token: string): Promise<number>;
};

/**
 * Public contract for the dispatch guard. Extracted from the class so the
 * container can wire in a no-op implementation for paths without Redis
 * without resorting to `as unknown as` casts (and so VideoService depends
 * on the interface, not the concrete Redis-backed class).
 */
export interface IDispatchGuard {
  acquire(videoSummaryId: string): Promise<{ acquired: boolean; token: string | null }>;
  release(videoSummaryId: string, token: string | null): Promise<void>;
}

/**
 * Permissive no-op guard for paths without Redis wired in (most unit tests,
 * the bootstrap moment before `redisPlugin` registers). Always reports
 * acquired so downstream code behaves identically to fail-open production
 * behaviour.
 */
export const noOpDispatchGuard: IDispatchGuard = {
  acquire: async () => ({ acquired: true, token: null }),
  release: async () => {},
};

/**
 * Belt-and-suspenders guard against publishing duplicate queue messages for
 * the same `video_summary_id`. Step 1's content-addressed upsert is the
 * primary cross-user dedup; this guard catches edge cases the upsert can't
 * (e.g. two API replicas racing outside Mongo's serialization window, or a
 * dispatchPipeline call sneaking through after a row has already been
 * dispatched once).
 *
 * Fail-open contract: any Redis error returns `acquired: true` so the caller
 * proceeds. Rationale — the summarizer's own per-`video_summary_id` lock at
 * `services/summarizer/src/services/cache/pipeline_event_stream.py` is the
 * last line of defense and dedups even if we double-publish; a Redis outage
 * silently dropping user submissions would be far worse.
 */
export class DispatchGuardService implements IDispatchGuard {
  private readonly client: RedisWithRelease;

  constructor(
    redis: Redis,
    private readonly ttlSeconds: number,
    private readonly logger: FastifyBaseLogger,
  ) {
    redis.defineCommand('releaseLock', {
      numberOfKeys: 1,
      lua: RELEASE_LOCK_LUA,
    });
    // Sanity-check that defineCommand actually installed the method —
    // ioredis silently no-ops on duplicate command names, which would
    // leave `client.releaseLock` undefined and surface as a confusing
    // "not a function" at the first release() call. Fail fast at construction.
    if (typeof (redis as { releaseLock?: unknown }).releaseLock !== 'function') {
      throw new Error('DispatchGuardService: releaseLock command failed to install on Redis client');
    }
    this.client = redis as RedisWithRelease;
  }

  private key(videoSummaryId: string): string {
    return `vie:api:dispatched:${videoSummaryId}`;
  }

  /**
   * Atomic SET NX EX. Returns `acquired: true, token` on win — the caller
   * MUST pass `token` to `release()` for safe cleanup. Returns
   * `acquired: false, token: null` when another publisher already holds it.
   */
  async acquire(videoSummaryId: string): Promise<{ acquired: boolean; token: string | null }> {
    const token = randomUUID();
    try {
      const result = await this.client.set(this.key(videoSummaryId), token, 'EX', this.ttlSeconds, 'NX');
      if (result === 'OK') return { acquired: true, token };
      return { acquired: false, token: null };
    } catch (err) {
      this.logger.warn(
        { err, videoSummaryId },
        'dispatch-guard acquire failed; failing open to avoid dropping user submission',
      );
      return { acquired: true, token: null };
    }
  }

  /**
   * Release the guard. With a token: Lua CAS — only deletes if the stored
   * value matches (safe even if a fresh attempt has re-acquired after TTL).
   * With `token: null`: blind DEL — used by `internal.routes.ts` on terminal
   * FAILED status where the original publisher's token isn't available and
   * we want force-release so user-initiated retry can re-dispatch immediately.
   *
   * Best-effort: any error is logged and swallowed. A leaked guard self-heals
   * via TTL.
   */
  async release(videoSummaryId: string, token: string | null): Promise<void> {
    const key = this.key(videoSummaryId);
    try {
      if (token === null) {
        await this.client.del(key);
      } else {
        await this.client.releaseLock(key, token);
      }
    } catch (err) {
      this.logger.warn(
        { err, videoSummaryId, hasToken: token !== null },
        'dispatch-guard release failed; leaked guard will self-heal via TTL',
      );
    }
  }
}
