import { config } from '../config.js';

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

/**
 * Call explain_auto endpoint to generate documentation for a section or concept.
 * Results are cached by vie-explainer.
 */
export async function explainAuto(
  videoSummaryId: string,
  targetType: 'section' | 'concept',
  targetId: string
): Promise<ExplainAutoResult> {
  const response = await fetch(`${config.EXPLAINER_URL}/explain/auto`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      videoSummaryId,
      targetType,
      targetId,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `Explainer returned ${response.status}`);
  }

  return response.json();
}

/**
 * Call explain_chat endpoint for interactive conversation about a memorized item.
 * Personalized per user, not cached.
 */
export async function explainChat(
  request: ExplainChatRequest
): Promise<ExplainChatResult> {
  const response = await fetch(`${config.EXPLAINER_URL}/explain/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      memorizedItemId: request.memorizedItemId,
      userId: request.userId,
      message: request.message,
      ...(request.chatId && { chatId: request.chatId }),
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `Explainer returned ${response.status}`);
  }

  return response.json();
}
