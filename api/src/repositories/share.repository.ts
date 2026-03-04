import { Db, ObjectId, Collection } from 'mongodb';
import type { VideoSummaryCacheDocument } from './video.repository.js';

export interface ShareLikeDocument {
  _id: ObjectId;
  shareSlug: string;
  ipHash: string;
  createdAt: Date;
}

/** TTL collection for view dedup — 24h window per IP per slug */
export interface ShareViewDocument {
  _id: ObjectId;
  shareSlug: string;
  ipHash: string;
  viewedAt: Date;  // TTL index: expireAfterSeconds: 86400
}

export class ShareRepository {
  private readonly cacheCollection: Collection<VideoSummaryCacheDocument>;
  private readonly likesCollection: Collection<ShareLikeDocument>;
  private readonly viewsCollection: Collection<ShareViewDocument>;

  constructor(db: Db) {
    this.cacheCollection = db.collection('videoSummaryCache');
    this.likesCollection = db.collection('shareLikes');
    this.viewsCollection = db.collection('shareViews');
  }

  async findBySlug(slug: string): Promise<VideoSummaryCacheDocument | null> {
    return this.cacheCollection.findOne({ shareSlug: slug });
  }

  /** Atomically set share fields only if not already shared (prevents race condition) */
  async markAsShared(videoSummaryId: string, slug: string): Promise<boolean> {
    const result = await this.cacheCollection.findOneAndUpdate(
      { _id: new ObjectId(videoSummaryId), shareSlug: { $exists: false } },
      {
        $set: {
          shareSlug: slug,
          sharedAt: new Date(),
          viewsCount: 0,
          likesCount: 0,
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' }
    );
    return !!result;
  }

  /** Increment views only if this IP hasn't viewed in the last 24h (dedup via TTL collection) */
  async incrementViewsDedup(slug: string, ipHash: string): Promise<void> {
    try {
      // Try to insert — unique compound index { shareSlug, ipHash } prevents dups within TTL window
      await this.viewsCollection.insertOne({
        _id: new ObjectId(),
        shareSlug: slug,
        ipHash,
        viewedAt: new Date(),
      });
      // New view — increment counter
      await this.cacheCollection.updateOne(
        { shareSlug: slug },
        { $inc: { viewsCount: 1 } },
      );
    } catch (err: unknown) {
      if ((err as { code?: number }).code === 11000) {
        // Duplicate view within 24h window — skip increment
        return;
      }
      throw err;
    }
  }

  async hasLiked(slug: string, ipHash: string): Promise<boolean> {
    const existing = await this.likesCollection.findOne({ shareSlug: slug, ipHash });
    return !!existing;
  }

  /** Add a like, handling duplicate key gracefully via unique index */
  async addLike(slug: string, ipHash: string): Promise<number> {
    try {
      await this.likesCollection.insertOne({
        _id: new ObjectId(),
        shareSlug: slug,
        ipHash,
        createdAt: new Date(),
      });
    } catch (err: unknown) {
      if ((err as { code?: number }).code === 11000) {
        // Already liked — return current count
        const doc = await this.cacheCollection.findOne(
          { shareSlug: slug },
          { projection: { likesCount: 1 } }
        );
        return doc?.likesCount ?? 0;
      }
      throw err;
    }

    const result = await this.cacheCollection.findOneAndUpdate(
      { shareSlug: slug },
      { $inc: { likesCount: 1 } },
      { returnDocument: 'after', projection: { likesCount: 1 } }
    );

    return result?.likesCount ?? 0;
  }

  async getShareInfo(videoSummaryId: string): Promise<{
    shareSlug: string;
    sharedAt: Date;
    viewsCount: number;
    likesCount: number;
  } | null> {
    const doc = await this.cacheCollection.findOne(
      { _id: new ObjectId(videoSummaryId), shareSlug: { $exists: true } },
      { projection: { shareSlug: 1, sharedAt: 1, viewsCount: 1, likesCount: 1 } }
    );

    if (!doc?.shareSlug) return null;

    return {
      shareSlug: doc.shareSlug,
      sharedAt: doc.sharedAt || new Date(),
      viewsCount: doc.viewsCount ?? 0,
      likesCount: doc.likesCount ?? 0,
    };
  }
}
