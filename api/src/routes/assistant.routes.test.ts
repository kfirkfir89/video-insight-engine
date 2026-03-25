import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildTestApp, createMockContainer, getAuthHeader, type MockContainer } from '../test/helpers.js';

describe('assistant routes', () => {
  let app: FastifyInstance;
  let mockContainer: MockContainer;
  let authHeader: string;

  const validVideoSummaryId = '507f1f77bcf86cd799439011';

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

  describe('POST /api/videos/:videoSummaryId/chat', () => {
    it('should return 401 without auth token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/videos/${validVideoSummaryId}/chat`,
        payload: { message: 'Hello' },
      });

      expect(response.statusCode).toBe(401);
      expect(mockContainer.assistantClient.chat).not.toHaveBeenCalled();
    });

    it('should return 400 when message is missing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/videos/${validVideoSummaryId}/chat`,
        headers: { authorization: authHeader },
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toBe('VALIDATION_ERROR');
      expect(mockContainer.assistantClient.chat).not.toHaveBeenCalled();
    });

    it('should return 400 when message is empty string', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/videos/${validVideoSummaryId}/chat`,
        headers: { authorization: authHeader },
        payload: { message: '' },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toBe('VALIDATION_ERROR');
      expect(mockContainer.assistantClient.chat).not.toHaveBeenCalled();
    });

    it('should return 404 when user has no access to video', async () => {
      mockContainer.videoRepository.userHasAccessToSummary.mockResolvedValue(false);

      const response = await app.inject({
        method: 'POST',
        url: `/api/videos/${validVideoSummaryId}/chat`,
        headers: { authorization: authHeader },
        payload: { message: 'Explain this video' },
      });

      expect(response.statusCode).toBe(404);
      expect(mockContainer.assistantClient.chat).not.toHaveBeenCalled();
    });

    it('should proxy SSE stream from assistant service', async () => {
      mockContainer.videoRepository.userHasAccessToSummary.mockResolvedValue(true);

      const sseData = 'data: {"type":"text","content":"Hello"}\n\ndata: [DONE]\n\n';
      const encoder = new TextEncoder();
      const mockStream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode(sseData));
          controller.close();
        },
      });

      mockContainer.assistantClient.chat.mockResolvedValue(mockStream);

      const response = await app.inject({
        method: 'POST',
        url: `/api/videos/${validVideoSummaryId}/chat`,
        headers: { authorization: authHeader },
        payload: {
          message: 'Explain this video',
          conversationHistory: [
            { role: 'user', content: 'Hi' },
            { role: 'assistant', content: 'Hello!' },
          ],
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toBe('text/event-stream');
      expect(response.headers['cache-control']).toBe('no-cache');
      expect(response.body).toBe(sseData);
      expect(mockContainer.assistantClient.chat).toHaveBeenCalledWith({
        videoId: validVideoSummaryId,
        message: 'Explain this video',
        conversationHistory: [
          { role: 'user', content: 'Hi' },
          { role: 'assistant', content: 'Hello!' },
        ],
      });
    });

    it('should return 502 when assistant service is unavailable', async () => {
      mockContainer.videoRepository.userHasAccessToSummary.mockResolvedValue(true);

      const { ServiceUnavailableError } = await import('../utils/errors.js');
      mockContainer.assistantClient.chat.mockRejectedValue(new ServiceUnavailableError('Assistant'));

      const response = await app.inject({
        method: 'POST',
        url: `/api/videos/${validVideoSummaryId}/chat`,
        headers: { authorization: authHeader },
        payload: { message: 'Explain this video' },
      });

      expect(response.statusCode).toBe(502);
      expect(response.json().error).toBe('SERVICE_UNAVAILABLE');
    });

    it('should pass message without conversationHistory when not provided', async () => {
      mockContainer.videoRepository.userHasAccessToSummary.mockResolvedValue(true);

      const encoder = new TextEncoder();
      const mockStream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode('data: {"type":"done"}\n\n'));
          controller.close();
        },
      });
      mockContainer.assistantClient.chat.mockResolvedValue(mockStream);

      const response = await app.inject({
        method: 'POST',
        url: `/api/videos/${validVideoSummaryId}/chat`,
        headers: { authorization: authHeader },
        payload: { message: 'Summarize the key points' },
      });

      expect(response.statusCode).toBe(200);
      expect(mockContainer.assistantClient.chat).toHaveBeenCalledWith({
        videoId: validVideoSummaryId,
        message: 'Summarize the key points',
        conversationHistory: undefined,
      });
    });
  });

  describe('POST /api/videos/:videoSummaryId/action', () => {
    it('should return 501 not implemented', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/videos/${validVideoSummaryId}/action`,
        headers: { authorization: authHeader },
        payload: { action: 'bookmark', params: { timestamp: 120 } },
      });

      expect(response.statusCode).toBe(501);
      expect(response.json().error).toBe('NOT_IMPLEMENTED');
      expect(response.json().message).toBe('Assistant actions are not yet implemented.');
    });

    it('should return 401 without auth token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/videos/${validVideoSummaryId}/action`,
        payload: { action: 'bookmark' },
      });

      expect(response.statusCode).toBe(401);
    });
  });
});
