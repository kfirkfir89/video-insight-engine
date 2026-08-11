/**
 * Per-process TTL cache for the "is this userId soft-deleted?" check that the
 * JWT preValidation hook runs on every authenticated request.
 *
 * Without a cache, every request paid a Mongo `findById` roundtrip purely to
 * gate against a flag that changes once in a user's lifetime. With a small
 * (~30s) TTL the cost is amortized to ~1 lookup per user per window per
 * instance — and `markSoftDeleted` / `cancelDeletion` / `executeHardDelete`
 * call `invalidate(userId)` so the next request on the same instance sees
 * the flip immediately. Other instances catch up within the TTL window,
 * which is acceptable given the 30-day grace period downstream.
 *
 * The cache stores boolean only — a non-existent user is treated as "active"
 * (false), matching the JWT plugin's fail-open behavior on lookup errors.
 */

const TTL_MS = 30_000;

interface CacheEntry {
  isDeleted: boolean;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

/** Returns the cached deletion flag if fresh; `null` on miss or expiry. */
export function get(userId: string): boolean | null {
  const entry = cache.get(userId);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(userId);
    return null;
  }
  return entry.isDeleted;
}

export function set(userId: string, isDeleted: boolean): void {
  cache.set(userId, { isDeleted, expiresAt: Date.now() + TTL_MS });
}

export function invalidate(userId: string): void {
  cache.delete(userId);
}

/** Test-only: clear the entire cache between specs that build a Fastify app. */
export function _resetForTests(): void {
  cache.clear();
}
