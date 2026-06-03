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
      expect(mockContainer.assistantClient.chat).toHaveBeenCalledWith(
        expect.objectContaining({
          videoId: validVideoSummaryId,
          message: 'Explain this video',
          conversationHistory: [
            { role: 'user', content: 'Hi' },
            { role: 'assistant', content: 'Hello!' },
          ],
          requestId: expect.any(String),
        }),
      );
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
      expect(mockContainer.assistantClient.chat).toHaveBeenCalledWith(
        expect.objectContaining({
          videoId: validVideoSummaryId,
          message: 'Summarize the key points',
          conversationHistory: undefined,
        }),
      );
    });

    it('should forward the Fastify request id as the assistant requestId', async () => {
      mockContainer.videoRepository.userHasAccessToSummary.mockResolvedValue(true);

      const encoder = new TextEncoder();
      const mockStream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode('data: {"type":"done"}\n\n'));
          controller.close();
        },
      });
      mockContainer.assistantClient.chat.mockResolvedValue(mockStream);

      const incoming = 'edge-chat-req-123abc';
      await app.inject({
        method: 'POST',
        url: `/api/videos/${validVideoSummaryId}/chat`,
        headers: { authorization: authHeader, 'x-request-id': incoming },
        payload: { message: 'hi' },
      });

      const arg = mockContainer.assistantClient.chat.mock.calls[0][0];
      expect(arg.requestId).toBe(incoming);
    });
  });

  describe('POST /api/videos/:videoSummaryId/action', () => {
    const successEnvelope = {
      success: true,
      action: 'save_note',
      data: { saved: true, note_id: 'n1' },
      error: null,
      trace_id: 'abcdef012345',
    };

    it('should return 401 without auth token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/videos/${validVideoSummaryId}/action`,
        payload: { action: 'save_note', params: { text: 'note' } },
      });

      expect(response.statusCode).toBe(401);
      expect(mockContainer.assistantClient.action).not.toHaveBeenCalled();
    });

    it('should return 400 when action is unknown', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/videos/${validVideoSummaryId}/action`,
        headers: { authorization: authHeader },
        payload: { action: 'teleport' },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toBe('VALIDATION_ERROR');
      expect(mockContainer.assistantClient.action).not.toHaveBeenCalled();
    });

    it('should return 404 when user has no access to video', async () => {
      mockContainer.videoRepository.userHasAccessToSummary.mockResolvedValue(false);

      const response = await app.inject({
        method: 'POST',
        url: `/api/videos/${validVideoSummaryId}/action`,
        headers: { authorization: authHeader },
        payload: { action: 'save_note', params: { text: 'note' } },
      });

      expect(response.statusCode).toBe(404);
      expect(mockContainer.assistantClient.action).not.toHaveBeenCalled();
    });

    it('should forward action to assistant with user identity', async () => {
      mockContainer.videoRepository.userHasAccessToSummary.mockResolvedValue(true);
      mockContainer.assistantClient.action.mockResolvedValue({
        status: 200,
        body: successEnvelope,
      });

      const response = await app.inject({
        method: 'POST',
        url: `/api/videos/${validVideoSummaryId}/action`,
        headers: { authorization: authHeader },
        payload: { action: 'save_note', params: { text: 'remember this' } },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(successEnvelope);
      expect(mockContainer.assistantClient.action).toHaveBeenCalledWith(
        expect.objectContaining({
          videoId: validVideoSummaryId,
          userId: 'test-user-id',
          action: 'save_note',
          params: { text: 'remember this' },
          requestId: expect.any(String),
        }),
      );
    });

    it('should propagate non-200 status from assistant', async () => {
      mockContainer.videoRepository.userHasAccessToSummary.mockResolvedValue(true);
      mockContainer.assistantClient.action.mockResolvedValue({
        status: 400,
        body: {
          success: false,
          action: 'save_note',
          data: null,
          error: "Action 'save_note' requires param 'text'",
          trace_id: 'fedcba012345',
        },
      });

      const response = await app.inject({
        method: 'POST',
        url: `/api/videos/${validVideoSummaryId}/action`,
        headers: { authorization: authHeader },
        payload: { action: 'save_note', params: {} },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().success).toBe(false);
      expect(response.json().error).toContain('requires param');
    });

    it('should return 502 when assistant service is unavailable', async () => {
      mockContainer.videoRepository.userHasAccessToSummary.mockResolvedValue(true);

      const { ServiceUnavailableError } = await import('../utils/errors.js');
      mockContainer.assistantClient.action.mockRejectedValue(new ServiceUnavailableError('Assistant'));

      const response = await app.inject({
        method: 'POST',
        url: `/api/videos/${validVideoSummaryId}/action`,
        headers: { authorization: authHeader },
        payload: { action: 'save_note', params: { text: 'x' } },
      });

      expect(response.statusCode).toBe(502);
      expect(response.json().error).toBe('SERVICE_UNAVAILABLE');
    });

    it('should accept all four documented action names', async () => {
      mockContainer.videoRepository.userHasAccessToSummary.mockResolvedValue(true);
      mockContainer.assistantClient.action.mockResolvedValue({
        status: 200,
        body: successEnvelope,
      });

      const actions = ['save_note', 'quiz_me', 'find_moment', 'explain'] as const;
      for (const action of actions) {
        const response = await app.inject({
          method: 'POST',
          url: `/api/videos/${validVideoSummaryId}/action`,
          headers: { authorization: authHeader },
          payload: action === 'save_note'
            ? { action, params: { text: 'note' } }
            : action === 'find_moment'
              ? { action, params: { query: 'q' } }
              : action === 'explain'
                ? { action, params: { concept: 'c' } }
                : { action },
        });
        expect(response.statusCode).toBe(200);
      }
      expect(mockContainer.assistantClient.action).toHaveBeenCalledTimes(actions.length);
    });

    it('should reject params exceeding the shared value length cap', async () => {
      mockContainer.videoRepository.userHasAccessToSummary.mockResolvedValue(true);

      const response = await app.inject({
        method: 'POST',
        url: `/api/videos/${validVideoSummaryId}/action`,
        headers: { authorization: authHeader },
        payload: { action: 'save_note', params: { text: 'x'.repeat(4001) } },
      });

      expect(response.statusCode).toBe(400);
      expect(mockContainer.assistantClient.action).not.toHaveBeenCalled();
    });
  });
});
