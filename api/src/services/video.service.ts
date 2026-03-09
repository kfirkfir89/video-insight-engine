import { FastifyBaseLogger } from 'fastify';
import { VideoRepository, VideoSummaryCacheDocument } from '../repositories/video.repository.js';
import { SummarizerClient, type ProviderConfig } from './summarizer-client.js';
import { extractYoutubeId } from '../utils/youtube.js';
import { InvalidYouTubeUrlError, VideoNotFoundError, VersionCreationError, InvalidCategoryError } from '../utils/errors.js';
import { isValidOutputType } from '@vie/types';
import type { UserTier, OutputType } from '@vie/types';

export interface CreateVideoOptions {
  folderId?: string;
  bypassCache?: boolean;
  providers?: ProviderConfig;
  tier: UserTier;
}

// Maximum versions to keep per video (prevents unbounded storage growth)
const MAX_VERSIONS_PER_VIDEO = 5;

// Expiration TTLs by tier
const EXPIRATION_DAYS: Record<UserTier, number | null> = {
  free: 30,    // 30 days
  pro: null,   // Never expires
  team: null,  // Never expires
};

/** Calculate expiresAt date based on user tier. null = never. */
function calculateExpiresAt(tier: UserTier): Date | null {
  const days = EXPIRATION_DAYS[tier];
  if (days === null) return null;
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

export class VideoService {
  constructor(
    private readonly videoRepository: VideoRepository,
    private readonly summarizerClient: SummarizerClient,
    private readonly logger: FastifyBaseLogger
  ) {}

  async createVideo(userId: string, url: string, options: CreateVideoOptions) {
    const { folderId, bypassCache = false, providers, tier } = options;
    const youtubeId = extractYoutubeId(url);
    if (!youtubeId) {
      throw new InvalidYouTubeUrlError();
    }

    // Handle cache bypass - create new version instead of deleting (for A/B testing prompts)
    if (bypassCache) {
      try {
        // 1. Atomically find and mark old version as not latest
        const previousLatest = await this.videoRepository.markPreviousVersionsNotLatest(youtubeId);

        // Determine new version number
        let newVersion: number | undefined;
        let previousVersion: number | undefined;

        if (previousLatest) {
          // Had a latest version, use it to determine new version
          newVersion = (previousLatest.version || 1) + 1;
          previousVersion = previousLatest.version || 1;
        } else {
          // No isLatest found - check if any versions exist (edge case: orphaned versions)
          const highestVersion = await this.videoRepository.findHighestVersion(youtubeId);

          if (highestVersion) {
            // Orphaned versions exist, create next version
            newVersion = (highestVersion.version || 1) + 1;
            previousVersion = highestVersion.version || 1;
          }
        }

        // Only proceed if we determined a version to create
        if (newVersion && newVersion > 0) {
          // 2. Create new version entry
          const expiresAt = calculateExpiresAt(tier);
          const cacheEntry = await this.videoRepository.createCacheEntry({
            youtubeId,
            url,
            status: 'pending',
            version: newVersion,
            isLatest: true,
            retryCount: 0,
            ...(expiresAt && { expiresAt }),
          });

          // 3. Delete user's old video entry so they get the new version
          await this.videoRepository.deleteUserVideoByYoutubeId(userId, youtubeId, folderId);

          // 4. Create new user video entry
          const userVideo = await this.videoRepository.createUserVideo({
            userId,
            videoSummaryId: cacheEntry._id.toString(),
            youtubeId,
            status: 'pending',
            folderId,
          });

          // 5. Cleanup old versions (non-blocking to avoid slowing down the request)
          this.cleanupOldVersions(youtubeId, newVersion).catch(err => {
            this.logger.warn({ youtubeId, error: err }, 'Failed to cleanup old versions');
          });

          // 6. Trigger summarization
          this.summarizerClient.triggerSummarization({
            videoSummaryId: cacheEntry._id.toString(),
            youtubeId,
            url,
            userId,
            providers,
          });

          return {
            video: {
              id: userVideo._id.toString(),
              videoSummaryId: cacheEntry._id.toString(),
              youtubeId,
              status: 'pending',
              version: newVersion,
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
        this.logger.error({
          youtubeId,
          userId,
          error: error instanceof Error ? error.message : String(error),
        }, 'Failed in bypassCache version creation');
        throw new VersionCreationError();
      }
    }

    // Check if user already has this video in this folder (skip if bypassCache)
    if (!bypassCache) {
      const existingInFolder = await this.videoRepository.findUserVideoByYoutubeId(userId, youtubeId, folderId);

      if (existingInFolder) {
        // Already exists in this folder - return existing
        const summary = await this.videoRepository.findCacheById(existingInFolder.videoSummaryId.toString());
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
    const cached = await this.videoRepository.findCacheByYoutubeId(youtubeId, true);

    if (cached?.status === 'completed') {
      // Cache HIT
      const userVideo = await this.videoRepository.createUserVideo({
        userId,
        videoSummaryId: cached._id.toString(),
        youtubeId,
        title: cached.title,
        channel: cached.channel,
        duration: cached.duration,
        thumbnailUrl: cached.thumbnailUrl,
        status: 'completed',
        folderId,
      });

      return {
        video: {
          id: userVideo._id.toString(),
          videoSummaryId: cached._id.toString(),
          status: 'completed',
          ...this.toCacheResponse(cached),
        },
        cached: true,
      };
    }

    if (cached?.status === 'processing' || cached?.status === 'pending') {
      // Already processing or pending
      const userVideo = await this.videoRepository.createUserVideo({
        userId,
        videoSummaryId: cached._id.toString(),
        youtubeId,
        status: cached.status,
        folderId,
      });

      return {
        video: {
          id: userVideo._id.toString(),
          videoSummaryId: cached._id.toString(),
          status: cached.status,
        },
        cached: false,
      };
    }

    if (cached?.status === 'failed') {
      // Previous attempt failed - retry summarization
      await this.videoRepository.incrementRetryCount(cached._id.toString());

      this.summarizerClient.triggerSummarization({
        videoSummaryId: cached._id.toString(),
        youtubeId,
        url,
        userId,
        providers,
      });

      const userVideo = await this.videoRepository.createUserVideo({
        userId,
        videoSummaryId: cached._id.toString(),
        youtubeId,
        status: 'pending',
        folderId,
      });

      return {
        video: {
          id: userVideo._id.toString(),
          videoSummaryId: cached._id.toString(),
          status: 'pending',
        },
        cached: false,
      };
    }

    // Cache MISS - create entry and trigger summarization via HTTP
    const expiresAtForNew = calculateExpiresAt(tier);
    const cacheEntry = await this.videoRepository.createCacheEntry({
      youtubeId,
      url,
      status: 'pending',
      version: 1,
      isLatest: true,
      retryCount: 0,
      ...(expiresAtForNew && { expiresAt: expiresAtForNew }),
    });

    // Trigger summarization via HTTP (fire and forget)
    this.summarizerClient.triggerSummarization({
      videoSummaryId: cacheEntry._id.toString(),
      youtubeId,
      url,
      userId,
      providers,
    });

    const userVideo = await this.videoRepository.createUserVideo({
      userId,
      videoSummaryId: cacheEntry._id.toString(),
      youtubeId,
      status: 'pending',
      folderId,
    });

    return {
      video: {
        id: userVideo._id.toString(),
        videoSummaryId: cacheEntry._id.toString(),
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
    const videos = await this.videoRepository.getUserVideos(userId, folderId, options);

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
    const video = await this.videoRepository.findUserVideo(userId, videoId);

    if (!video) {
      throw new VideoNotFoundError();
    }

    const summary = await this.videoRepository.findCacheById(video.videoSummaryId.toString());

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
      // Structured output (if intent-based pipeline was used)
      output: (summary as any)?.intent ? {
        outputType: (summary as any).intent.outputType ?? summary?.outputType,
        intent: (summary as any).intent,
        output: (summary as any).output ?? null,
        synthesis: (summary as any).synthesis ?? null,
        enrichment: (summary as any).enrichment ?? null,
      } : null,
    };
  }

  async deleteVideo(userId: string, videoId: string) {
    const deleted = await this.videoRepository.deleteUserVideo(userId, videoId);

    if (!deleted) {
      throw new VideoNotFoundError();
    }
  }

  async moveToFolder(userId: string, videoId: string, folderId: string | null) {
    const updated = await this.videoRepository.updateUserVideoFolder(userId, videoId, folderId);

    if (!updated) {
      throw new VideoNotFoundError();
    }

    return { success: true };
  }

  /** Override the detected category for a video */
  async overrideCategory(userId: string, videoId: string, category: string) {
    const video = await this.videoRepository.findUserVideo(userId, videoId);
    if (!video) throw new VideoNotFoundError();

    const CATEGORY_TO_OUTPUT: Record<string, OutputType> = {
      cooking: 'recipe',
      coding: 'code_walkthrough',
      travel: 'trip_planner',
      reviews: 'verdict',
      fitness: 'workout',
      education: 'study_kit',
      podcast: 'highlights',
      diy: 'project_guide',
      gaming: 'highlights',
      music: 'music_guide',
      standard: 'explanation',
    };

    const outputType = CATEGORY_TO_OUTPUT[category];
    if (!outputType) throw new InvalidCategoryError(category);

    const videoSummaryId = video.videoSummaryId.toString();
    const cache = await this.videoRepository.findCacheById(videoSummaryId);
    if (!cache) throw new VideoNotFoundError();

    const existingContext = (cache.context || {}) as Record<string, unknown>;
    await this.videoRepository.updateCacheEntry(videoSummaryId, {
      context: {
        ...existingContext,
        originalCategory: existingContext.category || 'standard',
        category,
      },
      outputType,
    });

    return {
      videoSummaryId,
      category,
      outputType,
      previousCategory: existingContext.category || 'standard',
    };
  }

  /** Persist detection result from summarizer SSE stream */
  async persistDetectionResult(videoSummaryId: string, outputType: string, category?: string, confidence?: number): Promise<void> {
    if (!isValidOutputType(outputType)) return;
    await this.videoRepository.updateCacheEntry(videoSummaryId, {
      outputType,
      context: {
        category: category || 'standard',
        categoryConfidence: confidence,
      },
    });
  }

  // Check if user owns a video with this youtubeId
  async userOwnsVideo(userId: string, youtubeId: string): Promise<boolean> {
    return this.videoRepository.userOwnsVideo(userId, youtubeId);
  }

  /**
   * Get all versions of a video summary for A/B comparison.
   * Returns metadata only (not full summary content) to limit data exposure.
   */
  async getVersions(youtubeId: string, options: { limit?: number } = {}) {
    const { limit = 10 } = options;
    // Server-side validation: enforce bounds regardless of input
    const safeLimit = Math.min(Math.max(1, limit), 50);

    const versions = await this.videoRepository.getVersions(youtubeId, safeLimit);

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

    await this.videoRepository.deleteOldVersions(
      youtubeId,
      currentVersion - MAX_VERSIONS_PER_VIDEO + 1
    );
  }

  private toCacheResponse(doc: VideoSummaryCacheDocument) {
    return {
      youtubeId: doc.youtubeId,
      title: doc.title,
      channel: doc.channel,
      duration: doc.duration,
      thumbnailUrl: doc.thumbnailUrl,
      version: doc.version,
      isLatest: doc.isLatest,
    };
  }
}
