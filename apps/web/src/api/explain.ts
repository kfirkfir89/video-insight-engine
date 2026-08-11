import { request } from "./client";

export interface ExplainAutoResponse {
  expansion: string;
}

export interface VideoChatResponse {
  response: string;
}

export const explainApi = {
  /** Get cached explanation for a section or concept */
  explainAuto(
    videoSummaryId: string,
    targetType: "section" | "concept",
    targetId: string
  ): Promise<ExplainAutoResponse> {
    return request(`/explain/${videoSummaryId}/${targetType}/${targetId}`);
  },

  /** Send a message to video chat */
  videoChat(
    videoSummaryId: string,
    message: string,
    chatHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
  ): Promise<VideoChatResponse> {
    return request("/explain/video-chat", {
      method: "POST",
      body: JSON.stringify({ videoSummaryId, message, chatHistory }),
    });
  },
};
