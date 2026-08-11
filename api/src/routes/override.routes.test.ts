import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildTestApp, createMockContainer, getAuthHeader, type MockContainer } from '../test/helpers.js';

describe('override routes', () => {
  let app: FastifyInstance;
  let mockContainer: MockContainer;
  let authHeader: string;

  const validVideoId = '507f1f77bcf86cd799439011';

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

  describe('PATCH /api/videos/:id/override-category', () => {
    it('should return 401 without auth token', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/videos/${validVideoId}/override-category`,
        headers: { 'content-type': 'application/json' },
        payload: { category: 'cooking' },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 400 for invalid ObjectId param format', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/videos/not-a-valid-objectid/override-category',
        headers: {
          authorization: authHeader,
          'content-type': 'application/json',
        },
        payload: { category: 'cooking' },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for invalid category value', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/videos/${validVideoId}/override-category`,
        headers: {
          authorization: authHeader,
          'content-type': 'application/json',
        },
        payload: { category: 'invalid-category' },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toHaveProperty('error', 'VALIDATION_ERROR');
    });

    it('should delegate to videoService.overrideCategory for valid request', async () => {
      const mockResult = {
        videoSummaryId: '507f1f77bcf86cd799439011',
        category: 'cooking',
        outputType: 'recipe',
        previousCategory: 'standard',
      };
      mockContainer.videoService.overrideCategory.mockResolvedValue(mockResult);

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/videos/${validVideoId}/override-category`,
        headers: {
          authorization: authHeader,
          'content-type': 'application/json',
        },
        payload: { category: 'cooking' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(mockResult);
      expect(mockContainer.videoService.overrideCategory).toHaveBeenCalledWith(
        'test-user-id',
        validVideoId,
        'cooking'
      );
    });

    it('should return 404 when service throws VideoNotFoundError', async () => {
      const { VideoNotFoundError } = await import('../utils/errors.js');
      mockContainer.videoService.overrideCategory.mockRejectedValue(new VideoNotFoundError());

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/videos/${validVideoId}/override-category`,
        headers: {
          authorization: authHeader,
          'content-type': 'application/json',
        },
        payload: { category: 'cooking' },
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toHaveProperty('error', 'VIDEO_NOT_FOUND');
    });
  });
});
