import type { OutputType } from "@vie/types";

interface OutputTypeConfig {
  emoji: string;
  label: string;
  accentColor: string;
  gradient: string;
}

export const OUTPUT_TYPE_CONFIG: Record<OutputType, OutputTypeConfig> = {
  recipe: {
    emoji: "🍳",
    label: "Recipe",
    accentColor: "var(--vie-coral)",
    gradient: "linear-gradient(135deg, var(--vie-coral), var(--vie-peach))",
  },
  tutorial: {
    emoji: "💻",
    label: "Tutorial",
    accentColor: "var(--vie-sky)",
    gradient: "linear-gradient(135deg, var(--vie-sky), var(--vie-mint))",
  },
  workout: {
    emoji: "💪",
    label: "Workout",
    accentColor: "var(--vie-rose)",
    gradient: "linear-gradient(135deg, var(--vie-rose), var(--vie-coral))",
  },
  study_guide: {
    emoji: "📚",
    label: "Study Guide",
    accentColor: "var(--vie-plum)",
    gradient: "linear-gradient(135deg, var(--vie-plum), var(--vie-sky))",
  },
  travel_plan: {
    emoji: "✈️",
    label: "Travel Plan",
    accentColor: "var(--vie-forest)",
    gradient: "linear-gradient(135deg, var(--vie-forest), var(--vie-mint))",
  },
  review: {
    emoji: "⭐",
    label: "Review",
    accentColor: "var(--vie-honey)",
    gradient: "linear-gradient(135deg, var(--vie-honey), var(--vie-peach))",
  },
  podcast_notes: {
    emoji: "🎙️",
    label: "Podcast Notes",
    accentColor: "var(--vie-peach)",
    gradient: "linear-gradient(135deg, var(--vie-peach), var(--vie-coral))",
  },
  diy_guide: {
    emoji: "🔨",
    label: "DIY Guide",
    accentColor: "var(--vie-honey)",
    gradient: "linear-gradient(135deg, var(--vie-honey), var(--vie-forest))",
  },
  game_guide: {
    emoji: "🎮",
    label: "Game Guide",
    accentColor: "var(--vie-sky)",
    gradient: "linear-gradient(135deg, var(--vie-sky), var(--vie-plum))",
  },
  music_guide: {
    emoji: "🎵",
    label: "Music Guide",
    accentColor: "var(--vie-rose)",
    gradient: "linear-gradient(135deg, var(--vie-rose), var(--vie-plum))",
  },
  summary: {
    emoji: "📝",
    label: "Summary",
    accentColor: "var(--muted-foreground)",
    gradient: "linear-gradient(135deg, var(--muted), var(--secondary))",
  },
} as const;

export function getOutputTypeConfig(type: OutputType): OutputTypeConfig {
  return OUTPUT_TYPE_CONFIG[type] ?? OUTPUT_TYPE_CONFIG.summary;
}
