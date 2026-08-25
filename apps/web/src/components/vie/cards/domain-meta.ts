/** Display metadata for content domains — identity-strip chip in VideoHero
 *  and the "Detected: …" moment in the streaming timeline. Kept outside the
 *  component files so fast refresh keeps working (component files must only
 *  export components). */
export const DOMAIN_META: Record<string, { emoji: string; label: string }> = {
  learning: { emoji: '📚', label: 'Learning' },
  tech: { emoji: '💻', label: 'Tech' },
  food: { emoji: '🍳', label: 'Cooking' },
  travel: { emoji: '✈️', label: 'Travel' },
  fitness: { emoji: '💪', label: 'Fitness' },
  music: { emoji: '🎵', label: 'Music' },
  review: { emoji: '⭐', label: 'Review' },
  project: { emoji: '🛠️', label: 'Project' },
  language: { emoji: '🗣️', label: 'Language' },
  science: { emoji: '🔬', label: 'Science' },
  narrative: { emoji: '📖', label: 'Narrative' },
};
