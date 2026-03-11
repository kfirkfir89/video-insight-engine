import type { ContentTag } from "@vie/types";

interface ContentTagConfig {
  emoji: string;
  label: string;
  gradient: string;
}

export const CONTENT_TAG_CONFIG: Record<ContentTag, ContentTagConfig> = {
  learning: {
    emoji: "📚",
    label: "Learning",
    gradient: "linear-gradient(135deg, var(--vie-plum), var(--vie-sky))",
  },
  food: {
    emoji: "🍳",
    label: "Food",
    gradient: "linear-gradient(135deg, var(--vie-coral), var(--vie-peach))",
  },
  tech: {
    emoji: "💻",
    label: "Tech",
    gradient: "linear-gradient(135deg, var(--vie-sky), var(--vie-mint))",
  },
  travel: {
    emoji: "✈️",
    label: "Travel",
    gradient: "linear-gradient(135deg, var(--vie-forest), var(--vie-mint))",
  },
  fitness: {
    emoji: "💪",
    label: "Fitness",
    gradient: "linear-gradient(135deg, var(--vie-rose), var(--vie-coral))",
  },
  review: {
    emoji: "⭐",
    label: "Review",
    gradient: "linear-gradient(135deg, var(--vie-honey), var(--vie-peach))",
  },
  music: {
    emoji: "🎵",
    label: "Music",
    gradient: "linear-gradient(135deg, var(--vie-rose), var(--vie-plum))",
  },
  project: {
    emoji: "🔨",
    label: "Project",
    gradient: "linear-gradient(135deg, var(--vie-honey), var(--vie-forest))",
  },
} as const;

export function getContentTagConfig(tag: ContentTag): ContentTagConfig {
  return CONTENT_TAG_CONFIG[tag] ?? CONTENT_TAG_CONFIG.learning;
}

// Backward-compatible aliases
export type OutputType = ContentTag;
export const OUTPUT_TYPE_CONFIG = CONTENT_TAG_CONFIG;
export const getOutputTypeConfig = getContentTagConfig;
