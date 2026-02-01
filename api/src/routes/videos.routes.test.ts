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
        undefined,
        false,
        undefined
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
        '507f1f77bcf86cd799439011',
        false,
        undefined
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
});
