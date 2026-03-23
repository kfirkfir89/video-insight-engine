import type { ContentTag } from "@vie/types";
import {
  CONTENT_TAG_VALUES,
  getDomainConfig,
} from "@vie/shared/config";

interface ContentTagConfig {
  emoji: string;
  label: string;
  gradient: string;
}

export const CONTENT_TAG_CONFIG: Record<ContentTag, ContentTagConfig> =
  Object.fromEntries(
    CONTENT_TAG_VALUES.map((tag) => [tag, getDomainConfig(tag)])
  ) as Record<ContentTag, ContentTagConfig>;

export function getContentTagConfig(tag: ContentTag): ContentTagConfig {
  return CONTENT_TAG_CONFIG[tag] ?? CONTENT_TAG_CONFIG.learning;
}

// Backward-compatible aliases
export type OutputType = ContentTag;
export const OUTPUT_TYPE_CONFIG = CONTENT_TAG_CONFIG;
export const getOutputTypeConfig = getContentTagConfig;
