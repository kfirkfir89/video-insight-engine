import { FastifyBaseLogger } from 'fastify';
import { VideoRepository, VideoSummaryCacheDocument } from '../repositories/video.repository.js';
import { SummarizerClient, type ProviderConfig } from './summarizer-client.js';
import { QueuePublisher } from './queue-publisher.service.js';
import { config } from '../config.js';
import { extractYoutubeId } from '../utils/youtube.js';
import { InvalidYouTubeUrlError, VideoNotFoundError, VersionCreationError, InvalidCategoryError, QueuePublishError } from '../utils/errors.js';
import { buildMetaFromDoc, buildTabsFromDoc } from '../utils/meta-builder.js';
import { refreshFrameUrls } from '../utils/refresh-frame-urls.js';
import type { UserTier } from '@vie/types';

export interface CreateVideoOptions {
  folderId?: string;
  bypassCache?: boolean;
  providers?: ProviderConfig;
  tier: UserTier;
  /**
   * Originating Fastify `request.id`. Flows into the queue payload (as the
   * publisher's `requestId`) AND the legacy HTTP fallback (as `X-Request-ID`)
   * so the downstream pipeline binds the same id no matter which path runs.
   */
  requestId?: string;
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
    private readonly queuePublisher: QueuePublisher,
    private readonly logger: FastifyBaseLogger
  ) {}

  /**
   * Dispatch a pipeline run via either the legacy HTTP path or the queue.
   * Falls back to HTTP if the queue publish fails — the DB row is already in
   * `pending`, so the SSE handler can still drive the pipeline directly when
   * the frontend connects.
   */
  private async dispatchPipeline(
    payload: {
      videoSummaryId: string;
      youtubeId: string;
      url: string;
      userId: string;
      tier: UserTier;
      providers?: ProviderConfig;
      bypassCache?: boolean;
      requestId?: string;
    },
  ): Promise<void> {
    if (config.USE_QUEUE_PIPELINE) {
      try {
        await this.queuePublisher.publishVideoJob({
          videoSummaryId: payload.videoSummaryId,
          youtubeId: payload.youtubeId,
          url: payload.url,
          userId: payload.userId,
          tier: payload.tier,
          providers: payload.providers,
          bypassCache: payload.bypassCache,
          requestId: payload.requestId,
        });
        return;
      } catch (err) {
        // Only swallow broker-side / validation failures (QueuePublishError).
        // Anything else is a real bug and should surface to the caller —
        // masking it with the HTTP fallback would hide schema regressions.
        if (!(err instanceof QueuePublishError)) {
          throw err;
        }
        this.logger.error(
          {
            err,
            videoSummaryId: payload.videoSummaryId,
            youtubeId: payload.youtubeId,
            requestId: payload.requestId,
          },
          'Queue publish failed, falling back to HTTP summarizer call',
        );
      }
    }

    this.summarizerClient.triggerSummarization({
      videoSummaryId: payload.videoSummaryId,
      youtubeId: payload.youtubeId,
      url: payload.url,
      userId: payload.userId,
      providers: payload.providers,
      requestId: payload.requestId,
    });
  }

  async createVideo(userId: string, url: string, options: CreateVideoOptions) {
    const { folderId, bypassCache = false, providers, tier, requestId } = options;
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

          // 6. Trigger summarization (queue or HTTP, controlled by USE_QUEUE_PIPELINE)
          await this.dispatchPipeline({
            videoSummaryId: cacheEntry._id.toString(),
            youtubeId,
            url,
            userId,
            tier,
            providers,
            bypassCache: true,
            requestId,
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

      await this.dispatchPipeline({
        videoSummaryId: cached._id.toString(),
        youtubeId,
        url,
        userId,
        tier,
        providers,
        requestId,
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

    // Trigger summarization (queue or HTTP based on USE_QUEUE_PIPELINE flag)
    await this.dispatchPipeline({
      videoSummaryId: cacheEntry._id.toString(),
      youtubeId,
      url,
      userId,
      tier,
      providers,
      requestId,
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

    // Build clean frontend response using shared meta/tabs builder
    // VideoSummaryCacheDocument has dynamic fields; cast via unknown for meta extraction
    const doc = (summary as unknown) as Record<string, unknown> | undefined;
    const meta = doc ? buildMetaFromDoc(doc) : null;
    const tabs = doc ? buildTabsFromDoc(doc) : null;
    const tabsEn = (doc?.tabs_en as unknown[] | undefined) ?? null;
    // Re-sign embedded S3 image URLs from their durable `s3Key` on BOTH the
    // native and English-translated tabs. Stored URLs expire on a TTL and may
    // also point at unreachable LocalStack hostnames in dev — refreshing on
    // the read path makes both classes of breakage go away. `tabs_en` carries
    // the same s3Key references the translation phase preserved through, so
    // non-English videos need the same treatment. No-op when S3 isn't
    // configured (tests).
    await Promise.all([refreshFrameUrls(tabs), refreshFrameUrls(tabsEn)]);

    return {
      id: video._id.toString(),
      videoSummaryId: video.videoSummaryId.toString(),
      youtubeId: video.youtubeId,
      title: video.title || summary?.title,
      creator: video.channel || summary?.channel,
      duration: video.duration || summary?.duration,
      thumbnailUrl: video.thumbnailUrl || summary?.thumbnailUrl,
      status: summary?.status || video.status,
      folderId: video.folderId?.toString() || null,
      meta,
      tabs,
      // English translation surfaces (populated by the summarizer's translation
      // phase for non-English videos). The frontend prefers these so shared
      // pages render in a globally-readable language by default.
      tabs_en: tabsEn,
      meta_en: doc?.meta_en ?? null,
      synthesis_en: doc?.synthesis_en ?? null,
      forceEnglishReason: (doc?.force_english_reason as string | undefined) ?? null,
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

    const CATEGORY_TO_TAG: Record<string, string> = {
      cooking: 'food',
      coding: 'tech',
      travel: 'travel',
      reviews: 'review',
      fitness: 'fitness',
      education: 'learning',
      podcast: 'learning',
      diy: 'project',
      gaming: 'tech',
      music: 'music',
      standard: 'learning',
    };

    const contentTag = CATEGORY_TO_TAG[category];
    if (!contentTag) throw new InvalidCategoryError(category);

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
    });

    return {
      videoSummaryId,
      category,
      contentTag,
      previousCategory: existingContext.category || 'standard',
    };
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
