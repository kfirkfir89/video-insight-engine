import type { OutputType } from "@vie/types";

interface OutputTypeConfig {
  emoji: string;
  label: string;
  accentColor: string;
  gradient: string;
}

export const OUTPUT_TYPE_CONFIG: Record<OutputType, OutputTypeConfig> = {
  explanation: {
    emoji: "📝",
    label: "Explanation",
    accentColor: "var(--muted-foreground)",
    gradient: "linear-gradient(135deg, var(--muted), var(--secondary))",
  },
  recipe: {
    emoji: "🍳",
    label: "Recipe",
    accentColor: "var(--vie-coral)",
    gradient: "linear-gradient(135deg, var(--vie-coral), var(--vie-peach))",
  },
  code_walkthrough: {
    emoji: "💻",
    label: "Code Walkthrough",
    accentColor: "var(--vie-sky)",
    gradient: "linear-gradient(135deg, var(--vie-sky), var(--vie-mint))",
  },
  study_kit: {
    emoji: "📚",
    label: "Study Kit",
    accentColor: "var(--vie-plum)",
    gradient: "linear-gradient(135deg, var(--vie-plum), var(--vie-sky))",
  },
  trip_planner: {
    emoji: "✈️",
    label: "Trip Planner",
    accentColor: "var(--vie-forest)",
    gradient: "linear-gradient(135deg, var(--vie-forest), var(--vie-mint))",
  },
  workout: {
    emoji: "💪",
    label: "Workout",
    accentColor: "var(--vie-rose)",
    gradient: "linear-gradient(135deg, var(--vie-rose), var(--vie-coral))",
  },
  verdict: {
    emoji: "⭐",
    label: "Verdict",
    accentColor: "var(--vie-honey)",
    gradient: "linear-gradient(135deg, var(--vie-honey), var(--vie-peach))",
  },
  highlights: {
    emoji: "🎙️",
    label: "Highlights",
    accentColor: "var(--vie-peach)",
    gradient: "linear-gradient(135deg, var(--vie-peach), var(--vie-coral))",
  },
  music_guide: {
    emoji: "🎵",
    label: "Music Guide",
    accentColor: "var(--vie-rose)",
    gradient: "linear-gradient(135deg, var(--vie-rose), var(--vie-plum))",
  },
  project_guide: {
    emoji: "🔨",
    label: "Project Guide",
    accentColor: "var(--vie-honey)",
    gradient: "linear-gradient(135deg, var(--vie-honey), var(--vie-forest))",
  },
} as const;

export function getOutputTypeConfig(type: OutputType): OutputTypeConfig {
  return OUTPUT_TYPE_CONFIG[type] ?? OUTPUT_TYPE_CONFIG.explanation;
}
