import { Db, ObjectId, Collection } from 'mongodb';

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
  version: number;
  isLatest: boolean;
  retryCount: number;
  errorCode?: string;
  errorMessage?: string;
  processedAt?: Date;
  processingTimeMs?: number;
  createdAt: Date;
  updatedAt: Date;
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
        $set: { status: 'pending', updatedAt: new Date() },
        $inc: { retryCount: 1 },
      }
    );
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

  async getPlaylistVideos(userId: string, playlistId: string): Promise<UserVideoDocument[]> {
    return this.userVideosCollection
      .find({
        userId: new ObjectId(userId),
        'playlistInfo.playlistId': playlistId,
      })
      .sort({ 'playlistInfo.position': 1 })
      .toArray();
  }
}
