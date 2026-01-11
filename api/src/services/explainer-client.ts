import { config } from '../config.js';
import { ServiceTimeoutError, ServiceUnavailableError } from '../utils/errors.js';

export interface ExplainAutoResult {
  expansion: string;
}

export interface ExplainChatResult {
  chatId: string;
  response: string;
}

export interface ExplainChatRequest {
  memorizedItemId: string;
  userId: string;
  message: string;
  chatId?: string;
}

const EXPLAINER_TIMEOUT_MS = 30000; // 30 seconds (LLM calls can be slow)

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Call explain_auto endpoint to generate documentation for a section or concept.
 * Results are cached by vie-explainer.
 */
export async function explainAuto(
  videoSummaryId: string,
  targetType: 'section' | 'concept',
  targetId: string
): Promise<ExplainAutoResult> {
  try {
    const response = await fetchWithTimeout(
      `${config.EXPLAINER_URL}/explain/auto`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoSummaryId,
          targetType,
          targetId,
        }),
      },
      EXPLAINER_TIMEOUT_MS
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new ServiceUnavailableError(`Explainer: ${error.detail || response.status}`);
    }

    return response.json();
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new ServiceTimeoutError('Explainer');
    }
    if (err instanceof ServiceUnavailableError || err instanceof ServiceTimeoutError) {
      throw err;
    }
    throw new ServiceUnavailableError('Explainer');
  }
}

/**
 * Call explain_chat endpoint for interactive conversation about a memorized item.
 * Personalized per user, not cached.
 */
export async function explainChat(
  request: ExplainChatRequest
): Promise<ExplainChatResult> {
  try {
    const response = await fetchWithTimeout(
      `${config.EXPLAINER_URL}/explain/chat`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memorizedItemId: request.memorizedItemId,
          userId: request.userId,
          message: request.message,
          ...(request.chatId && { chatId: request.chatId }),
        }),
      },
      EXPLAINER_TIMEOUT_MS
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new ServiceUnavailableError(`Explainer: ${error.detail || response.status}`);
    }

    return response.json();
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new ServiceTimeoutError('Explainer');
    }
    if (err instanceof ServiceUnavailableError || err instanceof ServiceTimeoutError) {
      throw err;
    }
    throw new ServiceUnavailableError('Explainer');
  }
}
