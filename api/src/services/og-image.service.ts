import { FastifyBaseLogger } from 'fastify';

/**
 * OG Image service — generates Open Graph preview images.
 *
 * MVP: Returns a redirect to YouTube's thumbnail.
 * Future: Use satori + @resvg/resvg-js for branded OG images.
 *
 * Note: In-memory cache (~10MB max) is lost on restart and not shared across
 * instances. Acceptable for single-instance MVP. For multi-instance, move to
 * Redis or CDN-based caching.
 */

interface OgImageInput {
  title: string;
  channel: string | null;
  thumbnailUrl: string | null;
  youtubeId: string;
  outputType: string;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_CACHE_SIZE = 100;

export class OgImageService {
  private readonly imageCache = new Map<string, { buffer: Buffer; lastAccessedAt: number }>();

  constructor(private readonly logger: FastifyBaseLogger) {}

  /**
   * Get or generate an OG image for a shared summary.
   * MVP: Fetches YouTube thumbnail as the OG image.
   */
  async getOgImage(slug: string, data: OgImageInput): Promise<Buffer | null> {
    // Check cache
    const cached = this.imageCache.get(slug);
    if (cached && Date.now() - cached.lastAccessedAt < CACHE_TTL_MS) {
      // LRU: update access time on hit
      cached.lastAccessedAt = Date.now();
      return cached.buffer;
    }

    try {
      const imageUrl = data.thumbnailUrl
        || `https://img.youtube.com/vi/${data.youtubeId}/maxresdefault.jpg`;

      const response = await fetch(imageUrl, {
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) return null;

      const buffer = Buffer.from(await response.arrayBuffer());

      // Cache with LRU eviction (remove least-recently-accessed entry when full)
      if (this.imageCache.size >= MAX_CACHE_SIZE) {
        let oldestKey: string | undefined;
        let oldestTime = Infinity;
        for (const [key, entry] of this.imageCache) {
          if (entry.lastAccessedAt < oldestTime) {
            oldestTime = entry.lastAccessedAt;
            oldestKey = key;
          }
        }
        if (oldestKey) this.imageCache.delete(oldestKey);
      }
      this.imageCache.set(slug, { buffer, lastAccessedAt: Date.now() });

      return buffer;
    } catch (err) {
      this.logger.warn({ slug, err }, 'Failed to generate OG image');
      return null;
    }
  }
}
