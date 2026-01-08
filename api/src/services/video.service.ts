import { Db, ObjectId } from 'mongodb';
import { extractYoutubeId } from '../utils/youtube.js';
import { triggerSummarization } from './summarizer-client.js';

export class VideoService {
  constructor(private db: Db) {}

  async createVideo(userId: string, url: string, folderId?: string) {
    const youtubeId = extractYoutubeId(url);
    if (!youtubeId) {
      throw { code: 'INVALID_YOUTUBE_URL', status: 400 };
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

    if (cached?.status === 'processing') {
      // Already processing
      const userVideo = await this.db.collection('userVideos').insertOne({
        userId: new ObjectId(userId),
        videoSummaryId: cached._id,
        youtubeId,
        status: 'processing',
        folderId: folderId ? new ObjectId(folderId) : null,
        addedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      return {
        video: { id: userVideo.insertedId.toString(), status: 'processing' },
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

  async getVideos(userId: string, folderId?: string) {
    const query: Record<string, unknown> = { userId: new ObjectId(userId) };
    if (folderId) {
      query.folderId = new ObjectId(folderId);
    }

    const videos = await this.db.collection('userVideos')
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    return videos.map(v => ({
      id: v._id.toString(),
      videoSummaryId: v.videoSummaryId.toString(),
      youtubeId: v.youtubeId,
      title: v.title,
      channel: v.channel,
      duration: v.duration,
      thumbnailUrl: v.thumbnailUrl,
      status: v.status,
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
      throw { code: 'NOT_FOUND', status: 404 };
    }

    const summary = await this.db.collection('videoSummaryCache').findOne({
      _id: video.videoSummaryId,
    });

    return {
      video: {
        id: video._id.toString(),
        youtubeId: video.youtubeId,
        title: video.title || summary?.title,
        channel: video.channel || summary?.channel,
        duration: video.duration || summary?.duration,
        thumbnailUrl: video.thumbnailUrl || summary?.thumbnailUrl,
        status: video.status,
        folderId: video.folderId?.toString() || null,
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
      throw { code: 'NOT_FOUND', status: 404 };
    }
  }
}
