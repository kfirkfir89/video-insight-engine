import { request } from "./client";
import type { Video, VideoSummary } from "@/types";

export interface ListVideosParams {
  folderId?: string;
  limit?: number;
  offset?: number;
}

export interface ListVideosResponse {
  videos: Video[];
  total?: number;
  hasMore?: boolean;
}

export const videosApi = {
  async list(params: ListVideosParams = {}): Promise<ListVideosResponse> {
    const searchParams = new URLSearchParams();
    if (params.folderId) searchParams.set("folderId", params.folderId);
    if (params.limit) searchParams.set("limit", String(params.limit));
    if (params.offset) searchParams.set("offset", String(params.offset));

    const query = searchParams.toString();
    return request(`/videos${query ? `?${query}` : ""}`);
  },

  async get(
    id: string
  ): Promise<{ video: Video; summary: VideoSummary | null }> {
    return request(`/videos/${id}`);
  },

  async create(
    url: string,
    folderId?: string
  ): Promise<{ video: Video; cached: boolean }> {
    return request("/videos", {
      method: "POST",
      body: JSON.stringify({ url, folderId }),
    });
  },

  async delete(id: string): Promise<void> {
    await request(`/videos/${id}`, { method: "DELETE" });
  },

  async moveToFolder(
    id: string,
    folderId: string | null
  ): Promise<{ success: boolean }> {
    return request(`/videos/${id}/move`, {
      method: "PATCH",
      body: JSON.stringify({ folderId }),
    });
  },
};
