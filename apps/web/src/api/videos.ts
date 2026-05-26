import { request } from "./client";
import type { Video } from "@/types";
import type { TabEntry, VIEResponseMeta } from "@vie/types";

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

export type Provider = "anthropic" | "openai" | "gemini";

export interface ProviderConfig {
  default: Provider;
  fast?: Provider;
  fallback?: Provider | null;
}

export interface VideoDetail {
  id: string;
  videoSummaryId: string;
  youtubeId: string;
  title: string;
  creator: string | null;
  duration: number | null;
  thumbnailUrl: string | null;
  status: string;
  folderId: string | null;
  meta: VIEResponseMeta | null;
  tabs: TabEntry[] | null;
  /** English-translated tabs (populated by the translation phase for non-English videos). */
  tabs_en?: TabEntry[] | null;
  /** English-translated meta (populated by the translation phase for non-English videos). */
  meta_en?: VIEResponseMeta | null;
  /** English-translated synthesis (populated by the translation phase for non-English videos). */
  synthesis_en?: Record<string, unknown> | null;
  /** Set when the pipeline overrode the language to English (e.g., instrumental music). */
  forceEnglishReason?: "sound_only";
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

  async get(id: string): Promise<VideoDetail> {
    return request(`/videos/${id}`);
  },

  async create(
    url: string,
    folderId?: string,
    bypassCache?: boolean,
    providers?: ProviderConfig
  ): Promise<{ video: Video; cached: boolean; duplicate?: boolean }> {
    return request("/videos", {
      method: "POST",
      body: JSON.stringify({
        url,
        folderId,
        bypassCache,
        providers,
      }),
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
