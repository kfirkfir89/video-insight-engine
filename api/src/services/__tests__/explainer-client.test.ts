import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { FastifyBaseLogger } from 'fastify';
import { ExplainerClient, ExplainChatRequest } from '../explainer-client.js';
import { ServiceTimeoutError, ServiceUnavailableError } from '../../utils/errors.js';

// Mock the global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

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

describe('ExplainerClient', () => {
  let client: ExplainerClient;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    client = new ExplainerClient(mockLogger);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('explainAuto', () => {
    it('should make HTTP POST request to explainer service', async () => {
      const expectedResult = { expansion: 'Test explanation content' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => expectedResult,
      });

      const result = await client.explainAuto('video-123', 'section', 'section-456');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8001/explain/auto',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            videoSummaryId: 'video-123',
            targetType: 'section',
            targetId: 'section-456',
          }),
        })
      );
      expect(result).toEqual(expectedResult);
    });

    it('should handle section target type', async () => {
      const expectedResult = { expansion: 'Section explanation' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => expectedResult,
      });

      await client.explainAuto('vid-1', 'section', 'sec-1');

      const [, options] = mockFetch.mock.calls[0];
      const body = JSON.parse(options.body);
      expect(body.targetType).toBe('section');
    });

    it('should handle concept target type', async () => {
      const expectedResult = { expansion: 'Concept explanation' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => expectedResult,
      });

      await client.explainAuto('vid-1', 'concept', 'concept-1');

      const [, options] = mockFetch.mock.calls[0];
      const body = JSON.parse(options.body);
      expect(body.targetType).toBe('concept');
    });

    describe('error handling', () => {
      it('should throw ServiceUnavailableError on non-OK response', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({ detail: 'Internal server error' }),
        });

        await expect(client.explainAuto('video-123', 'section', 'section-456')).rejects.toThrow(
          ServiceUnavailableError
        );
      });

      it('should include error detail in ServiceUnavailableError message', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 400,
          json: async () => ({ detail: 'Invalid request parameters' }),
        });

        await expect(client.explainAuto('video-123', 'section', 'section-456')).rejects.toThrow(
          'Explainer: Invalid request parameters'
        );
      });

      it('should handle response with no error detail', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 502,
          json: async () => {
            throw new Error('Invalid JSON');
          },
        });

        await expect(client.explainAuto('video-123', 'section', 'section-456')).rejects.toThrow(
          'Explainer: Unknown error'
        );
      });

      it('should throw ServiceTimeoutError on timeout', async () => {
        mockFetch.mockImplementation(async () => {
          const error = new Error('Aborted');
          error.name = 'AbortError';
          throw error;
        });

        await expect(client.explainAuto('video-123', 'section', 'section-456')).rejects.toThrow(
          ServiceTimeoutError
        );
        await expect(client.explainAuto('video-123', 'section', 'section-456')).rejects.toThrow(
          'Explainer service timed out'
        );
      });

      it('should throw ServiceUnavailableError on network error', async () => {
        mockFetch.mockRejectedValueOnce(new Error('Network error'));

        await expect(client.explainAuto('video-123', 'section', 'section-456')).rejects.toThrow(
          ServiceUnavailableError
        );
      });

      it('should rethrow ServiceTimeoutError if already that type', async () => {
        mockFetch.mockRejectedValueOnce(new ServiceTimeoutError('Test'));

        await expect(client.explainAuto('video-123', 'section', 'section-456')).rejects.toThrow(
          ServiceTimeoutError
        );
      });

      it('should rethrow ServiceUnavailableError if already that type', async () => {
        mockFetch.mockRejectedValueOnce(new ServiceUnavailableError('Test'));

        await expect(client.explainAuto('video-123', 'section', 'section-456')).rejects.toThrow(
          ServiceUnavailableError
        );
      });
    });

    describe('timeout configuration', () => {
      it('should pass abort signal to fetch', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ expansion: 'test' }),
        });

        await client.explainAuto('video-123', 'section', 'section-456');

        expect(mockFetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            signal: expect.any(AbortSignal),
          })
        );
      });
    });
  });

  describe('explainChat', () => {
    const baseRequest: ExplainChatRequest = {
      memorizedItemId: 'item-123',
      userId: 'user-456',
      message: 'Explain this concept',
    };

    it('should make HTTP POST request to chat endpoint', async () => {
      const expectedResult = { chatId: 'chat-789', response: 'AI response text' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => expectedResult,
      });

      const result = await client.explainChat(baseRequest);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8001/explain/chat',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            memorizedItemId: 'item-123',
            userId: 'user-456',
            message: 'Explain this concept',
          }),
        })
      );
      expect(result).toEqual(expectedResult);
    });

    it('should include chatId when provided', async () => {
      const expectedResult = { chatId: 'chat-789', response: 'Follow up response' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => expectedResult,
      });

      const requestWithChatId: ExplainChatRequest = {
        ...baseRequest,
        chatId: 'existing-chat-123',
      };

      await client.explainChat(requestWithChatId);

      const [, options] = mockFetch.mock.calls[0];
      const body = JSON.parse(options.body);
      expect(body.chatId).toBe('existing-chat-123');
    });

    it('should not include chatId when not provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ chatId: 'new-chat', response: 'response' }),
      });

      await client.explainChat(baseRequest);

      const [, options] = mockFetch.mock.calls[0];
      const body = JSON.parse(options.body);
      expect(body).not.toHaveProperty('chatId');
    });

    describe('error handling', () => {
      it('should throw ServiceUnavailableError on non-OK response', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({ detail: 'Chat service error' }),
        });

        await expect(client.explainChat(baseRequest)).rejects.toThrow(ServiceUnavailableError);
      });

      it('should include error detail in message', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 404,
          json: async () => ({ detail: 'Memorized item not found' }),
        });

        await expect(client.explainChat(baseRequest)).rejects.toThrow(
          'Explainer: Memorized item not found'
        );
      });

      it('should throw ServiceTimeoutError on timeout', async () => {
        mockFetch.mockImplementation(async () => {
          const error = new Error('Aborted');
          error.name = 'AbortError';
          throw error;
        });

        await expect(client.explainChat(baseRequest)).rejects.toThrow(ServiceTimeoutError);
      });

      it('should throw ServiceUnavailableError on network failure', async () => {
        mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

        await expect(client.explainChat(baseRequest)).rejects.toThrow(ServiceUnavailableError);
      });

      it('should handle JSON parse error in response', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 503,
          json: async () => {
            throw new SyntaxError('Unexpected token');
          },
        });

        await expect(client.explainChat(baseRequest)).rejects.toThrow(
          'Explainer: Unknown error'
        );
      });
    });
  });

  describe('explainChatStream', () => {
    const baseRequest: ExplainChatRequest = {
      memorizedItemId: 'item-123',
      userId: 'user-456',
      message: 'Stream this explanation',
    };

    it('should make HTTP POST request to stream endpoint', async () => {
      const mockBody = {
        getReader: vi.fn().mockReturnValue({
          read: vi.fn().mockResolvedValue({ done: true, value: undefined }),
        }),
      };
      mockFetch.mockResolvedValueOnce({ ok: true, body: mockBody });

      await client.explainChatStream(baseRequest);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8001/explain/chat/stream',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            memorizedItemId: 'item-123',
            userId: 'user-456',
            message: 'Stream this explanation',
          }),
        })
      );
    });

    it('should return Response object for streaming', async () => {
      const mockResponse = {
        ok: true,
        body: {
          getReader: vi.fn().mockReturnValue({
            read: vi
              .fn()
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode('data: {"chunk": "Hello"}\n\n'),
              })
              .mockResolvedValueOnce({ done: true, value: undefined }),
          }),
        },
      };
      mockFetch.mockResolvedValueOnce(mockResponse);

      const result = await client.explainChatStream(baseRequest);

      expect(result).toBe(mockResponse);
    });

    it('should include chatId when provided', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, body: {} });

      const requestWithChatId: ExplainChatRequest = {
        ...baseRequest,
        chatId: 'continue-chat-456',
      };

      await client.explainChatStream(requestWithChatId);

      const [, options] = mockFetch.mock.calls[0];
      const body = JSON.parse(options.body);
      expect(body.chatId).toBe('continue-chat-456');
    });

    describe('error handling', () => {
      it('should throw ServiceUnavailableError on non-OK response', async () => {
        mockFetch.mockResolvedValue({ ok: false, status: 503 });

        await expect(client.explainChatStream(baseRequest)).rejects.toThrow(
          ServiceUnavailableError
        );
      });

      it('should include status code in error message for non-OK response', async () => {
        mockFetch.mockResolvedValue({ ok: false, status: 503 });

        await expect(client.explainChatStream(baseRequest)).rejects.toThrow(
          'Explainer streaming: 503'
        );
      });

      it('should throw ServiceTimeoutError on timeout', async () => {
        const abortError = new Error('Aborted');
        abortError.name = 'AbortError';
        mockFetch.mockRejectedValue(abortError);

        await expect(client.explainChatStream(baseRequest)).rejects.toThrow(ServiceTimeoutError);
      });

      it('should include service name in timeout error message', async () => {
        const abortError = new Error('Aborted');
        abortError.name = 'AbortError';
        mockFetch.mockRejectedValue(abortError);

        await expect(client.explainChatStream(baseRequest)).rejects.toThrow(
          'Explainer streaming service timed out'
        );
      });

      it('should throw ServiceUnavailableError on network error', async () => {
        mockFetch.mockRejectedValue(new Error('Network unreachable'));

        await expect(client.explainChatStream(baseRequest)).rejects.toThrow(
          ServiceUnavailableError
        );
      });

      it('should include service name in unavailable error message', async () => {
        mockFetch.mockRejectedValue(new Error('Network unreachable'));

        await expect(client.explainChatStream(baseRequest)).rejects.toThrow(
          'Explainer streaming service unavailable'
        );
      });

      it('should rethrow ServiceTimeoutError if already that type', async () => {
        mockFetch.mockRejectedValueOnce(new ServiceTimeoutError('Existing timeout'));

        await expect(client.explainChatStream(baseRequest)).rejects.toThrow(ServiceTimeoutError);
      });

      it('should rethrow ServiceUnavailableError if already that type', async () => {
        mockFetch.mockRejectedValueOnce(new ServiceUnavailableError('Existing unavailable'));

        await expect(client.explainChatStream(baseRequest)).rejects.toThrow(
          ServiceUnavailableError
        );
      });
    });

    describe('timeout handling', () => {
      it('should pass abort signal to fetch for streaming', async () => {
        mockFetch.mockResolvedValueOnce({ ok: true, body: {} });

        await client.explainChatStream(baseRequest);

        expect(mockFetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            signal: expect.any(AbortSignal),
          })
        );
      });

      it('should clear timeout when response is received', async () => {
        const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
        mockFetch.mockResolvedValueOnce({ ok: true, body: {} });

        await client.explainChatStream(baseRequest);

        expect(clearTimeoutSpy).toHaveBeenCalled();
        clearTimeoutSpy.mockRestore();
      });
    });
  });

  describe('request validation', () => {
    it('explainAuto should send all required fields', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ expansion: 'test' }),
      });

      await client.explainAuto('vid-abc', 'section', 'sec-xyz');

      const [, options] = mockFetch.mock.calls[0];
      const body = JSON.parse(options.body);

      expect(body).toEqual({
        videoSummaryId: 'vid-abc',
        targetType: 'section',
        targetId: 'sec-xyz',
      });
    });

    it('explainChat should send all required fields', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ chatId: 'c1', response: 'r1' }),
      });

      await client.explainChat({
        memorizedItemId: 'mem-1',
        userId: 'user-1',
        message: 'Hello',
      });

      const [, options] = mockFetch.mock.calls[0];
      const body = JSON.parse(options.body);

      expect(body).toEqual({
        memorizedItemId: 'mem-1',
        userId: 'user-1',
        message: 'Hello',
      });
    });
  });

  describe('URL configuration', () => {
    it('should use configured EXPLAINER_URL for explainAuto', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ expansion: 'test' }),
      });

      await client.explainAuto('vid', 'section', 'sec');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8001/explain/auto',
        expect.any(Object)
      );
    });

    it('should use configured EXPLAINER_URL for explainChat', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ chatId: 'c', response: 'r' }),
      });

      await client.explainChat({
        memorizedItemId: 'i',
        userId: 'u',
        message: 'm',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8001/explain/chat',
        expect.any(Object)
      );
    });

    it('should use configured EXPLAINER_URL for explainChatStream', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, body: {} });

      await client.explainChatStream({
        memorizedItemId: 'i',
        userId: 'u',
        message: 'm',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8001/explain/chat/stream',
        expect.any(Object)
      );
    });
  });
});
