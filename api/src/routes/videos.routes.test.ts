import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildTestApp, createMockContainer, getAuthHeader, type MockContainer } from '../test/helpers.js';

describe('videos routes', () => {
  let app: FastifyInstance;
  let mockContainer: MockContainer;
  let authHeader: string;

  beforeAll(async () => {
    mockContainer = createMockContainer();
    app = await buildTestApp(mockContainer);
    await app.ready();
    authHeader = await getAuthHeader(app);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/videos', () => {
    it('should return list of videos', async () => {
      const mockVideos = [
        { id: 'v1', youtubeId: 'abc123', title: 'Test Video', status: 'completed' },
        { id: 'v2', youtubeId: 'def456', title: 'Another Video', status: 'processing' },
      ];
      mockContainer.videoService.getVideos.mockResolvedValue(mockVideos);

      const response = await app.inject({
        method: 'GET',
        url: '/api/videos',
        headers: { authorization: authHeader },
      });

      expect(response.statusCode).toBe(200);
      expect(mockContainer.videoService.getVideos).toHaveBeenCalledWith('test-user-id', undefined);
      expect(response.json()).toEqual({ videos: mockVideos });
    });

    it('should filter by folderId when provided', async () => {
      mockContainer.videoService.getVideos.mockResolvedValue([]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/videos?folderId=507f1f77bcf86cd799439011',
        headers: { authorization: authHeader },
      });

      expect(response.statusCode).toBe(200);
      expect(mockContainer.videoService.getVideos).toHaveBeenCalledWith(
        'test-user-id',
        '507f1f77bcf86cd799439011'
      );
    });

    it('should return 401 without auth token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/videos',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /api/videos/:id', () => {
    it('should return a single video', async () => {
      const mockVideo = {
        video: {
          id: 'v1',
          youtubeId: 'abc123',
          title: 'Test Video',
          status: 'completed',
        },
        summary: { sections: [] },
      };
      mockContainer.videoService.getVideo.mockResolvedValue(mockVideo);

      const response = await app.inject({
        method: 'GET',
        url: '/api/videos/507f1f77bcf86cd799439011',
        headers: { authorization: authHeader },
      });

      expect(response.statusCode).toBe(200);
      expect(mockContainer.videoService.getVideo).toHaveBeenCalledWith(
        'test-user-id',
        '507f1f77bcf86cd799439011'
      );
      expect(response.json()).toEqual(mockVideo);
    });

    it('should return 404 when video not found', async () => {
      const { VideoNotFoundError } = await import('../utils/errors.js');
      mockContainer.videoService.getVideo.mockRejectedValue(new VideoNotFoundError());

      const response = await app.inject({
        method: 'GET',
        url: '/api/videos/507f1f77bcf86cd799439011',
        headers: { authorization: authHeader },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('POST /api/videos', () => {
    it('should create a video from YouTube URL', async () => {
      const mockResult = {
        video: {
          id: 'v1',
          videoSummaryId: 'summary1',
          youtubeId: 'dQw4w9WgXcQ',
          status: 'pending',
        },
        cached: false,
      };
      mockContainer.videoService.createVideo.mockResolvedValue(mockResult);

      const response = await app.inject({
        method: 'POST',
        url: '/api/videos',
        headers: {
          authorization: authHeader,
          'content-type': 'application/json',
        },
        payload: {
          url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        },
      });

      expect(response.statusCode).toBe(201);
      expect(mockContainer.videoService.createVideo).toHaveBeenCalledWith(
        'test-user-id',
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        {
          folderId: undefined,
          bypassCache: false,
          providers: undefined,
          tier: 'free',
        }
      );
      expect(response.json()).toEqual(mockResult);
    });

    it('should accept optional folderId', async () => {
      const mockResult = {
        video: { id: 'v1', status: 'pending' },
        cached: false,
      };
      mockContainer.videoService.createVideo.mockResolvedValue(mockResult);

      const response = await app.inject({
        method: 'POST',
        url: '/api/videos',
        headers: {
          authorization: authHeader,
          'content-type': 'application/json',
        },
        payload: {
          url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          folderId: '507f1f77bcf86cd799439011',
        },
      });

      expect(response.statusCode).toBe(201);
      expect(mockContainer.videoService.createVideo).toHaveBeenCalledWith(
        'test-user-id',
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        {
          folderId: '507f1f77bcf86cd799439011',
          bypassCache: false,
          providers: undefined,
          tier: 'free',
        }
      );
    });

    it('should return 400 for invalid URL', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/videos',
        headers: {
          authorization: authHeader,
          'content-type': 'application/json',
        },
        payload: {
          url: 'not-a-valid-url',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should block the request with 429 when the reservation throws DailyLimitReachedError', async () => {
      const { DailyLimitReachedError } = await import('../utils/errors.js');
      mockContainer.costMonitorService.reserveUserCost.mockRejectedValue(
        new DailyLimitReachedError(2, '2026-05-15T00:00:00.000Z'),
      );

      const response = await app.inject({
        method: 'POST',
        url: '/api/videos',
        headers: {
          authorization: authHeader,
          'content-type': 'application/json',
        },
        payload: {
          url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        },
      });

      expect(response.statusCode).toBe(429);
      const body = response.json();
      expect(body.error).toBe('DAILY_LIMIT_REACHED');
      expect(body.resetAt).toBe('2026-05-15T00:00:00.000Z');
      expect(body.limitUsd).toBe(2);
      expect(mockContainer.videoService.createVideo).not.toHaveBeenCalled();
    });

    it('should reserve, then call createVideo when the user is still under their daily cost limit', async () => {
      mockContainer.costMonitorService.reserveUserCost.mockResolvedValue({
        userId: 'test-user-id',
        dateKey: '2026-05-14',
        amountUsd: 0.15,
      });
      mockContainer.videoService.createVideo.mockResolvedValue({
        video: { id: 'v1', status: 'pending' },
        cached: false,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/videos',
        headers: {
          authorization: authHeader,
          'content-type': 'application/json',
        },
        payload: {
          url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        },
      });

      expect(response.statusCode).toBe(201);
      expect(mockContainer.costMonitorService.reserveUserCost).toHaveBeenCalledWith(
        'test-user-id',
        'free',
      );
      expect(mockContainer.videoService.createVideo).toHaveBeenCalled();
      // Non-cached video → reservation is settled by reconcile, not refunded inline.
      expect(mockContainer.costMonitorService.refundReservation).not.toHaveBeenCalled();
    });

    it('should refund the reservation when createVideo throws', async () => {
      const reservation = { userId: 'test-user-id', dateKey: '2026-05-14', amountUsd: 0.15 };
      mockContainer.costMonitorService.reserveUserCost.mockResolvedValue(reservation);
      mockContainer.videoService.createVideo.mockRejectedValue(new Error('downstream-blew-up'));

      const response = await app.inject({
        method: 'POST',
        url: '/api/videos',
        headers: {
          authorization: authHeader,
          'content-type': 'application/json',
        },
        payload: {
          url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        },
      });

      expect(response.statusCode).toBe(500);
      expect(mockContainer.costMonitorService.refundReservation).toHaveBeenCalledWith(reservation);
    });

    it('should refund the reservation when the video is served from cache', async () => {
      const reservation = { userId: 'test-user-id', dateKey: '2026-05-14', amountUsd: 0.15 };
      mockContainer.costMonitorService.reserveUserCost.mockResolvedValue(reservation);
      mockContainer.videoService.createVideo.mockResolvedValue({
        video: { id: 'v1', status: 'completed' },
        cached: true,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/videos',
        headers: {
          authorization: authHeader,
          'content-type': 'application/json',
        },
        payload: {
          url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        },
      });

      expect(response.statusCode).toBe(201);
      expect(mockContainer.costMonitorService.refundReservation).toHaveBeenCalledWith(reservation);
    });
  });

  describe('DELETE /api/videos/:id', () => {
    it('should delete a video', async () => {
      mockContainer.videoService.deleteVideo.mockResolvedValue(undefined);

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/videos/507f1f77bcf86cd799439011',
        headers: { authorization: authHeader },
      });

      expect(response.statusCode).toBe(204);
      expect(mockContainer.videoService.deleteVideo).toHaveBeenCalledWith(
        'test-user-id',
        '507f1f77bcf86cd799439011'
      );
    });

    it('should return 404 when video not found', async () => {
      const { VideoNotFoundError } = await import('../utils/errors.js');
      mockContainer.videoService.deleteVideo.mockRejectedValue(new VideoNotFoundError());

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/videos/507f1f77bcf86cd799439011',
        headers: { authorization: authHeader },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('PATCH /api/videos/:id/move', () => {
    it('should move video to a folder', async () => {
      mockContainer.videoService.moveToFolder.mockResolvedValue({ success: true });

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/videos/507f1f77bcf86cd799439011/move',
        headers: {
          authorization: authHeader,
          'content-type': 'application/json',
        },
        payload: {
          folderId: '507f1f77bcf86cd799439012',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mockContainer.videoService.moveToFolder).toHaveBeenCalledWith(
        'test-user-id',
        '507f1f77bcf86cd799439011',
        '507f1f77bcf86cd799439012'
      );
    });

    it('should move video to root (no folder)', async () => {
      mockContainer.videoService.moveToFolder.mockResolvedValue({ success: true });

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/videos/507f1f77bcf86cd799439011/move',
        headers: {
          authorization: authHeader,
          'content-type': 'application/json',
        },
        payload: {
          folderId: null,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mockContainer.videoService.moveToFolder).toHaveBeenCalledWith(
        'test-user-id',
        '507f1f77bcf86cd799439011',
        null
      );
    });
  });

  describe('GET /api/videos/versions/:youtubeId', () => {
    it('should return versions for a video', async () => {
      mockContainer.videoService.userOwnsVideo.mockResolvedValue(true);
      const mockVersions = [
        { id: 'v1', version: 1, isLatest: false, status: 'completed' },
        { id: 'v2', version: 2, isLatest: true, status: 'completed' },
      ];
      mockContainer.videoService.getVersions.mockResolvedValue(mockVersions);

      const response = await app.inject({
        method: 'GET',
        url: '/api/videos/versions/dQw4w9WgXcQ',
        headers: { authorization: authHeader },
      });

      expect(response.statusCode).toBe(200);
      expect(mockContainer.videoService.userOwnsVideo).toHaveBeenCalledWith('test-user-id', 'dQw4w9WgXcQ');
      expect(mockContainer.videoService.getVersions).toHaveBeenCalledWith('dQw4w9WgXcQ', { limit: 10 });
      expect(response.json()).toEqual({ versions: mockVersions });
    });

    it('should return 404 when user does not own video', async () => {
      mockContainer.videoService.userOwnsVideo.mockResolvedValue(false);

      const response = await app.inject({
        method: 'GET',
        url: '/api/videos/versions/dQw4w9WgXcQ',
        headers: { authorization: authHeader },
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toHaveProperty('error', 'VIDEO_NOT_FOUND');
    });

    it('should accept limit query param', async () => {
      mockContainer.videoService.userOwnsVideo.mockResolvedValue(true);
      mockContainer.videoService.getVersions.mockResolvedValue([]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/videos/versions/dQw4w9WgXcQ?limit=5',
        headers: { authorization: authHeader },
      });

      expect(response.statusCode).toBe(200);
      expect(mockContainer.videoService.getVersions).toHaveBeenCalledWith('dQw4w9WgXcQ', { limit: 5 });
    });

    it('should return 400 for invalid youtubeId format', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/videos/versions/invalid',
        headers: { authorization: authHeader },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /api/videos — idempotency gate', () => {
    const VALID_YT_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

    const completedHit = (userVideoId: string, summaryId: string) => ({
      created: false,
      doc: {
        _id: { toString: () => 'idem1' },
        hash: 'test-hash',
        status: 'completed' as const,
        userId: { toString: () => 'test-user-id' },
        videoSummaryId: { toString: () => summaryId },
        userVideoId: { toString: () => userVideoId },
        youtubeId: 'dQw4w9WgXcQ',
      },
    });

    const pendingHit = () => ({
      created: false,
      doc: {
        _id: { toString: () => 'idem-pending' },
        hash: 'test-hash',
        status: 'pending' as const,
        userId: { toString: () => 'test-user-id' },
        youtubeId: 'dQw4w9WgXcQ',
      },
    });

    const freshReserve = () => ({
      created: true,
      doc: {
        _id: { toString: () => 'idem-new' },
        hash: 'test-hash',
        status: 'pending' as const,
        userId: { toString: () => 'test-user-id' },
        youtubeId: 'dQw4w9WgXcQ',
      },
    });

    it('returns the cached videoSummaryId without reserving cost or calling createVideo on a duplicate completed hit', async () => {
      const userVideoId = '507f1f77bcf86cd799439011';
      const summaryId = '507f191e810c19729de860ea';
      mockContainer.idempotencyService.reserveHash.mockResolvedValue(completedHit(userVideoId, summaryId));
      mockContainer.videoRepository.findUserVideo.mockResolvedValue({
        _id: { toString: () => userVideoId },
        videoSummaryId: { toString: () => summaryId },
        youtubeId: 'dQw4w9WgXcQ',
        title: 'Cached Title',
        channel: 'Cached Channel',
        duration: 100,
        thumbnailUrl: 'https://example.com/thumb.jpg',
        status: 'completed',
      });
      mockContainer.videoRepository.findCacheById.mockResolvedValue({
        title: 'Summary Title',
        channel: 'Summary Channel',
        duration: 100,
        thumbnailUrl: 'https://example.com/thumb.jpg',
        status: 'completed',
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/videos',
        headers: { authorization: authHeader, 'content-type': 'application/json' },
        payload: { url: VALID_YT_URL },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.duplicate).toBe(true);
      expect(body.cached).toBe(true);
      expect(body.video.id).toBe(userVideoId);
      expect(body.video.videoSummaryId).toBe(summaryId);
      expect(body.video.title).toBe('Summary Title');
      expect(body.video.channel).toBe('Summary Channel');

      // No reservation, no createVideo on a hit — that's the whole point.
      expect(mockContainer.costMonitorService.reserveUserCost).not.toHaveBeenCalled();
      expect(mockContainer.videoService.createVideo).not.toHaveBeenCalled();
    });

    it('returns 409 when the hash exists in pending state (another request is in-flight)', async () => {
      mockContainer.idempotencyService.reserveHash.mockResolvedValue(pendingHit());

      const response = await app.inject({
        method: 'POST',
        url: '/api/videos',
        headers: { authorization: authHeader, 'content-type': 'application/json' },
        payload: { url: VALID_YT_URL },
      });

      expect(response.statusCode).toBe(409);
      expect(response.json().error).toBe('IDEMPOTENCY_IN_FLIGHT');

      // No work happens for the late caller.
      expect(mockContainer.costMonitorService.reserveUserCost).not.toHaveBeenCalled();
      expect(mockContainer.videoService.createVideo).not.toHaveBeenCalled();
    });

    it('falls through to fresh creation when the completed hash points to a deleted userVideo', async () => {
      // First reserve attempt finds a stale completed row pointing at a deleted userVideo.
      // After scoped-invalidate, the retry reserves cleanly.
      mockContainer.idempotencyService.reserveHash
        .mockResolvedValueOnce(completedHit('gone1', 'sumX'))
        .mockResolvedValueOnce(freshReserve());

      mockContainer.videoRepository.findUserVideo.mockResolvedValue(null);
      mockContainer.videoService.createVideo.mockResolvedValue({
        video: { id: 'newUV', videoSummaryId: 'newSum', status: 'pending' },
        cached: false,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/videos',
        headers: { authorization: authHeader, 'content-type': 'application/json' },
        payload: { url: VALID_YT_URL },
      });

      expect(response.statusCode).toBe(201);
      // Stale-hit cleanup is scoped to the (hash, observed summaryId) pair so a
      // concurrent fresh reservation cannot be accidentally deleted.
      expect(mockContainer.idempotencyService.invalidateStaleCompleted).toHaveBeenCalledWith(
        'test-hash',
        'sumX',
      );
      expect(mockContainer.idempotencyService.reserveHash).toHaveBeenCalledTimes(2);
      expect(mockContainer.costMonitorService.reserveUserCost).toHaveBeenCalled();
      expect(mockContainer.videoService.createVideo).toHaveBeenCalled();
    });

    it('completes the hash with real IDs after a fresh successful creation', async () => {
      mockContainer.idempotencyService.reserveHash.mockResolvedValue(freshReserve());
      mockContainer.videoService.createVideo.mockResolvedValue({
        video: { id: 'uv1', videoSummaryId: 'sum1', status: 'pending' },
        cached: false,
      });

      await app.inject({
        method: 'POST',
        url: '/api/videos',
        headers: { authorization: authHeader, 'content-type': 'application/json' },
        payload: { url: VALID_YT_URL },
      });

      expect(mockContainer.idempotencyService.completeHash).toHaveBeenCalledWith({
        hash: 'test-hash',
        videoSummaryId: 'sum1',
        userVideoId: 'uv1',
      });
    });

    it('invalidates the reserved hash when createVideo throws', async () => {
      mockContainer.idempotencyService.reserveHash.mockResolvedValue(freshReserve());
      mockContainer.videoService.createVideo.mockRejectedValue(new Error('downstream-blew-up'));

      const response = await app.inject({
        method: 'POST',
        url: '/api/videos',
        headers: { authorization: authHeader, 'content-type': 'application/json' },
        payload: { url: VALID_YT_URL },
      });

      expect(response.statusCode).toBe(500);
      expect(mockContainer.idempotencyService.invalidateByHash).toHaveBeenCalledWith('test-hash');
    });

    it('invalidates the reserved hash when reserveUserCost throws DailyLimitReachedError', async () => {
      const { DailyLimitReachedError } = await import('../utils/errors.js');
      mockContainer.idempotencyService.reserveHash.mockResolvedValue(freshReserve());
      mockContainer.costMonitorService.reserveUserCost.mockRejectedValue(
        new DailyLimitReachedError(2, '2026-05-15T00:00:00.000Z'),
      );

      const response = await app.inject({
        method: 'POST',
        url: '/api/videos',
        headers: { authorization: authHeader, 'content-type': 'application/json' },
        payload: { url: VALID_YT_URL },
      });

      expect(response.statusCode).toBe(429);
      expect(mockContainer.idempotencyService.invalidateByHash).toHaveBeenCalledWith('test-hash');
      expect(mockContainer.videoService.createVideo).not.toHaveBeenCalled();
    });

    it('skips idempotency entirely when bypassCache is true', async () => {
      mockContainer.videoService.createVideo.mockResolvedValue({
        video: { id: 'uv1', videoSummaryId: 'sum1', status: 'pending' },
        cached: false,
      });

      await app.inject({
        method: 'POST',
        url: '/api/videos',
        headers: { authorization: authHeader, 'content-type': 'application/json' },
        payload: { url: VALID_YT_URL, bypassCache: true },
      });

      expect(mockContainer.idempotencyService.reserveHash).not.toHaveBeenCalled();
      expect(mockContainer.idempotencyService.completeHash).not.toHaveBeenCalled();
    });

    it('passes the Idempotency-Key HTTP header to computeKey when supplied', async () => {
      mockContainer.idempotencyService.reserveHash.mockResolvedValue(freshReserve());
      mockContainer.videoService.createVideo.mockResolvedValue({
        video: { id: 'uv1', videoSummaryId: 'sum1', status: 'pending' },
        cached: false,
      });

      await app.inject({
        method: 'POST',
        url: '/api/videos',
        headers: {
          authorization: authHeader,
          'content-type': 'application/json',
          'idempotency-key': 'client-supplied-uuid',
        },
        payload: { url: VALID_YT_URL },
      });

      expect(mockContainer.idempotencyService.computeKey).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'test-user-id',
          youtubeId: 'dQw4w9WgXcQ',
          clientKey: 'client-supplied-uuid',
        }),
      );
    });

    it('does not enqueue a queue job on idempotency hit (cost protection)', async () => {
      mockContainer.idempotencyService.reserveHash.mockResolvedValue(completedHit('uv1', 'sumX'));
      mockContainer.videoRepository.findUserVideo.mockResolvedValue({
        _id: { toString: () => 'uv1' },
        videoSummaryId: { toString: () => 'sumX' },
        status: 'completed',
      });
      mockContainer.videoRepository.findCacheById.mockResolvedValue(null);

      await app.inject({
        method: 'POST',
        url: '/api/videos',
        headers: { authorization: authHeader, 'content-type': 'application/json' },
        payload: { url: VALID_YT_URL },
      });

      // createVideo is the entry point to both HTTP-summarizer and the queue
      // publisher — bypassing it is the canonical cost-protection guarantee.
      expect(mockContainer.videoService.createVideo).not.toHaveBeenCalled();
      expect(mockContainer.queuePublisher.publishVideoJob).not.toHaveBeenCalled();
      expect(mockContainer.summarizerClient.triggerSummarization).not.toHaveBeenCalled();
      expect(mockContainer.userCostRepository.incrementDailyCost).not.toHaveBeenCalled();
    });

    it('rejects an Idempotency-Key header that is too long (>255 chars)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/videos',
        headers: {
          authorization: authHeader,
          'content-type': 'application/json',
          'idempotency-key': 'a'.repeat(300),
        },
        payload: { url: VALID_YT_URL },
      });

      expect(response.statusCode).toBe(400);
    });
  });
});
