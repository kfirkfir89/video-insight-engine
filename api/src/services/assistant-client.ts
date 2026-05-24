import type { FastifyBaseLogger } from 'fastify';
import { config } from '../config.js';
import { ServiceTimeoutError, ServiceUnavailableError } from '../utils/errors.js';

const ASSISTANT_TIMEOUT_MS = 60000;
const ACTION_TIMEOUT_MS = 60000;

export type AssistantAction = 'save_note' | 'quiz_me' | 'find_moment' | 'explain';

export interface AssistantChatOptions {
  videoId: string;
  message: string;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  /** Forwarded as `X-Request-ID` header so the assistant binds it on contextvars. */
  requestId?: string;
}

export interface AssistantActionOptions {
  videoId: string;
  userId: string;
  action: AssistantAction;
  params?: Record<string, string | number | boolean>;
  /** Forwarded as `X-Request-ID` header so the assistant binds it on contextvars. */
  requestId?: string;
}

export interface AssistantActionResponse {
  success: boolean;
  action: string;
  data: Record<string, unknown> | null;
  error: string | null;
  trace_id: string;
}

export class AssistantClient {
  constructor(private readonly logger: FastifyBaseLogger) {}

  /**
   * Send a chat message to the assistant service and get SSE stream back.
   * Returns a ReadableStream that can be piped directly to the client.
   */
  async chat(options: AssistantChatOptions): Promise<ReadableStream<Uint8Array>> {
    const url = `${config.ASSISTANT_URL}/chat`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ASSISTANT_TIMEOUT_MS);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Internal-Secret': config.INTERNAL_SECRET,
    };
    if (options.requestId) {
      headers['X-Request-ID'] = options.requestId;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          video_id: options.videoId,
          message: options.message,
          conversation_history: (options.conversationHistory ?? []).map(m => ({
            role: m.role,
            content: m.content,
          })),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        this.logger.error({ status: response.status, error: errorText }, 'Assistant chat request failed');
        throw new ServiceUnavailableError('Assistant');
      }

      if (!response.body) {
        throw new ServiceUnavailableError('Assistant: empty response body');
      }

      clearTimeout(timeout);
      return response.body;
    } catch (err) {
      clearTimeout(timeout);
      if (err instanceof ServiceUnavailableError || err instanceof ServiceTimeoutError) {
        throw err;
      }
      if ((err as Error).name === 'AbortError') {
        throw new ServiceTimeoutError('Assistant');
      }
      this.logger.error(err, 'Assistant chat connection failed');
      throw new ServiceUnavailableError('Assistant');
    }
  }

  /**
   * Dispatch a structured action to the assistant service.
   * Returns the parsed JSON response — the assistant always replies with an
   * AssistantActionResponse envelope, even on validation/business errors.
   */
  async action(options: AssistantActionOptions): Promise<{
    status: number;
    body: AssistantActionResponse;
  }> {
    const url = `${config.ASSISTANT_URL}/action`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ACTION_TIMEOUT_MS);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Internal-Secret': config.INTERNAL_SECRET,
      'X-User-Id': options.userId,
    };
    if (options.requestId) {
      headers['X-Request-ID'] = options.requestId;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          video_id: options.videoId,
          action: options.action,
          params: options.params ?? {},
        }),
        signal: controller.signal,
      });

      const body = (await response.json().catch(() => null)) as AssistantActionResponse | null;
      clearTimeout(timeout);

      if (!body) {
        this.logger.error({ status: response.status }, 'Assistant action returned non-JSON body');
        throw new ServiceUnavailableError('Assistant');
      }

      return { status: response.status, body };
    } catch (err) {
      clearTimeout(timeout);
      if (err instanceof ServiceUnavailableError || err instanceof ServiceTimeoutError) {
        throw err;
      }
      if ((err as Error).name === 'AbortError') {
        throw new ServiceTimeoutError('Assistant');
      }
      this.logger.error(err, 'Assistant action connection failed');
      throw new ServiceUnavailableError('Assistant');
    }
  }
}
