import { FastifyBaseLogger } from 'fastify';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { config } from '../config.js';
import { ServiceTimeoutError, ServiceUnavailableError } from '../utils/errors.js';

export interface ExplainAutoResult {
  expansion: string;
}

export interface VideoChatResult {
  response: string;
}

const MCP_TIMEOUT_MS = 30000;

export class ExplainerClient {
  private client: Client | null = null;
  private connecting = false;

  constructor(private readonly logger: FastifyBaseLogger) {}

  private async getClient(): Promise<Client> {
    if (this.client) return this.client;
    if (this.connecting) {
      // Wait for ongoing connection with timeout
      const start = Date.now();
      await new Promise<void>((resolve, reject) => {
        const check = setInterval(() => {
          if (!this.connecting) {
            clearInterval(check);
            resolve();
          } else if (Date.now() - start > MCP_TIMEOUT_MS) {
            clearInterval(check);
            reject(new ServiceTimeoutError('Explainer connection'));
          }
        }, 50);
      });
      if (this.client) return this.client;
    }

    this.connecting = true;
    try {
      const transport = new StreamableHTTPClientTransport(
        new URL(`${config.EXPLAINER_URL}/mcp`)
      );
      const client = new Client({ name: 'vie-api', version: '1.0.0' });
      await client.connect(transport);
      this.client = client;
      this.logger.info('MCP client connected to vie-explainer');
      return client;
    } catch (err) {
      this.logger.error(err, 'Failed to connect MCP client');
      throw new ServiceUnavailableError('Explainer MCP');
    } finally {
      this.connecting = false;
    }
  }

  private async callToolWithTimeout<T>(
    name: string,
    args: Record<string, unknown>
  ): Promise<T> {
    const client = await this.getClient();

    let timeoutId: ReturnType<typeof setTimeout>;
    const result = await Promise.race([
      client.callTool({ name, arguments: args }),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new ServiceTimeoutError('Explainer')), MCP_TIMEOUT_MS);
      }),
    ]);
    clearTimeout(timeoutId!);

    // Extract text content from MCP response
    const content = result.content;
    if (Array.isArray(content) && content.length > 0) {
      const textContent = content[0];
      if (textContent && typeof textContent === 'object' && 'text' in textContent) {
        return textContent.text as T;
      }
    }

    throw new ServiceUnavailableError('Explainer: empty response');
  }

  /**
   * Call explain_auto MCP tool to generate documentation for a section or concept.
   * Results are cached by vie-explainer.
   */
  async explainAuto(
    videoSummaryId: string,
    targetType: 'section' | 'concept',
    targetId: string
  ): Promise<ExplainAutoResult> {
    try {
      const expansion = await this.callToolWithTimeout<string>('explain_auto', {
        video_summary_id: videoSummaryId,
        target_type: targetType,
        target_id: targetId,
      });
      return { expansion };
    } catch (err) {
      if (err instanceof ServiceTimeoutError || err instanceof ServiceUnavailableError) {
        throw err;
      }
      this.logger.error(err, 'explainAuto MCP call failed');
      // Reset client on unexpected errors
      this.client = null;
      throw new ServiceUnavailableError('Explainer');
    }
  }

  /**
   * Call video_chat MCP tool for video-scoped conversation.
   * Ephemeral — no server-side persistence.
   */
  async videoChat(
    videoSummaryId: string,
    message: string,
    chatHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
  ): Promise<VideoChatResult> {
    try {
      const response = await this.callToolWithTimeout<string>('video_chat', {
        video_summary_id: videoSummaryId,
        user_message: message,
        chat_history: chatHistory ?? null,
      });
      return { response };
    } catch (err) {
      if (err instanceof ServiceTimeoutError || err instanceof ServiceUnavailableError) {
        throw err;
      }
      this.logger.error(err, 'videoChat MCP call failed');
      this.client = null;
      throw new ServiceUnavailableError('Explainer');
    }
  }
}
