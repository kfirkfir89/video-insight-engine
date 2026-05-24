import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import type { FastifyBaseLogger } from 'fastify';
import { VideoService } from './video.service.js';
import { VideoRepository } from '../repositories/video.repository.js';
import { SummarizerClient } from './summarizer-client.js';
import { QueuePublisher } from './queue-publisher.service.js';
import { config } from '../config.js';

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
    updateCacheEntry: ReturnType<typeof vi.fn>;
  };
  let mockSummarizerClient: {
    triggerSummarization: ReturnType<typeof vi.fn>;
  };
  let mockQueuePublisher: {
    publishVideoJob: ReturnType<typeof vi.fn>;
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
      updateCacheEntry: vi.fn(),
    };
    mockSummarizerClient = {
      triggerSummarization: vi.fn(),
    };
    mockQueuePublisher = {
      publishVideoJob: vi.fn().mockResolvedValue({ requestId: 'req-1' }),
    };
    videoService = new VideoService(
      mockVideoRepository as unknown as VideoRepository,
      mockSummarizerClient as unknown as SummarizerClient,
      mockQueuePublisher as unknown as QueuePublisher,
      mockLogger
    );
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getVideo', () => {
    it('should return output when summary has triage data', async () => {
      const userId = 'user123';
      const videoId = 'vid123';
      const videoSummaryId = 'summary123';

      mockVideoRepository.findUserVideo.mockResolvedValue({
        _id: { toString: () => videoId },
        videoSummaryId: { toString: () => videoSummaryId },
        youtubeId: 'abc123',
        status: 'completed',
      });

      // Summary with triage-based pipeline data
      mockVideoRepository.findCacheById.mockResolvedValue({
        _id: { toString: () => videoSummaryId },
        youtubeId: 'abc123',
        status: 'completed',
        title: 'Test Video',
        triage: { contentTags: ['learning'], tabs: [{ id: 'key_points', label: 'Key Points' }] },
        output: { learningData: { keyPoints: [] } },
        synthesis: { tldr: 'Test', keyTakeaways: [], masterSummary: '', seoDescription: '' },
      });

      const result = await videoService.getVideo(userId, videoId);

      // New flat shape: meta contains triage fields + synthesis fields (no separate synthesis)
      expect(result.meta).not.toBeNull();
      expect((result.meta as Record<string, unknown>)?.contentTags).toEqual(['learning']);
      expect((result.meta as Record<string, unknown>)?.tldr).toBe('Test');
      expect((result.meta as Record<string, unknown>)?.keyTakeaways).toEqual([]);
      expect(result).not.toHaveProperty('synthesis');
    });

    it('should return null output when summary has no intent data', async () => {
      const userId = 'user123';
      const videoId = 'vid123';
      const videoSummaryId = 'summary123';

      mockVideoRepository.findUserVideo.mockResolvedValue({
        _id: { toString: () => videoId },
        videoSummaryId: { toString: () => videoSummaryId },
        youtubeId: 'abc123',
        status: 'completed',
      });

      // V1-style summary with no intent
      mockVideoRepository.findCacheById.mockResolvedValue({
        _id: { toString: () => videoSummaryId },
        youtubeId: 'abc123',
        status: 'completed',
        title: 'Test Video',
        summary: { tldr: 'old', chapters: [], concepts: [] },
      });

      const result = await videoService.getVideo(userId, videoId);

      // No triage/assembledMeta → meta should be null or empty
      expect(result.meta).toBeNull();
    });
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

    describe('queue-driven pipeline (USE_QUEUE_PIPELINE=true)', () => {
      beforeEach(() => {
        config.USE_QUEUE_PIPELINE = true;
      });

      afterEach(() => {
        config.USE_QUEUE_PIPELINE = false;
      });

      it('should publish to queue and skip the HTTP summarizer client on cache miss', async () => {
        const youtubeId = 'dQw4w9WgXcQ';
        const videoSummaryId = 'summary-queue-1';

        mockVideoRepository.findUserVideoByYoutubeId.mockResolvedValue(null);
        mockVideoRepository.findCacheByYoutubeId.mockResolvedValue(null);
        mockVideoRepository.createCacheEntry.mockResolvedValue({
          _id: { toString: () => videoSummaryId },
          youtubeId,
          status: 'pending',
        });
        mockVideoRepository.createUserVideo.mockResolvedValue({
          _id: { toString: () => 'userVideo-queue' },
          videoSummaryId: { toString: () => videoSummaryId },
          youtubeId,
          status: 'pending',
        });

        await videoService.createVideo(
          'user-q',
          'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          { tier: 'pro' },
        );

        expect(mockQueuePublisher.publishVideoJob).toHaveBeenCalledTimes(1);
        expect(mockSummarizerClient.triggerSummarization).not.toHaveBeenCalled();

        const arg = mockQueuePublisher.publishVideoJob.mock.calls[0][0];
        expect(arg.videoSummaryId).toBe(videoSummaryId);
        expect(arg.youtubeId).toBe(youtubeId);
        expect(arg.tier).toBe('pro');
      });

      it('should publish to queue on failed-video retry', async () => {
        const youtubeId = 'dQw4w9WgXcQ';
        const videoSummaryId = 'summary-queue-failed';

        mockVideoRepository.findUserVideoByYoutubeId.mockResolvedValue(null);
        mockVideoRepository.findCacheByYoutubeId.mockResolvedValue({
          _id: { toString: () => videoSummaryId },
          youtubeId,
          status: 'failed',
        });
        mockVideoRepository.createUserVideo.mockResolvedValue({
          _id: { toString: () => 'userVideo-q2' },
          videoSummaryId: { toString: () => videoSummaryId },
          youtubeId,
          status: 'pending',
        });

        await videoService.createVideo(
          'user-q',
          'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          { tier: 'free' },
        );

        expect(mockQueuePublisher.publishVideoJob).toHaveBeenCalledTimes(1);
        expect(mockSummarizerClient.triggerSummarization).not.toHaveBeenCalled();
      });

      it('should forward requestId into the queue payload', async () => {
        const youtubeId = 'dQw4w9WgXcQ';
        const videoSummaryId = 'summary-req-id';

        mockVideoRepository.findUserVideoByYoutubeId.mockResolvedValue(null);
        mockVideoRepository.findCacheByYoutubeId.mockResolvedValue(null);
        mockVideoRepository.createCacheEntry.mockResolvedValue({
          _id: { toString: () => videoSummaryId },
          youtubeId,
          status: 'pending',
        });
        mockVideoRepository.createUserVideo.mockResolvedValue({
          _id: { toString: () => 'userVideo-req' },
          videoSummaryId: { toString: () => videoSummaryId },
          youtubeId,
          status: 'pending',
        });

        await videoService.createVideo(
          'user-q',
          'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          { tier: 'free', requestId: 'req-from-route-abc12' },
        );

        const arg = mockQueuePublisher.publishVideoJob.mock.calls[0][0];
        expect(arg.requestId).toBe('req-from-route-abc12');
      });
    });

    describe('request-id propagation (HTTP fallback)', () => {
      it('should forward requestId to the summarizer client when not using the queue', async () => {
        const youtubeId = 'dQw4w9WgXcQ';
        const videoSummaryId = 'summary-http-req';

        mockVideoRepository.findUserVideoByYoutubeId.mockResolvedValue(null);
        mockVideoRepository.findCacheByYoutubeId.mockResolvedValue(null);
        mockVideoRepository.createCacheEntry.mockResolvedValue({
          _id: { toString: () => videoSummaryId },
          youtubeId,
          status: 'pending',
        });
        mockVideoRepository.createUserVideo.mockResolvedValue({
          _id: { toString: () => 'userVideo-http-req' },
          videoSummaryId: { toString: () => videoSummaryId },
          youtubeId,
          status: 'pending',
        });

        await videoService.createVideo(
          'user-http',
          'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          { tier: 'free', requestId: 'req-http-fallback-99' },
        );

        const call = mockSummarizerClient.triggerSummarization.mock.calls[0][0];
        expect(call.requestId).toBe('req-http-fallback-99');
      });
    });
  });
});
