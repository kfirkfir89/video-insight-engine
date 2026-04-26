const MOOD_COLORS: Record<string, string> = {
  highlight: 'oklch(85% 0.15 85)',
  info: 'oklch(70% 0.12 240)',
  demo: 'oklch(75% 0.15 145)',
  warning: 'oklch(65% 0.18 25)',
  chapter: 'oklch(68% 0.04 280)',
};

const DEFAULT_MOOD_COLOR = 'oklch(70% 0.05 250)';

export function getMoodColor(mood?: string | null): string {
  if (!mood) return DEFAULT_MOOD_COLOR;
  return MOOD_COLORS[mood.toLowerCase()] ?? DEFAULT_MOOD_COLOR;
}
