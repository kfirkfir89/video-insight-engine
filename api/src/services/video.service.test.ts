import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import type { FastifyBaseLogger } from 'fastify';
import { VideoService } from './video.service.js';
import { VideoRepository } from '../repositories/video.repository.js';
import { SummarizerClient } from './summarizer-client.js';

// Mock logger for tests
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

describe('VideoService', () => {
  let videoService: VideoService;
  let mockVideoRepository: {
    findCacheById: ReturnType<typeof vi.fn>;
    findCacheByYoutubeId: ReturnType<typeof vi.fn>;
    createCacheEntry: ReturnType<typeof vi.fn>;
    createUserVideo: ReturnType<typeof vi.fn>;
    findUserVideo: ReturnType<typeof vi.fn>;
    findUserVideoByYoutubeId: ReturnType<typeof vi.fn>;
    getUserVideos: ReturnType<typeof vi.fn>;
    deleteUserVideo: ReturnType<typeof vi.fn>;
    deleteUserVideoByYoutubeId: ReturnType<typeof vi.fn>;
    updateUserVideoFolder: ReturnType<typeof vi.fn>;
    markPreviousVersionsNotLatest: ReturnType<typeof vi.fn>;
    findHighestVersion: ReturnType<typeof vi.fn>;
    incrementRetryCount: ReturnType<typeof vi.fn>;
    getVersions: ReturnType<typeof vi.fn>;
    deleteOldVersions: ReturnType<typeof vi.fn>;
    userOwnsVideo: ReturnType<typeof vi.fn>;
  };
  let mockSummarizerClient: {
    triggerSummarization: ReturnType<typeof vi.fn>;
  };

  beforeAll(() => {
    mockVideoRepository = {
      findCacheById: vi.fn(),
      findCacheByYoutubeId: vi.fn(),
      createCacheEntry: vi.fn(),
      createUserVideo: vi.fn(),
      findUserVideo: vi.fn(),
      findUserVideoByYoutubeId: vi.fn(),
      getUserVideos: vi.fn(),
      deleteUserVideo: vi.fn(),
      deleteUserVideoByYoutubeId: vi.fn(),
      updateUserVideoFolder: vi.fn(),
      markPreviousVersionsNotLatest: vi.fn(),
      findHighestVersion: vi.fn(),
      incrementRetryCount: vi.fn(),
      getVersions: vi.fn(),
      deleteOldVersions: vi.fn(),
      userOwnsVideo: vi.fn(),
    };
    mockSummarizerClient = {
      triggerSummarization: vi.fn(),
    };
    videoService = new VideoService(
      mockVideoRepository as unknown as VideoRepository,
      mockSummarizerClient as unknown as SummarizerClient,
      mockLogger
    );
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createVideo', () => {
    it('should always return videoSummaryId in the video object', async () => {
      const userId = 'user123';
      const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
      const youtubeId = 'dQw4w9WgXcQ';
      const videoSummaryId = 'summary123';

      // Test case: Cache miss - new video
      mockVideoRepository.findUserVideoByYoutubeId.mockResolvedValue(null);
      mockVideoRepository.findCacheByYoutubeId.mockResolvedValue(null);
      mockVideoRepository.createCacheEntry.mockResolvedValue({
        _id: { toString: () => videoSummaryId },
        youtubeId,
        status: 'pending',
      });
      mockVideoRepository.createUserVideo.mockResolvedValue({
        _id: { toString: () => 'userVideo123' },
        videoSummaryId: { toString: () => videoSummaryId },
        youtubeId,
        status: 'pending',
      });

      const result = await videoService.createVideo(userId, url, { tier: 'free' });

      expect(result.video).toHaveProperty('videoSummaryId');
      expect(result.video.videoSummaryId).toBe(videoSummaryId);
    });

    it('should return videoSummaryId when cache hit', async () => {
      const userId = 'user123';
      const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
      const youtubeId = 'dQw4w9WgXcQ';
      const videoSummaryId = 'summary123';

      // Test case: Cache hit - completed video
      mockVideoRepository.findUserVideoByYoutubeId.mockResolvedValue(null);
      mockVideoRepository.findCacheByYoutubeId.mockResolvedValue({
        _id: { toString: () => videoSummaryId },
        youtubeId,
        status: 'completed',
        title: 'Test Video',
        channel: 'Test Channel',
      });
      mockVideoRepository.createUserVideo.mockResolvedValue({
        _id: { toString: () => 'userVideo123' },
        videoSummaryId: { toString: () => videoSummaryId },
        youtubeId,
        status: 'completed',
      });

      const result = await videoService.createVideo(userId, url, { tier: 'free' });

      expect(result.video).toHaveProperty('videoSummaryId');
      expect(result.video.videoSummaryId).toBe(videoSummaryId);
    });

    it('should return videoSummaryId when video is processing', async () => {
      const userId = 'user123';
      const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
      const youtubeId = 'dQw4w9WgXcQ';
      const videoSummaryId = 'summary123';

      // Test case: Already processing
      mockVideoRepository.findUserVideoByYoutubeId.mockResolvedValue(null);
      mockVideoRepository.findCacheByYoutubeId.mockResolvedValue({
        _id: { toString: () => videoSummaryId },
        youtubeId,
        status: 'processing',
      });
      mockVideoRepository.createUserVideo.mockResolvedValue({
        _id: { toString: () => 'userVideo123' },
        videoSummaryId: { toString: () => videoSummaryId },
        youtubeId,
        status: 'processing',
      });

      const result = await videoService.createVideo(userId, url, { tier: 'free' });

      expect(result.video).toHaveProperty('videoSummaryId');
      expect(result.video.videoSummaryId).toBe(videoSummaryId);
    });

    it('should return videoSummaryId when retrying failed video', async () => {
      const userId = 'user123';
      const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
      const youtubeId = 'dQw4w9WgXcQ';
      const videoSummaryId = 'summary123';

      // Test case: Failed video retry
      mockVideoRepository.findUserVideoByYoutubeId.mockResolvedValue(null);
      mockVideoRepository.findCacheByYoutubeId.mockResolvedValue({
        _id: { toString: () => videoSummaryId },
        youtubeId,
        status: 'failed',
      });
      mockVideoRepository.incrementRetryCount.mockResolvedValue(undefined);
      mockVideoRepository.createUserVideo.mockResolvedValue({
        _id: { toString: () => 'userVideo123' },
        videoSummaryId: { toString: () => videoSummaryId },
        youtubeId,
        status: 'pending',
      });

      const result = await videoService.createVideo(userId, url, { tier: 'free' });

      expect(result.video).toHaveProperty('videoSummaryId');
      expect(result.video.videoSummaryId).toBe(videoSummaryId);
    });
  });
});
