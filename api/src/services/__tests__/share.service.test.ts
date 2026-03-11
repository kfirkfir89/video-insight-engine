import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { FastifyBaseLogger } from 'fastify';
import { ObjectId } from 'mongodb';
import { ShareService } from '../share.service.js';
import { type ShareRepository } from '../../repositories/share.repository.js';
import { type VideoRepository } from '../../repositories/video.repository.js';
import { ShareNotFoundError, VideoNotFoundError } from '../../utils/errors.js';

// Mock crypto.randomBytes for deterministic slugs
vi.mock('node:crypto', async () => {
  const actual = await vi.importActual<typeof import('node:crypto')>('node:crypto');
  return {
    ...actual,
    randomBytes: vi.fn(() => Buffer.from('abcdefghijklmnop')),
  };
});

// Mock logger
const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  trace: vi.fn(),
  fatal: vi.fn(),
  child: vi.fn(() => mockLogger),
  level: 'silent',
  silent: vi.fn(),
} as unknown as FastifyBaseLogger;

// Mock repositories typed to match service expectations
const mockShareRepo: {
  findBySlug: ReturnType<typeof vi.fn>;
  markAsShared: ReturnType<typeof vi.fn>;
  incrementViewsDedup: ReturnType<typeof vi.fn>;
  hasLiked: ReturnType<typeof vi.fn>;
  addLike: ReturnType<typeof vi.fn>;
  getShareInfo: ReturnType<typeof vi.fn>;
} = {
  findBySlug: vi.fn(),
  markAsShared: vi.fn(),
  incrementViewsDedup: vi.fn(),
  hasLiked: vi.fn(),
  addLike: vi.fn(),
  getShareInfo: vi.fn(),
};

const mockVideoRepo: {
  userHasAccessToSummary: ReturnType<typeof vi.fn>;
  findCacheById: ReturnType<typeof vi.fn>;
} = {
  userHasAccessToSummary: vi.fn(),
  findCacheById: vi.fn(),
};

describe('ShareService', () => {
  let service: ShareService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ShareService(
      mockShareRepo as unknown as ShareRepository,
      mockVideoRepo as unknown as VideoRepository,
      mockLogger
    );
  });

  describe('createShare', () => {
    const userId = new ObjectId().toString();
    const videoSummaryId = new ObjectId().toString();

    it('should return existing share if already shared (idempotent)', async () => {
      const sharedAt = new Date('2025-06-15T10:00:00Z');
      mockVideoRepo.userHasAccessToSummary.mockResolvedValue(true);
      mockVideoRepo.findCacheById.mockResolvedValue({
        status: 'completed',
        shareSlug: 'existslug1',
        sharedAt,
        createdAt: new Date('2025-06-14T10:00:00Z'),
      });

      const result = await service.createShare(userId, videoSummaryId);

      expect(result).toEqual({
        shareSlug: 'existslug1',
        sharedAt: '2025-06-15T10:00:00.000Z',
      });
      // Should check ownership and cache, then return existing share
      expect(mockVideoRepo.userHasAccessToSummary).toHaveBeenCalledWith(userId, videoSummaryId);
      expect(mockVideoRepo.findCacheById).toHaveBeenCalledWith(videoSummaryId);
      expect(mockShareRepo.markAsShared).not.toHaveBeenCalled();
    });

    it('should throw VideoNotFoundError if user does not own the video', async () => {
      mockVideoRepo.userHasAccessToSummary.mockResolvedValue(false);

      await expect(service.createShare(userId, videoSummaryId))
        .rejects
        .toThrow(VideoNotFoundError);

      expect(mockVideoRepo.userHasAccessToSummary).toHaveBeenCalledWith(userId, videoSummaryId);
      expect(mockVideoRepo.findCacheById).not.toHaveBeenCalled();
      expect(mockShareRepo.markAsShared).not.toHaveBeenCalled();
    });

    it('should throw VideoNotFoundError if video cache not found', async () => {
      mockVideoRepo.userHasAccessToSummary.mockResolvedValue(true);
      mockVideoRepo.findCacheById.mockResolvedValue(null);

      await expect(service.createShare(userId, videoSummaryId))
        .rejects
        .toThrow(VideoNotFoundError);

      expect(mockVideoRepo.findCacheById).toHaveBeenCalledWith(videoSummaryId);
      expect(mockShareRepo.markAsShared).not.toHaveBeenCalled();
    });

    it('should throw VideoNotFoundError if video is not completed', async () => {
      mockVideoRepo.userHasAccessToSummary.mockResolvedValue(true);
      mockVideoRepo.findCacheById.mockResolvedValue({ status: 'processing' });

      await expect(service.createShare(userId, videoSummaryId))
        .rejects
        .toThrow(VideoNotFoundError);

      expect(mockShareRepo.markAsShared).not.toHaveBeenCalled();
    });

    it('should generate a slug and mark as shared for a valid video', async () => {
      mockVideoRepo.userHasAccessToSummary.mockResolvedValue(true);
      mockVideoRepo.findCacheById.mockResolvedValue({ status: 'completed' });
      mockShareRepo.markAsShared.mockResolvedValue(true);

      const result = await service.createShare(userId, videoSummaryId);

      expect(result.shareSlug).toBe('YWJjZGVmZ2');
      expect(result.sharedAt).toBeDefined();
      // Verify sharedAt is a valid ISO string
      expect(() => new Date(result.sharedAt)).not.toThrow();

      expect(mockShareRepo.markAsShared).toHaveBeenCalledWith(videoSummaryId, 'YWJjZGVmZ2');
      expect(mockLogger.info).toHaveBeenCalledWith(
        { videoSummaryId, slug: 'YWJjZGVmZ2' },
        'Video shared'
      );
    });
  });

  describe('getPublicSummary', () => {
    const slug = 'test-slug1';

    it('should return formatted public summary data', async () => {
      const docId = new ObjectId();
      const sharedAt = new Date('2025-06-15T10:00:00Z');
      mockShareRepo.findBySlug.mockResolvedValue({
        _id: docId,
        youtubeId: 'dQw4w9WgXcQ',
        title: 'Test Video Title',
        channel: 'Test Channel',
        thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
        duration: 212,
        context: { persona: 'standard', language: 'en' },
        summary: { chapters: [] },
        viewsCount: 42,
        likesCount: 7,
        sharedAt,
        createdAt: new Date('2025-06-14T10:00:00Z'),
      });
      mockShareRepo.incrementViewsDedup.mockResolvedValue(undefined);

      const result = await service.getPublicSummary(slug, '127.0.0.1');

      expect(result).toEqual({
        id: docId.toString(),
        youtubeId: 'dQw4w9WgXcQ',
        title: 'Test Video Title',
        channel: 'Test Channel',
        thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
        duration: 212,
        outputType: 'learning',
        context: { persona: 'standard', language: 'en' },
        summary: { chapters: [] },
        output: null,
        shareSlug: slug,
        viewsCount: 42,
        likesCount: 7,
        sharedAt: '2025-06-15T10:00:00.000Z',
      });

      expect(mockShareRepo.findBySlug).toHaveBeenCalledWith(slug);
      // incrementViewsDedup should be called with slug and IP hash (fire and forget)
      expect(mockShareRepo.incrementViewsDedup).toHaveBeenCalledWith(slug, expect.any(String));
    });

    it('should use fallback values for missing optional fields', async () => {
      const docId = new ObjectId();
      const createdAt = new Date('2025-06-14T10:00:00Z');
      mockShareRepo.findBySlug.mockResolvedValue({
        _id: docId,
        youtubeId: 'abc123',
        // title, channel, thumbnailUrl, duration, context missing
        summary: { chapters: [] },
        // viewsCount, likesCount, sharedAt missing
        createdAt,
      });
      mockShareRepo.incrementViewsDedup.mockResolvedValue(undefined);

      const result = await service.getPublicSummary(slug, '10.0.0.1');

      expect(result.title).toBe('Untitled Video');
      expect(result.channel).toBeNull();
      expect(result.thumbnailUrl).toBeNull();
      expect(result.duration).toBeNull();
      expect(result.outputType).toBe('learning');
      expect(result.context).toBeNull();
      expect(result.viewsCount).toBe(0);
      expect(result.likesCount).toBe(0);
      // Falls back to createdAt when sharedAt is missing
      expect(result.sharedAt).toBe('2025-06-14T10:00:00.000Z');
    });

    it('should throw ShareNotFoundError for invalid slug', async () => {
      mockShareRepo.findBySlug.mockResolvedValue(null);

      await expect(service.getPublicSummary('nonexistent'))
        .rejects
        .toThrow(ShareNotFoundError);

      expect(mockShareRepo.findBySlug).toHaveBeenCalledWith('nonexistent');
      expect(mockShareRepo.incrementViewsDedup).not.toHaveBeenCalled();
    });

    it('should not fail if incrementViews rejects (fire and forget)', async () => {
      const docId = new ObjectId();
      mockShareRepo.findBySlug.mockResolvedValue({
        _id: docId,
        youtubeId: 'abc123',
        summary: { chapters: [] },
        createdAt: new Date(),
      });
      mockShareRepo.incrementViewsDedup.mockRejectedValue(new Error('DB error'));

      // Should not throw despite incrementViewsDedup failing
      const result = await service.getPublicSummary(slug, '10.0.0.1');
      expect(result.id).toBe(docId.toString());
    });
  });

  describe('likeShare', () => {
    const slug = 'like-slug1';
    const ip = '192.168.1.100';

    it('should return like count from addLike', async () => {
      const docId = new ObjectId();
      mockShareRepo.findBySlug.mockResolvedValue({
        _id: docId,
        likesCount: 5,
      });
      mockShareRepo.addLike.mockResolvedValue(6);

      const result = await service.likeShare(slug, ip);

      expect(result).toEqual({ likesCount: 6 });
      expect(mockShareRepo.findBySlug).toHaveBeenCalledWith(slug);
      // Verify IP is hashed (not passed raw)
      expect(mockShareRepo.addLike).toHaveBeenCalledWith(slug, expect.any(String));
      const passedHash = mockShareRepo.addLike.mock.calls[0][1];
      expect(passedHash).not.toBe(ip);
      expect(passedHash).toHaveLength(16);
      // hasLiked should NOT be called (dedup handled by repository)
      expect(mockShareRepo.hasLiked).not.toHaveBeenCalled();
    });

    it('should return existing count on duplicate like (repository handles dedup)', async () => {
      const docId = new ObjectId();
      mockShareRepo.findBySlug.mockResolvedValue({
        _id: docId,
        likesCount: 5,
      });
      // addLike returns existing count on duplicate key
      mockShareRepo.addLike.mockResolvedValue(5);

      const result = await service.likeShare(slug, ip);

      expect(result).toEqual({ likesCount: 5 });
      expect(mockShareRepo.addLike).toHaveBeenCalled();
    });

    it('should throw ShareNotFoundError for invalid slug', async () => {
      mockShareRepo.findBySlug.mockResolvedValue(null);

      await expect(service.likeShare('nonexistent', ip))
        .rejects
        .toThrow(ShareNotFoundError);

      expect(mockShareRepo.addLike).not.toHaveBeenCalled();
    });

    it('should produce different hashes for different IPs on the same slug', async () => {
      const doc = { _id: new ObjectId(), likesCount: 0 };
      mockShareRepo.findBySlug.mockResolvedValue(doc);
      mockShareRepo.addLike.mockResolvedValue(1);

      await service.likeShare(slug, '10.0.0.1');
      const hash1 = mockShareRepo.addLike.mock.calls[0][1];

      await service.likeShare(slug, '10.0.0.2');
      const hash2 = mockShareRepo.addLike.mock.calls[1][1];

      expect(hash1).not.toBe(hash2);
    });

    it('should produce different hashes for same IP on different slugs', async () => {
      const doc = { _id: new ObjectId(), likesCount: 0 };
      mockShareRepo.findBySlug.mockResolvedValue(doc);
      mockShareRepo.addLike.mockResolvedValue(1);

      await service.likeShare('slug-aaa', ip);
      const hash1 = mockShareRepo.addLike.mock.calls[0][1];

      await service.likeShare('slug-bbb', ip);
      const hash2 = mockShareRepo.addLike.mock.calls[1][1];

      expect(hash1).not.toBe(hash2);
    });
  });
});
