import { request } from "./client";
import type { Video, VideoSummary } from "@/types";

export const videosApi = {
  async list(folderId?: string): Promise<{ videos: Video[] }> {
    const params = folderId ? `?folderId=${folderId}` : "";
    return request(`/videos${params}`);
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

  async moveToFolder(id: string, folderId: string | null): Promise<{ success: boolean }> {
    return request(`/videos/${id}/move`, {
      method: "PATCH",
      body: JSON.stringify({ folderId }),
    });
  },
};
