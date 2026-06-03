import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { FastifyBaseLogger } from 'fastify';
import { AssistantClient, ASSISTANT_ACTIONS } from './assistant-client.js';
import { ServiceUnavailableError } from '../utils/errors.js';

const logger = {
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
} as unknown as FastifyBaseLogger;

function fetchReturning(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
    text: async () => JSON.stringify(body),
  });
}

describe('AssistantClient', () => {
  let client: AssistantClient;

  beforeEach(() => {
    client = new AssistantClient(logger);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('chat', () => {
    it('should forward X-User-Id so the assistant attributes RAG llm_usage to the user', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        body: new ReadableStream(),
      });
      vi.stubGlobal('fetch', fetchMock);

      await client.chat({
        videoId: 'vsid-1',
        userId: 'user-42',
        message: 'hi',
        requestId: 'req-9',
      });

      const sentHeaders = fetchMock.mock.calls[0][1].headers as Record<string, string>;
      expect(sentHeaders['X-User-Id']).toBe('user-42');
      expect(sentHeaders['X-Request-ID']).toBe('req-9');
    });
  });

  describe('ASSISTANT_ACTIONS', () => {
    it('should be the single source of truth listing every supported action', () => {
      expect(ASSISTANT_ACTIONS).toContain('save_note');
      expect(ASSISTANT_ACTIONS).toContain('organize_library');
      expect(ASSISTANT_ACTIONS).toContain('move_video');
      expect(ASSISTANT_ACTIONS).toHaveLength(11);
    });
  });

  describe('action', () => {
    it('should return the parsed envelope for a 200 response', async () => {
      const body = { type: 'note_saved', message: 'ok', trace_id: 't1' };
      vi.stubGlobal('fetch', fetchReturning(200, body));

      const result = await client.action({ action: 'save_note', userId: 'u1', videoId: 'v1' });

      expect(result).toEqual({ status: 200, body });
    });

    it('should pass through a 4xx business/validation envelope without collapsing it', async () => {
      const body = { type: 'error', message: 'bad request', trace_id: 't1' };
      vi.stubGlobal('fetch', fetchReturning(422, body));

      const result = await client.action({ action: 'save_note', userId: 'u1', videoId: 'v1' });

      expect(result.status).toBe(422);
      expect(result.body).toEqual(body);
    });

    it('should collapse a 5xx response to ServiceUnavailableError (no internal body leak)', async () => {
      vi.stubGlobal('fetch', fetchReturning(500, { detail: 'Traceback: /app/internal/path.py' }));

      await expect(
        client.action({ action: 'save_note', userId: 'u1', videoId: 'v1' }),
      ).rejects.toBeInstanceOf(ServiceUnavailableError);
    });

    it('should omit video_id from the request body when not provided', async () => {
      const fetchMock = fetchReturning(200, { type: 'ok', message: '', trace_id: 't' });
      vi.stubGlobal('fetch', fetchMock);

      await client.action({ action: 'organize_library', userId: 'u1' });

      const sentBody = JSON.parse(fetchMock.mock.calls[0][1].body as string);
      expect(sentBody).not.toHaveProperty('video_id');
      expect(sentBody.action).toBe('organize_library');
    });
  });

  describe('librarySearch', () => {
    it('should pass through a 200 search envelope', async () => {
      const body = { results: [{ video_id: 'v1', text: 'snippet', score: 0.9 }] };
      vi.stubGlobal('fetch', fetchReturning(200, body));

      const result = await client.librarySearch({ youtubeIds: ['v1'], userId: 'u1', query: 'q' });

      expect(result).toEqual({ status: 200, body });
    });

    it('should collapse a 5xx search response to ServiceUnavailableError', async () => {
      vi.stubGlobal('fetch', fetchReturning(503, { detail: 'qdrant unreachable at vie-qdrant:6333' }));

      await expect(
        client.librarySearch({ youtubeIds: ['v1'], userId: 'u1', query: 'q' }),
      ).rejects.toBeInstanceOf(ServiceUnavailableError);
    });
  });
});
