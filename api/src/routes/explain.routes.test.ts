import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildTestApp, createMockContainer, getAuthHeader, type MockContainer } from '../test/helpers.js';

describe('explain routes', () => {
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

  describe('GET /api/explain/:videoSummaryId/:targetType/:targetId', () => {
    it('should call explainerClient.explainAuto with correct params', async () => {
      const expectedResult = { expansion: 'Test explanation content' };
      mockContainer.videoRepository.userHasAccessToSummary.mockResolvedValue(true);
      mockContainer.explainerClient.explainAuto.mockResolvedValue(expectedResult);

      const response = await app.inject({
        method: 'GET',
        url: '/api/explain/video123/section/section456',
        headers: { authorization: authHeader },
      });

      expect(response.statusCode).toBe(200);
      expect(mockContainer.videoRepository.userHasAccessToSummary).toHaveBeenCalledWith('test-user-id', 'video123');
      expect(mockContainer.explainerClient.explainAuto).toHaveBeenCalledWith(
        'video123',
        'section',
        'section456'
      );
      expect(response.json()).toEqual(expectedResult);
    });

    it('should return 404 when user does not have access to video', async () => {
      mockContainer.videoRepository.userHasAccessToSummary.mockResolvedValue(false);

      const response = await app.inject({
        method: 'GET',
        url: '/api/explain/video123/section/section456',
        headers: { authorization: authHeader },
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toHaveProperty('error', 'VIDEO_NOT_FOUND');
    });

    it('should return 400 for invalid targetType', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/explain/video123/invalid/section456',
        headers: { authorization: authHeader },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toHaveProperty('error', 'Bad Request');
    });

    it('should return 401 without auth token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/explain/video123/section/section456',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 500 when explainerClient throws', async () => {
      mockContainer.videoRepository.userHasAccessToSummary.mockResolvedValue(true);
      mockContainer.explainerClient.explainAuto.mockRejectedValue(new Error('Service unavailable'));

      const response = await app.inject({
        method: 'GET',
        url: '/api/explain/video123/concept/concept789',
        headers: { authorization: authHeader },
      });

      expect(response.statusCode).toBe(500);
      expect(response.json()).toHaveProperty('error', 'Internal Server Error');
    });
  });

  describe('POST /api/explain/video-chat', () => {
    it('should call explainerClient.videoChat with correct params', async () => {
      const expectedResult = { response: 'AI response about the video' };
      mockContainer.videoRepository.userHasAccessToSummary.mockResolvedValue(true);
      mockContainer.explainerClient.videoChat.mockResolvedValue(expectedResult);

      const response = await app.inject({
        method: 'POST',
        url: '/api/explain/video-chat',
        headers: {
          authorization: authHeader,
          'content-type': 'application/json',
        },
        payload: {
          videoSummaryId: 'video123',
          message: 'What is this video about?',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mockContainer.videoRepository.userHasAccessToSummary).toHaveBeenCalledWith('test-user-id', 'video123');
      expect(mockContainer.explainerClient.videoChat).toHaveBeenCalledWith(
        'video123',
        'What is this video about?',
        undefined
      );
      expect(response.json()).toEqual(expectedResult);
    });

    it('should pass chatHistory when provided', async () => {
      const chatHistory = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
      ];
      const expectedResult = { response: 'Follow-up response' };
      mockContainer.videoRepository.userHasAccessToSummary.mockResolvedValue(true);
      mockContainer.explainerClient.videoChat.mockResolvedValue(expectedResult);

      const response = await app.inject({
        method: 'POST',
        url: '/api/explain/video-chat',
        headers: {
          authorization: authHeader,
          'content-type': 'application/json',
        },
        payload: {
          videoSummaryId: 'video123',
          message: 'Follow up question',
          chatHistory,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mockContainer.explainerClient.videoChat).toHaveBeenCalledWith(
        'video123',
        'Follow up question',
        chatHistory
      );
    });

    it('should return 404 when user does not have access', async () => {
      mockContainer.videoRepository.userHasAccessToSummary.mockResolvedValue(false);

      const response = await app.inject({
        method: 'POST',
        url: '/api/explain/video-chat',
        headers: {
          authorization: authHeader,
          'content-type': 'application/json',
        },
        payload: {
          videoSummaryId: 'video123',
          message: 'Test message',
        },
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toHaveProperty('error', 'VIDEO_NOT_FOUND');
    });

    it('should return 400 for missing required fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/explain/video-chat',
        headers: {
          authorization: authHeader,
          'content-type': 'application/json',
        },
        payload: {
          videoSummaryId: 'video123',
          // missing message
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 401 without auth token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/explain/video-chat',
        headers: { 'content-type': 'application/json' },
        payload: {
          videoSummaryId: 'video123',
          message: 'Test message',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 500 when explainerClient throws', async () => {
      mockContainer.videoRepository.userHasAccessToSummary.mockResolvedValue(true);
      mockContainer.explainerClient.videoChat.mockRejectedValue(new Error('Service unavailable'));

      const response = await app.inject({
        method: 'POST',
        url: '/api/explain/video-chat',
        headers: {
          authorization: authHeader,
          'content-type': 'application/json',
        },
        payload: {
          videoSummaryId: 'video123',
          message: 'Test message',
        },
      });

      expect(response.statusCode).toBe(500);
      expect(response.json()).toHaveProperty('error', 'Internal Server Error');
    });
  });
});
