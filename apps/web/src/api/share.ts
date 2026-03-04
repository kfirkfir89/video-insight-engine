import type { ContentBlock, OutputType } from "@vie/types";
import { request } from "./client";

interface ShareLinkResponse {
  slug: string;
  url: string;
}

export interface SharedOutput {
  title: string;
  tldr?: string;
  outputType: OutputType;
  blocks: ContentBlock[];
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
