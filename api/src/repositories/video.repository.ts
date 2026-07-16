import { Db, ObjectId, Collection } from 'mongodb';
import { DatabaseError } from '../utils/errors.js';

export interface VideoSummaryCacheDocument {
  _id: ObjectId;
  youtubeId: string;
  url: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  title?: string;
  channel?: string;
  duration?: number;
  thumbnailUrl?: string;
  summary?: unknown;
  chapters?: unknown;
  chapterSource?: string;
  descriptionAnalysis?: unknown;
  context?: unknown;
  outputType?: string;
  version: number;
  isLatest: boolean;
  /** Content-addressed dedup key — SHA-256 of (youtubeId, PIPELINE_VERSION,
   *  providers, version). Used by `upsertCacheByDedupKey` to collapse
   *  cross-user submissions for the same content onto a single cache row.
   *  Legacy rows pre-Step-1 lack this field; the unique index is partial on
   *  `{$exists: true}` so they coexist until the backfill catches them. */
  dedupKey?: string;
  retryCount: number;
  errorCode?: string;
  errorMessage?: string;
  /** Timestamp of the most recent successful dispatch-guard release. Set by
   *  `tryClaimDispatchRelease` so duplicate FAILED events (from summarizer
   *  status-callback retries) become a no-op instead of racing to blind-DEL a
   *  freshly-acquired lock. Not user-facing. */
  dispatchGuardReleasedAt?: Date;
  processedAt?: Date;
  processingTimeMs?: number;
  createdAt: Date;
  updatedAt: Date;
  // Share fields (V1.4)
  shareSlug?: string;
  sharedAt?: Date;
  viewsCount?: number;
  likesCount?: number;
  // Expiration (V1.4)
  expiresAt?: Date | null;
  // Pipeline output fields
  // Canonical version stamp written by the summarizer at pipeline write time
  // (packages/shared/src/config/pipeline-version.json). Absent on docs that
  // predate stamping — those are treated as current-legacy and served as-is;
  // a mismatching stamp triggers regen in video.service.ts.isStaleVersion.
  pipelineVersion?: string;
  intent?: unknown;
  triage?: unknown;
  output?: unknown;
  enrichment?: unknown;
  synthesis?: unknown;
  // New clean shape (v3)
  creator?: string;
  meta?: unknown;
  tabs?: unknown[];
  pipeline?: unknown;
  // Legacy v2 (backward compat reads)
  assembledMeta?: unknown;
  assembledTabs?: unknown[];
}

export interface UserVideoDocument {
  _id: ObjectId;
  userId: ObjectId;
  videoSummaryId: ObjectId;
  youtubeId: string;
  title?: string;
  channel?: string;
  duration?: number;
  thumbnailUrl?: string;
  status: string;
  folderId: ObjectId | null;
  playlistInfo?: {
    playlistId: string;
    playlistTitle: string;
    position: number;
    totalVideos: number;
  };
  addedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateVideoSummaryData {
  youtubeId: string;
  url: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  version: number;
  isLatest: boolean;
  retryCount: number;
  expiresAt?: Date;
  /** Optional on the input shape so legacy callers compile during migration.
   *  Required for `upsertCacheByDedupKey` (enforced at the method signature). */
  dedupKey?: string;
}

export interface CreateUserVideoData {
  userId: string;
  videoSummaryId: string;
  youtubeId: string;
  title?: string;
  channel?: string;
  duration?: number;
  thumbnailUrl?: string;
  status: string;
  folderId?: string | null;
}

export class VideoRepository {
  private readonly cacheCollection: Collection<VideoSummaryCacheDocument>;
  private readonly userVideosCollection: Collection<UserVideoDocument>;

  constructor(db: Db) {
    this.cacheCollection = db.collection('videoSummaryCache');
    this.userVideosCollection = db.collection('userVideos');
  }

  // Video Summary Cache methods

  async findCacheByYoutubeId(youtubeId: string, latestOnly = true): Promise<VideoSummaryCacheDocument | null> {
    const query: Record<string, unknown> = { youtubeId };
    if (latestOnly) {
      query.isLatest = true;
    }
    return this.cacheCollection.findOne(query);
  }

  async findCacheById(id: string): Promise<VideoSummaryCacheDocument | null> {
    return this.cacheCollection.findOne({ _id: new ObjectId(id) });
  }

  async createCacheEntry(data: CreateVideoSummaryData): Promise<VideoSummaryCacheDocument> {
    const doc: Omit<VideoSummaryCacheDocument, '_id'> = {
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const result = await this.cacheCollection.insertOne(doc as VideoSummaryCacheDocument);
    return { ...doc, _id: result.insertedId } as VideoSummaryCacheDocument;
  }

  /**
   * Atomic content-addressed cache row upsert. Concurrent callers with the
   * same `dedupKey` collapse onto a single row via the partial unique index
   * on `videoSummaryCache.dedupKey`; exactly one caller sees `wasInsert: true`
   * and is responsible for dispatching the pipeline. The rest get the existing
   * row back (`wasInsert: false`) and attach to its in-flight or completed
   * state.
   *
   * Uses `$setOnInsert` so a late submitter cannot stomp the original row's
   * `url`, `status`, or any other field — the row's state is owned by the
   * original winner and the in-progress pipeline.
   */
  async upsertCacheByDedupKey(
    data: CreateVideoSummaryData & { dedupKey: string },
  ): Promise<{ doc: VideoSummaryCacheDocument; wasInsert: boolean }> {
    const now = new Date();
    const insertDoc: Omit<VideoSummaryCacheDocument, '_id'> = {
      ...data,
      createdAt: now,
      updatedAt: now,
    };

    const result = await this.cacheCollection.findOneAndUpdate(
      { dedupKey: data.dedupKey },
      { $setOnInsert: insertDoc },
      {
        upsert: true,
        returnDocument: 'after',
        includeResultMetadata: true,
      },
    );

    // With upsert: true + returnDocument: 'after', the driver always returns
    // a doc. `lastErrorObject.updatedExisting` discriminates: false on insert,
    // true on attach. `upserted` (an ObjectId when inserted) is the secondary
    // signal — we prefer `updatedExisting` because it's typed more explicitly.
    const wasInsert = result.lastErrorObject?.updatedExisting === false;
    if (!result.value) {
      // Should be unreachable with upsert: true + returnDocument: 'after',
      // but the driver types mark `value` optional so we guard explicitly.
      // DatabaseError → mapped to a 500 by the global error handler, not a
      // raw Error which leaks "Error" as the name in logs / Sentry breadcrumbs.
      throw new DatabaseError('upsertCacheByDedupKey: driver returned no document despite upsert');
    }
    return { doc: result.value, wasInsert };
  }

  /**
   * Force-unset the TTL on a cache row. Called when a pro/team user attaches
   * to a row originally created by a free-tier user — without this, MongoDB's
   * TTL index would hard-delete the row 30 days later and break the paid
   * user's video. Pre-cross-user-dedup, each user owned their own row so the
   * inserter's tier was the only voice; now the most-privileged attacher
   * upgrades the row for everyone.
   */
  async clearExpiresAt(id: string): Promise<void> {
    await this.cacheCollection.updateOne(
      { _id: new ObjectId(id) },
      { $unset: { expiresAt: '' }, $set: { updatedAt: new Date() } },
    );
  }

  async updateCacheEntry(id: string, updates: Partial<VideoSummaryCacheDocument>): Promise<void> {
    await this.cacheCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { ...updates, updatedAt: new Date() } }
    );
  }

  async markPreviousVersionsNotLatest(youtubeId: string): Promise<VideoSummaryCacheDocument | null> {
    return this.cacheCollection.findOneAndUpdate(
      { youtubeId, isLatest: true },
      { $set: { isLatest: false, updatedAt: new Date() } },
      { returnDocument: 'before' }
    );
  }

  async findHighestVersion(youtubeId: string): Promise<VideoSummaryCacheDocument | null> {
    return this.cacheCollection.findOne(
      { youtubeId },
      { sort: { version: -1 }, projection: { version: 1 } }
    );
  }

  async incrementRetryCount(id: string): Promise<void> {
    await this.cacheCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        // Bumping retryCount means a fresh dispatch is about to run, so
        // reset the release marker — a future FAILED for THIS run should be
        // free to claim release. The `$unset` is harmless on rows that have
        // never set the field.
        $set: { status: 'pending', updatedAt: new Date() },
        $unset: { dispatchGuardReleasedAt: '' },
        $inc: { retryCount: 1 },
      }
    );
  }

  /**
   * Atomically claim the right to release the dispatch guard for a FAILED
   * cache row. Returns `true` exactly once per terminal-failure transition —
   * subsequent duplicate FAILED events from summarizer status-callback
   * retries see `false` and correctly skip releasing the Redis lock.
   *
   * Two gates:
   *   1. `status: 'failed'` — if a user-driven retry has already flipped the
   *      row back to `pending`/`processing`, the stale FAILED event is a
   *      no-op. Without this, a late-arriving FAILED could clear a fresh
   *      dispatch's Redis lock (a duplicate-event manifestation of the
   *      retry-between-events race).
   *   2. `$expr: lt(dispatchGuardReleasedAt, updatedAt)` — the most recent
   *      `updatedAt` change came from the summarizer writing `status=failed`
   *      (the trigger for this FAILED event). If we already marked released
   *      AFTER that updatedAt, this is a duplicate event from the same
   *      failure. `dispatchGuardReleasedAt` missing OR strictly older than
   *      `updatedAt` ⇒ first-event semantics.
   *
   * Residual race (irreducible without summarizer-side cooperation): between
   * THIS update committing and the caller's Redis release running,
   * `createVideo`'s failed-retry branch could acquire a new lock. The
   * subsequent release would then wipe the new lock. The summarizer's per-
   * `video_summary_id` pipeline lock at
   * `services/summarizer/src/services/cache/pipeline_event_stream.py` is the
   * documented last line of defense for that microsecond window.
   */
  async tryClaimDispatchRelease(id: string): Promise<boolean> {
    const result = await this.cacheCollection.findOneAndUpdate(
      {
        _id: new ObjectId(id),
        status: 'failed',
        $or: [
          { dispatchGuardReleasedAt: { $exists: false } },
          { $expr: { $lt: ['$dispatchGuardReleasedAt', '$updatedAt'] } },
        ],
      },
      { $set: { dispatchGuardReleasedAt: new Date() } },
      { returnDocument: 'after', projection: { _id: 1 } },
    );
    return !!result;
  }

  async getVersions(youtubeId: string, limit: number): Promise<VideoSummaryCacheDocument[]> {
    return this.cacheCollection
      .find({ youtubeId })
      .project({
        _id: 1,
        youtubeId: 1,
        version: 1,
        isLatest: 1,
        status: 1,
        title: 1,
        channel: 1,
        duration: 1,
        thumbnailUrl: 1,
        createdAt: 1,
        processedAt: 1,
        processingTimeMs: 1,
        errorCode: 1,
        errorMessage: 1,
      })
      .sort({ version: -1 })
      .limit(limit)
      .toArray() as Promise<VideoSummaryCacheDocument[]>;
  }

  async deleteOldVersions(youtubeId: string, keepAfterVersion: number): Promise<void> {
    const toDelete = await this.cacheCollection
      .find({ youtubeId, version: { $lt: keepAfterVersion } })
      .project({ _id: 1 })
      .toArray();

    if (toDelete.length > 0) {
      await this.cacheCollection.deleteMany({
        _id: { $in: toDelete.map(v => v._id) }
      });
    }
  }

  // User Videos methods

  async findUserVideo(userId: string, videoId: string): Promise<UserVideoDocument | null> {
    return this.userVideosCollection.findOne({
      _id: new ObjectId(videoId),
      userId: new ObjectId(userId),
    });
  }

  async findUserVideoByYoutubeId(userId: string, youtubeId: string, folderId?: string | null): Promise<UserVideoDocument | null> {
    const query: Record<string, unknown> = {
      userId: new ObjectId(userId),
      youtubeId,
    };
    if (folderId !== undefined) {
      query.folderId = folderId ? new ObjectId(folderId) : null;
    }
    return this.userVideosCollection.findOne(query);
  }

  async createUserVideo(data: CreateUserVideoData): Promise<UserVideoDocument> {
    const doc: Omit<UserVideoDocument, '_id'> = {
      userId: new ObjectId(data.userId),
      videoSummaryId: new ObjectId(data.videoSummaryId),
      youtubeId: data.youtubeId,
      title: data.title,
      channel: data.channel,
      duration: data.duration,
      thumbnailUrl: data.thumbnailUrl,
      status: data.status,
      folderId: data.folderId ? new ObjectId(data.folderId) : null,
      addedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const result = await this.userVideosCollection.insertOne(doc as UserVideoDocument);
    return { ...doc, _id: result.insertedId } as UserVideoDocument;
  }

  async deleteUserVideo(userId: string, videoId: string): Promise<boolean> {
    const result = await this.userVideosCollection.deleteOne({
      _id: new ObjectId(videoId),
      userId: new ObjectId(userId),
    });
    return result.deletedCount > 0;
  }

  async deleteUserVideoByYoutubeId(userId: string, youtubeId: string, folderId?: string | null): Promise<void> {
    const query: Record<string, unknown> = {
      userId: new ObjectId(userId),
      youtubeId,
    };
    if (folderId !== undefined) {
      query.folderId = folderId ? new ObjectId(folderId) : null;
    }
    await this.userVideosCollection.deleteOne(query);
  }

  async updateUserVideoFolder(userId: string, videoId: string, folderId: string | null): Promise<boolean> {
    const result = await this.userVideosCollection.updateOne(
      {
        _id: new ObjectId(videoId),
        userId: new ObjectId(userId),
      },
      {
        $set: {
          folderId: folderId ? new ObjectId(folderId) : null,
          updatedAt: new Date(),
        },
      }
    );
    return result.matchedCount > 0;
  }

  async getUserVideos(
    userId: string,
    folderId?: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<Array<UserVideoDocument & { cache?: VideoSummaryCacheDocument }>> {
    const { limit = 50, offset = 0 } = options;
    const matchStage: Record<string, unknown> = { userId: new ObjectId(userId) };
    if (folderId) {
      matchStage.folderId = new ObjectId(folderId);
    }

    return this.userVideosCollection.aggregate([
      { $match: matchStage },
      { $sort: { createdAt: -1 } },
      { $skip: offset },
      { $limit: limit },
      {
        $lookup: {
          from: 'videoSummaryCache',
          localField: 'videoSummaryId',
          foreignField: '_id',
          as: 'cache',
        },
      },
      { $unwind: { path: '$cache', preserveNullAndEmptyArrays: true } },
    ]).toArray() as Promise<Array<UserVideoDocument & { cache?: VideoSummaryCacheDocument }>>;
  }

  async countUserVideos(userId: string, folderId?: string): Promise<number> {
    const query: Record<string, unknown> = { userId: new ObjectId(userId) };
    if (folderId) {
      query.folderId = new ObjectId(folderId);
    }
    return this.userVideosCollection.countDocuments(query);
  }

  async userOwnsVideo(userId: string, youtubeId: string): Promise<boolean> {
    const video = await this.userVideosCollection.findOne({
      userId: new ObjectId(userId),
      youtubeId,
    });
    return !!video;
  }

  async userHasAccessToSummary(userId: string, videoSummaryId: string): Promise<boolean> {
    const video = await this.userVideosCollection.findOne({
      userId: new ObjectId(userId),
      videoSummaryId: new ObjectId(videoSummaryId),
    });
    return !!video;
  }

  async updateUserVideoPlaylistInfo(videoId: string, playlistInfo: UserVideoDocument['playlistInfo']): Promise<void> {
    await this.userVideosCollection.updateOne(
      { _id: new ObjectId(videoId) },
      { $set: { playlistInfo, updatedAt: new Date() } }
    );
  }

  /** Clear expiresAt for all videos owned by a user (tier upgrade to pro/team) */
  async clearExpirationForUser(userId: string): Promise<number> {
    // Find all videoSummaryIds for user, then clear expiresAt on cache entries
    const userVideos = await this.userVideosCollection
      .find({ userId: new ObjectId(userId) })
      .project({ videoSummaryId: 1 })
      .toArray();

    if (userVideos.length === 0) return 0;

    const summaryIds = userVideos.map(v => v.videoSummaryId);
    const result = await this.cacheCollection.updateMany(
      { _id: { $in: summaryIds } },
      { $unset: { expiresAt: '' }, $set: { updatedAt: new Date() } }
    );
    return result.modifiedCount;
  }

  /** Set expiresAt for non-shared, post-downgrade videos owned by a user (tier downgrade to free).
   *
   * Grandfathering: only outputs created AFTER `afterDate` get a TTL.
   * Pre-downgrade outputs keep no expiration — the user earned them while on a paid plan.
   * Shared outputs never expire — growth driver (SEO, viral loops).
   */
  async setExpirationForUser(userId: string, expiresAt: Date, afterDate?: Date): Promise<number> {
    const userVideos = await this.userVideosCollection
      .find({ userId: new ObjectId(userId) })
      .project({ videoSummaryId: 1 })
      .toArray();

    if (userVideos.length === 0) return 0;

    const summaryIds = userVideos.map(v => v.videoSummaryId);
    const filter: Record<string, unknown> = {
      _id: { $in: summaryIds },
      // Shared outputs never expire — growth driver (SEO, viral loops)
      shareSlug: { $exists: false },
    };

    // Grandfather existing outputs: only expire those created after the downgrade date
    if (afterDate) {
      filter.createdAt = { $gte: afterDate };
    }

    const result = await this.cacheCollection.updateMany(
      filter,
      { $set: { expiresAt, updatedAt: new Date() } }
    );
    return result.modifiedCount;
  }

  async getPlaylistVideos(userId: string, playlistId: string): Promise<UserVideoDocument[]> {
    return this.userVideosCollection
      .find({
        userId: new ObjectId(userId),
        'playlistInfo.playlistId': playlistId,
      })
      .sort({ 'playlistInfo.position': 1 })
      .toArray();
  }

  // ─── Pipeline output methods ───

  async updateTriage(id: string, triage: unknown): Promise<void> {
    await this.cacheCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { triage, updatedAt: new Date() } },
    );
  }

  async updateOutput(id: string, output: unknown): Promise<void> {
    await this.cacheCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { output, updatedAt: new Date() } },
    );
  }

  async updateSynthesis(id: string, synthesis: unknown): Promise<void> {
    await this.cacheCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { synthesis, updatedAt: new Date() } },
    );
  }

  async updateEnrichment(id: string, enrichment: unknown): Promise<void> {
    await this.cacheCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { enrichment, updatedAt: new Date() } },
    );
  }

  // ─── v2: Assembly methods ───

  async updateAssembledMeta(id: string, meta: unknown): Promise<void> {
    await this.cacheCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { assembledMeta: meta, assembledTabs: [], updatedAt: new Date() } },
    );
  }

  async appendAssembledTab(id: string, tab: unknown): Promise<void> {
    return this.appendAssembledTabs(id, [tab]);
  }

  async appendAssembledTabs(id: string, tabs: unknown[]): Promise<void> {
    if (tabs.length === 0) return;
    const MAX_TABS = 30;
    const result = await this.cacheCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $push: { assembledTabs: { $each: tabs, $slice: -MAX_TABS } } as Record<string, unknown>,
        $set: { updatedAt: new Date() },
      },
    );
    if (result.modifiedCount === 0) {
      throw new Error(`appendAssembledTabs: no document matched id=${id}`);
    }
  }

}
