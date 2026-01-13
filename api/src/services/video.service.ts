import { Db, ObjectId } from 'mongodb';
import { extractYoutubeId } from '../utils/youtube.js';
import { triggerSummarization } from './summarizer-client.js';
import { InvalidYouTubeUrlError, VideoNotFoundError } from '../utils/errors.js';

export class VideoService {
  constructor(private db: Db) {}

  async createVideo(userId: string, url: string, folderId?: string) {
    const youtubeId = extractYoutubeId(url);
    if (!youtubeId) {
      throw new InvalidYouTubeUrlError();
    }

    // Check cache
    const cached = await this.db.collection('videoSummaryCache').findOne({ youtubeId });

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
          $set: { status: 'pending', updatedAt: new Date() },
          $inc: { retryCount: 1 },
        }
      );

      triggerSummarization({
        videoSummaryId: cached._id.toString(),
        youtubeId,
        url,
        userId,
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
}
