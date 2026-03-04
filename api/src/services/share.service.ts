import { createHash, randomBytes } from 'node:crypto';
import { FastifyBaseLogger } from 'fastify';
import { ShareRepository } from '../repositories/share.repository.js';
import { VideoRepository } from '../repositories/video.repository.js';
import {
  ShareNotFoundError,
  VideoNotFoundError,
} from '../utils/errors.js';
import type { VideoContext, OutputType, VideoSummary } from '@vie/types';

const SLUG_LENGTH = 10;

/** Public-facing video summary for shared pages (mirrors @vie/types PublicVideoSummary) */
interface PublicSummaryResponse {
  id: string;
  youtubeId: string;
  title: string;
  channel: string | null;
  thumbnailUrl: string | null;
  duration: number | null;
  outputType: OutputType;
  context: VideoContext | null;
  summary: VideoSummary;
  shareSlug: string;
  viewsCount: number;
  likesCount: number;
  sharedAt: string;
}

export class ShareService {
  constructor(
    private readonly shareRepository: ShareRepository,
    private readonly videoRepository: VideoRepository,
    private readonly logger: FastifyBaseLogger
  ) {}

  async createShare(userId: string, videoSummaryId: string): Promise<{
    shareSlug: string;
    sharedAt: string;
  }> {
    // Always verify ownership first (prevents info leak via enumeration)
    const hasAccess = await this.videoRepository.userHasAccessToSummary(userId, videoSummaryId);
    if (!hasAccess) {
      throw new VideoNotFoundError();
    }

    // Verify video is completed
    const cache = await this.videoRepository.findCacheById(videoSummaryId);
    if (!cache || cache.status !== 'completed') {
      throw new VideoNotFoundError();
    }

    // Check if already shared (idempotent)
    if (cache.shareSlug) {
      return {
        shareSlug: cache.shareSlug,
        sharedAt: (cache.sharedAt || cache.createdAt).toISOString(),
      };
    }

    // Generate unique slug and atomically mark as shared (prevents race condition)
    const slug = randomBytes(SLUG_LENGTH)
      .toString('base64url')
      .slice(0, SLUG_LENGTH);
    const marked = await this.shareRepository.markAsShared(videoSummaryId, slug);

    if (!marked) {
      // Race condition — another request just shared it, return existing
      const existing = await this.shareRepository.getShareInfo(videoSummaryId);
      if (existing) {
        return { shareSlug: existing.shareSlug, sharedAt: existing.sharedAt.toISOString() };
      }
      throw new VideoNotFoundError();
    }

    this.logger.info({ videoSummaryId, slug }, 'Video shared');

    return {
      shareSlug: slug,
      sharedAt: new Date().toISOString(),
    };
  }

  async getPublicSummary(slug: string, ip?: string): Promise<PublicSummaryResponse> {
    const doc = await this.shareRepository.findBySlug(slug);
    if (!doc) {
      throw new ShareNotFoundError();
    }

    // Increment views with IP dedup (fire and forget — monitor for persistent failures)
    if (ip) {
      const viewIpHash = createHash('sha256').update(ip + slug).digest('hex').slice(0, 16);
      this.shareRepository.incrementViewsDedup(slug, viewIpHash).catch((err) => {
        this.logger.error({ slug, error: err instanceof Error ? err.message : String(err) }, 'Failed to increment share views — views may be undercounted');
      });
    }

    return {
      id: doc._id.toString(),
      youtubeId: doc.youtubeId,
      title: doc.title || 'Untitled Video',
      channel: doc.channel || null,
      thumbnailUrl: doc.thumbnailUrl || null,
      duration: doc.duration || null,
      outputType: (doc.outputType as OutputType) || 'summary',
      context: (doc.context as VideoContext) || null,
      summary: doc.summary as VideoSummary,
      shareSlug: slug,
      viewsCount: doc.viewsCount ?? 0,
      likesCount: doc.likesCount ?? 0,
      sharedAt: (doc.sharedAt || doc.createdAt).toISOString(),
    };
  }

  async likeShare(slug: string, ip: string): Promise<{ likesCount: number }> {
    // Hash IP for privacy
    const ipHash = createHash('sha256').update(ip + slug).digest('hex').slice(0, 16);

    const doc = await this.shareRepository.findBySlug(slug);
    if (!doc) {
      throw new ShareNotFoundError();
    }

    // addLike handles duplicate key gracefully via unique index
    const likesCount = await this.shareRepository.addLike(slug, ipHash);
    return { likesCount };
  }
}
