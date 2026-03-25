import { getAccessToken, refreshToken } from "@/api/client";
import { useAuthStore } from "@/stores/auth-store";

export interface AssistantChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AssistantSource {
  text: string;
  timestamp?: string;
  score: number;
  chunk_index: number;
}

export interface AssistantChatEvent {
  type: "text" | "source" | "tool_result" | "error" | "done";
  content?: string;
  sources?: AssistantSource[];
  metadata?: Record<string, unknown>;
}

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

/**
 * Send a chat message to the assistant service and receive SSE events.
 * Uses the API proxy at /api/videos/:videoSummaryId/chat.
 *
 * Auth follows the same pattern as the main API client:
 * - Bearer token from localStorage via getAccessToken()
 * - Automatic token refresh on 401
 * - Force logout on refresh failure
 */
export async function sendAssistantMessage(
  videoSummaryId: string,
  message: string,
  conversationHistory: AssistantChatMessage[],
  onEvent: (event: AssistantChatEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const token = getAccessToken();

  const response = await fetchAssistantStream(
    videoSummaryId,
    message,
    conversationHistory,
    token,
    signal,
  );

  // Handle 401 — try token refresh once (mirrors api/client.ts pattern)
  if (response.status === 401 && token) {
    const refreshed = await refreshToken();
    if (refreshed) {
      const newToken = getAccessToken();
      const retryResponse = await fetchAssistantStream(
        videoSummaryId,
        message,
        conversationHistory,
        newToken,
        signal,
      );
      if (!retryResponse.ok) {
        throw new Error(`Assistant chat failed: ${retryResponse.status}`);
      }
      await readAssistantSSEStream(retryResponse, onEvent);
      return;
    }
    useAuthStore.getState().forceLogout("Session expired. Please log in again.");
    throw new Error("Session expired");
  }

  if (!response.ok) {
    throw new Error(`Assistant chat failed: ${response.status}`);
  }

  await readAssistantSSEStream(response, onEvent);
}

/** Build and send the fetch request to the assistant chat endpoint. */
function fetchAssistantStream(
  videoSummaryId: string,
  message: string,
  conversationHistory: AssistantChatMessage[],
  token: string | null,
  signal?: AbortSignal,
): Promise<Response> {
  return fetch(`${API_URL}/videos/${videoSummaryId}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: "include",
    body: JSON.stringify({
      message,
      conversationHistory: conversationHistory.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    }),
    signal,
  });
}

/** Parse an SSE response body and dispatch events via the callback. */
async function readAssistantSSEStream(
  response: Response,
  onEvent: (event: AssistantChatEvent) => void,
): Promise<void> {
  if (!response.body) {
    throw new Error("No response body");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6);
        if (data === "[DONE]") continue;

        try {
          const event = JSON.parse(data) as AssistantChatEvent;
          onEvent(event);
        } catch {
          // Skip malformed SSE events
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
