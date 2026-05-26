import type { TabEntry, VIEResponseMeta } from "@vie/types";
import { request } from "./client";

interface ShareLinkResponse {
  slug: string;
  url: string;
}

export interface SharedOutput {
  id: string;
  youtubeId: string;
  title: string;
  creator: string | null;
  thumbnailUrl: string | null;
  duration: number | null;
  status: string;
  meta: VIEResponseMeta | null;
  tabs: TabEntry[] | null;
  /** English-translated tabs (populated for non-English videos). Preferred for shared rendering. */
  tabs_en?: TabEntry[] | null;
  /** English-translated meta (populated for non-English videos). Preferred for shared rendering. */
  meta_en?: VIEResponseMeta | null;
  /** English-translated synthesis (populated for non-English videos). */
  synthesis_en?: Record<string, unknown> | null;
  /** Set when the pipeline overrode the language to English (e.g., instrumental music). */
  forceEnglishReason?: "sound_only";
  shareSlug: string;
  viewsCount: number;
  likesCount: number;
  sharedAt: string;
}

export const shareApi = {
  createShareLink: async (
    videoId: string,
    outputId: string
  ): Promise<ShareLinkResponse> => {
    return request(`/videos/${videoId}/share`, {
      method: "POST",
      body: JSON.stringify({ outputId }),
    });
  },

  getSharedOutput: async (slug: string): Promise<SharedOutput> => {
    if (!/^[a-zA-Z0-9_-]+$/.test(slug)) {
      throw new Error("Invalid share slug");
    }
    return request(`/share/${slug}`);
  },
};
