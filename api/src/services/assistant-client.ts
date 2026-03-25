import { FastifyBaseLogger } from 'fastify';
import { config } from '../config.js';
import { ServiceTimeoutError, ServiceUnavailableError } from '../utils/errors.js';

const ASSISTANT_TIMEOUT_MS = 60000;

export interface AssistantChatOptions {
  videoId: string;
  message: string;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
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

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Secret': config.INTERNAL_SECRET,
        },
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
}
