import { createHash } from 'node:crypto';
import { FastifyBaseLogger } from 'fastify';
import {
  IdempotencyRepository,
  type IdempotencyKeyDocument,
  type ReserveHashResult,
} from '../repositories/idempotency.repository.js';
import { config } from '../config.js';
import type { ProviderConfig } from './summarizer-client.js';

export interface ComputeKeyInput {
  userId: string;
  youtubeId: string;
  providers?: ProviderConfig;
  /** Optional Stripe-style `Idempotency-Key` header value. Mixed INTO the
   *  payload (not used in place of it), so reusing the same key with a
   *  different URL or provider config produces a distinct hash. */
  clientKey?: string;
}

export interface ReserveInput {
  hash: string;
  userId: string;
  youtubeId: string;
}

export interface CompleteInput {
  hash: string;
  videoSummaryId: string;
  userVideoId: string;
}

/**
 * Exhaustive list of ProviderConfig keys. The `satisfies` clause ties this to
 * the TS interface — adding a new key to ProviderConfig without listing it
 * here fails to compile. Without that guard, a new field would silently drop
 * out of the canonical hash and let two requests with different configs dedup
 * to each other.
 */
const PROVIDER_KEYS = ['default', 'fast', 'fallback'] as const satisfies readonly (keyof ProviderConfig)[];

/**
 * Stable canonical serialization of provider overrides. Keys are emitted in
 * sorted order so two equivalent configs (e.g. `{default: 'anthropic'}` vs
 * `{default: 'anthropic', fallback: undefined}`) produce the same string.
 */
function canonicalizeProviders(providers: ProviderConfig | undefined): string {
  if (!providers) return '';
  const sortedKeys = [...PROVIDER_KEYS].sort();
  const ordered: Record<string, string> = {};
  for (const key of sortedKeys) {
    ordered[key] = String(providers[key] ?? '');
  }
  return JSON.stringify(ordered);
}

export class IdempotencyService {
  constructor(
    private readonly repo: IdempotencyRepository,
    private readonly logger: FastifyBaseLogger,
  ) {}

  /**
   * Deterministic SHA-256 hash of the dedup-relevant inputs. Two submissions
   * producing the same hash collide; bumping `PIPELINE_VERSION` invalidates
   * every key in one shot.
   *
   * `clientKey` is mixed INTO the payload — it does NOT replace it. This is
   * stricter than Stripe's "use the same key with the same parameters or
   * we'll error" semantic; instead, different parameters with the same key
   * simply produce a different hash, and the work runs fresh. This trades
   * the ability to dedup arbitrary payloads (Stripe's design) for the
   * guarantee that reusing a key by mistake never returns the wrong video.
   */
  computeKey(input: ComputeKeyInput): string {
    const providersHash = canonicalizeProviders(input.providers);
    const clientPart = input.clientKey ? `client:${input.clientKey}` : '';
    const payload = [
      input.userId,
      input.youtubeId,
      config.PIPELINE_VERSION,
      providersHash,
      clientPart,
    ].join(':');
    return createHash('sha256').update(payload).digest('hex');
  }

  /** Strong-consistency lookup; null when the hash is fresh. */
  async findHit(hash: string): Promise<IdempotencyKeyDocument | null> {
    return this.repo.findByHash(hash);
  }

  /**
   * Insert a `pending` placeholder atomically. Concurrent submissions race
   * on the unique-hash index; the loser receives `{ created: false, doc }`
   * and the route branches on the doc's status to either return the cached
   * result or 409 the in-flight retry.
   */
  async reserveHash(input: ReserveInput): Promise<ReserveHashResult> {
    return this.repo.reserveHash({
      hash: input.hash,
      userId: input.userId,
      youtubeId: input.youtubeId,
      pipelineVersion: config.PIPELINE_VERSION,
      ttlSeconds: config.IDEMPOTENCY_TTL_SECONDS,
    });
  }

  /** Promote a reserved hash to `completed`, recording the work's IDs. */
  async completeHash(input: CompleteInput): Promise<void> {
    await this.repo.completeHash(input);
  }

  /** Drop a key — used by the failure-unwind path so retries are allowed. */
  async invalidateByHash(hash: string): Promise<void> {
    await this.repo.invalidateByHash(hash);
  }

  /**
   * Race-safe stale-hit cleanup — deletes only the specific completed row the
   * caller observed, leaving any concurrent fresh reservation untouched.
   */
  async invalidateStaleCompleted(hash: string, videoSummaryId: string): Promise<void> {
    await this.repo.invalidateStaleCompleted(hash, videoSummaryId);
  }

  /**
   * Drop every key for a videoSummaryId. The failure event arrives keyed by
   * videoSummaryId, not hash — this is the entry point used by
   * `internal.routes.ts` on terminal-FAILED status.
   */
  async invalidateByVideoSummaryId(videoSummaryId: string): Promise<void> {
    try {
      await this.repo.invalidateByVideoSummaryId(videoSummaryId);
    } catch (err) {
      this.logger.warn({ err, videoSummaryId }, 'idempotency invalidate on failure failed');
    }
  }
}
