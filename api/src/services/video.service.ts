import { Db, ObjectId } from 'mongodb';
import { extractYoutubeId } from '../utils/youtube.js';
import { triggerSummarization, type ProviderConfig } from './summarizer-client.js';
import { InvalidYouTubeUrlError, VideoNotFoundError, VersionCreationError } from '../utils/errors.js';

// Logger for debugging (uses console in dev, can be replaced with proper logger)
const logger = {
  error: (msg: string, context?: unknown) => console.error(`[VideoService] ${msg}`, context),
  warn: (msg: string, context?: unknown) => console.warn(`[VideoService] ${msg}`, context),
};

// Maximum versions to keep per video (prevents unbounded storage growth)
const MAX_VERSIONS_PER_VIDEO = 5;

export class VideoService {
  constructor(private db: Db) {}

  async createVideo(userId: string, url: string, folderId?: string, bypassCache = false, providers?: ProviderConfig) {
    const youtubeId = extractYoutubeId(url);
    if (!youtubeId) {
      throw new InvalidYouTubeUrlError();
    }

    // Handle cache bypass - create new version instead of deleting (for A/B testing prompts)
    // Uses atomic findOneAndUpdate to avoid transaction requirement (works with standalone MongoDB)
    if (bypassCache) {
      try {
        // 1. Atomically find and mark old version as not latest
        const previousLatest = await this.db.collection('videoSummaryCache').findOneAndUpdate(
          { youtubeId, isLatest: true },
          { $set: { isLatest: false, updatedAt: new Date() } },
          { returnDocument: 'before' }
        );

        // Determine new version number
        let newVersion: number;
        let previousVersion: number | undefined;

        if (previousLatest) {
          // Had a latest version, use it to determine new version
          newVersion = (previousLatest.version || 1) + 1;
          previousVersion = previousLatest.version || 1;
        } else {
          // No isLatest found - check if any versions exist (edge case: orphaned versions)
          const highestVersion = await this.db.collection('videoSummaryCache')
            .findOne({ youtubeId }, { sort: { version: -1 }, projection: { version: 1 } });

          if (highestVersion) {
            // Orphaned versions exist, create next version
            newVersion = (highestVersion.version || 1) + 1;
            previousVersion = highestVersion.version || 1;
          } else {
            // No existing versions at all, fall through to normal flow
            // (This allows normal cache logic to handle it)
          }
        }

        // Only proceed if we determined a version to create
        if (newVersion! > 0) {
          // 2. Create new version entry
          const cacheEntry = await this.db.collection('videoSummaryCache').insertOne({
            youtubeId,
            url,
            status: 'pending',
            version: newVersion!,
            isLatest: true,
            retryCount: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          // 3. Delete user's old video entry so they get the new version
          await this.db.collection('userVideos').deleteOne({
            userId: new ObjectId(userId),
            youtubeId,
            folderId: folderId ? new ObjectId(folderId) : null,
          });

          // 4. Create new user video entry
          const userVideo = await this.db.collection('userVideos').insertOne({
            userId: new ObjectId(userId),
            videoSummaryId: cacheEntry.insertedId,
            youtubeId,
            status: 'pending',
            folderId: folderId ? new ObjectId(folderId) : null,
            addedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          // 5. Cleanup old versions (non-blocking to avoid slowing down the request)
          this.cleanupOldVersions(youtubeId, newVersion!).catch(err => {
            logger.warn('Failed to cleanup old versions', { youtubeId, error: err });
          });

          // 6. Trigger summarization
          triggerSummarization({
            videoSummaryId: cacheEntry.insertedId.toString(),
            youtubeId,
            url,
            userId,
            providers,
          });

          return {
            video: {
              id: userVideo.insertedId.toString(),
              videoSummaryId: cacheEntry.insertedId.toString(),
              youtubeId,
              status: 'pending',
              version: newVersion!,
              previousVersion,
            },
            cached: false,
            newVersion: true,
          };
        }
        // If no existing versions, fall through to normal flow
      } catch (error) {
        // Handle duplicate key error (race condition where two requests try to create same version)
        if (error instanceof Error && 'code' in error && (error as { code: number }).code === 11000) {
          throw new VersionCreationError('Version conflict - please retry');
        }
        // Log and rethrow other errors
        logger.error('Failed in bypassCache version creation', {
          youtubeId,
          userId,
          error: error instanceof Error ? error.message : String(error),
        });
        throw new VersionCreationError();
      }
    }

    // Check if user already has this video in this folder (skip if bypassCache)
    if (!bypassCache) {
      const existingInFolder = await this.db.collection('userVideos').findOne({
        userId: new ObjectId(userId),
        youtubeId,
        folderId: folderId ? new ObjectId(folderId) : null,
      });

      if (existingInFolder) {
        // Already exists in this folder - return existing
        const summary = await this.db.collection('videoSummaryCache').findOne({
          _id: existingInFolder.videoSummaryId,
        });
        return {
          video: {
            id: existingInFolder._id.toString(),
            videoSummaryId: existingInFolder.videoSummaryId.toString(),
            youtubeId,
            title: summary?.title || existingInFolder.title,
            channel: summary?.channel || existingInFolder.channel,
            duration: summary?.duration || existingInFolder.duration,
            thumbnailUrl: summary?.thumbnailUrl || existingInFolder.thumbnailUrl,
            status: summary?.status || existingInFolder.status,
          },
          cached: true,
          alreadyExists: true,
        };
      }
    }

    // Check cache (latest version only)
    const cached = await this.db.collection('videoSummaryCache').findOne({
      youtubeId,
      isLatest: true
    });

    if (cached?.status === 'completed') {
      // Cache HIT
      const userVideo = await this.db.collection('userVideos').insertOne({
        userId: new ObjectId(userId),
        videoSummaryId: cached._id,
        youtubeId,
        title: cached.title,
        channel: cached.channel,
        duration: cached.duration,
        thumbnailUrl: cached.thumbnailUrl,
        status: 'completed',
        folderId: folderId ? new ObjectId(folderId) : null,
        addedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      return {
        video: { id: userVideo.insertedId.toString(), status: 'completed', ...cached },
        cached: true,
      };
    }

    if (cached?.status === 'processing' || cached?.status === 'pending') {
      // Already processing or pending
      const userVideo = await this.db.collection('userVideos').insertOne({
        userId: new ObjectId(userId),
        videoSummaryId: cached._id,
        youtubeId,
        status: cached.status,
        folderId: folderId ? new ObjectId(folderId) : null,
        addedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      return {
        video: { id: userVideo.insertedId.toString(), status: cached.status },
        cached: false,
      };
    }

    if (cached?.status === 'failed') {
      // Previous attempt failed - retry summarization
      await this.db.collection('videoSummaryCache').updateOne(
        { _id: cached._id },
        {
          $set: {
            status: 'pending',
            updatedAt: new Date(),
          },
          $inc: { retryCount: 1 },
        }
      );

      triggerSummarization({
        videoSummaryId: cached._id.toString(),
        youtubeId,
        url,
        userId,
        providers,
      });

      const userVideo = await this.db.collection('userVideos').insertOne({
        userId: new ObjectId(userId),
        videoSummaryId: cached._id,
        youtubeId,
        status: 'pending',
        folderId: folderId ? new ObjectId(folderId) : null,
        addedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      return {
        video: { id: userVideo.insertedId.toString(), status: 'pending' },
        cached: false,
      };
    }

    // Cache MISS - create entry and trigger summarization via HTTP
    const cacheEntry = await this.db.collection('videoSummaryCache').insertOne({
      youtubeId,
      url,
      status: 'pending',
      version: 1,
      isLatest: true,
      retryCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Trigger summarization via HTTP (fire and forget)
    triggerSummarization({
      videoSummaryId: cacheEntry.insertedId.toString(),
      youtubeId,
      url,
      userId,
      providers,
    });

    const userVideo = await this.db.collection('userVideos').insertOne({
      userId: new ObjectId(userId),
      videoSummaryId: cacheEntry.insertedId,
      youtubeId,
      status: 'pending',
      folderId: folderId ? new ObjectId(folderId) : null,
      addedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return {
      video: {
        id: userVideo.insertedId.toString(),
        videoSummaryId: cacheEntry.insertedId.toString(),
        youtubeId,
        status: 'pending',
      },
      cached: false,
    };
  }

  async getVideos(
    userId: string,
    folderId?: string,
    options: { limit?: number; offset?: number } = {}
  ) {
    const { limit = 50, offset = 0 } = options;
    const matchStage: Record<string, unknown> = { userId: new ObjectId(userId) };
    if (folderId) {
      matchStage.folderId = new ObjectId(folderId);
    }

    // Join with videoSummaryCache to get title/channel/thumbnailUrl
    const videos = await this.db.collection('userVideos').aggregate([
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
    ]).toArray();

    return videos.map(v => ({
      id: v._id.toString(),
      videoSummaryId: v.videoSummaryId.toString(),
      youtubeId: v.youtubeId,
      title: v.title || v.cache?.title,
      channel: v.channel || v.cache?.channel,
      duration: v.duration || v.cache?.duration,
      thumbnailUrl: v.thumbnailUrl || v.cache?.thumbnailUrl,
      status: v.cache?.status || v.status,
      folderId: v.folderId?.toString() || null,
      createdAt: v.createdAt.toISOString(),
    }));
  }

  async getVideo(userId: string, videoId: string) {
    const video = await this.db.collection('userVideos').findOne({
      _id: new ObjectId(videoId),
      userId: new ObjectId(userId),
    });

    if (!video) {
      throw new VideoNotFoundError();
    }

    const summary = await this.db.collection('videoSummaryCache').findOne({
      _id: video.videoSummaryId,
    });

    return {
      video: {
        id: video._id.toString(),
        videoSummaryId: video.videoSummaryId.toString(),
        youtubeId: video.youtubeId,
        title: video.title || summary?.title,
        channel: video.channel || summary?.channel,
        duration: video.duration || summary?.duration,
        thumbnailUrl: video.thumbnailUrl || summary?.thumbnailUrl,
        status: summary?.status || video.status,
        folderId: video.folderId?.toString() || null,
        // Progressive summarization fields
        chapters: summary?.chapters || null,
        chapterSource: summary?.chapterSource || null,
        descriptionAnalysis: summary?.descriptionAnalysis || null,
        // Video context for persona-aware rendering
        context: summary?.context || null,
      },
      summary: summary?.summary || null,
    };
  }

  async deleteVideo(userId: string, videoId: string) {
    const result = await this.db.collection('userVideos').deleteOne({
      _id: new ObjectId(videoId),
      userId: new ObjectId(userId),
    });

    if (result.deletedCount === 0) {
      throw new VideoNotFoundError();
    }
  }

  async moveToFolder(userId: string, videoId: string, folderId: string | null) {
    const result = await this.db.collection('userVideos').updateOne(
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

    if (result.matchedCount === 0) {
      throw new VideoNotFoundError();
    }

    return { success: true };
  }

  // Check if user owns a video with this youtubeId
  async userOwnsVideo(userId: string, youtubeId: string): Promise<boolean> {
    const video = await this.db.collection('userVideos').findOne({
      userId: new ObjectId(userId),
      youtubeId,
    });
    return !!video;
  }

  /**
   * Get all versions of a video summary for A/B comparison.
   * Returns metadata only (not full summary content) to limit data exposure.
   */
  async getVersions(youtubeId: string, options: { limit?: number } = {}) {
    const { limit = 10 } = options;
    // Server-side validation: enforce bounds regardless of input
    const safeLimit = Math.min(Math.max(1, limit), 50);

    // Use projection to exclude large fields (summary, transcript)
    const versions = await this.db.collection('videoSummaryCache')
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
        // Explicitly exclude: summary, transcript (large fields)
      })
      .sort({ version: -1 })
      .limit(safeLimit)
      .toArray();

    return versions.map(v => ({
      id: v._id.toString(),
      youtubeId: v.youtubeId,
      version: v.version || 1,
      isLatest: v.isLatest ?? true,
      status: v.status,
      title: v.title,
      channel: v.channel,
      duration: v.duration,
      thumbnailUrl: v.thumbnailUrl,
      createdAt: v.createdAt?.toISOString(),
      processedAt: v.processedAt?.toISOString(),
      processingTimeMs: v.processingTimeMs,
      errorCode: v.errorCode,
      errorMessage: v.errorMessage,
    }));
  }

  /**
   * Cleanup old versions to prevent unbounded storage growth.
   * Keeps only MAX_VERSIONS_PER_VIDEO most recent versions.
   * Called asynchronously after version creation.
   */
  private async cleanupOldVersions(youtubeId: string, currentVersion: number): Promise<void> {
    if (currentVersion <= MAX_VERSIONS_PER_VIDEO) return;

    const toDelete = await this.db.collection('videoSummaryCache')
      .find({ youtubeId, version: { $lt: currentVersion - MAX_VERSIONS_PER_VIDEO + 1 } })
      .project({ _id: 1 })
      .toArray();

    if (toDelete.length > 0) {
      await this.db.collection('videoSummaryCache').deleteMany({
        _id: { $in: toDelete.map(v => v._id) }
      });
    }
  }
}
