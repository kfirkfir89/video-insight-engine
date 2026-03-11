import type { ContentTag } from '@vie/types';

export const CONTENT_TAG_GRADIENT: Record<ContentTag, string> = {
  learning: 'linear-gradient(135deg, var(--vie-plum), var(--vie-sky))',
  food: 'linear-gradient(135deg, var(--vie-coral), var(--vie-peach))',
  tech: 'linear-gradient(135deg, var(--vie-sky), var(--vie-mint))',
  travel: 'linear-gradient(135deg, var(--vie-forest), var(--vie-mint))',
  fitness: 'linear-gradient(135deg, var(--vie-rose), var(--vie-coral))',
  review: 'linear-gradient(135deg, var(--vie-honey), var(--vie-peach))',
  music: 'linear-gradient(135deg, var(--vie-rose), var(--vie-plum))',
  project: 'linear-gradient(135deg, var(--vie-honey), var(--vie-forest))',
};

// Backward-compatible alias
export const OUTPUT_GRADIENT_VAR = CONTENT_TAG_GRADIENT;
