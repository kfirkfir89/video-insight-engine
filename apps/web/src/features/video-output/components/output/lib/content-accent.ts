import type { CSSProperties } from 'react';

/**
 * Maps a content tag (domain) to a VIE palette CSS variable so each
 * component can express its domain with a distinct accent color.
 * Unknown / missing tags fall back to the primary brand token.
 */
const ACCENT_MAP: Record<string, string> = {
  learning: 'var(--vie-plum)',
  cooking: 'var(--vie-coral)',
  food: 'var(--vie-coral)',
  fitness: 'var(--vie-rose)',
  tech: 'var(--vie-mint)',
  finance: 'var(--vie-honey)',
  travel: 'var(--vie-sky)',
  music: 'var(--vie-plum)',
  review: 'var(--vie-coral)',
  language: 'var(--vie-sky)',
  science: 'var(--vie-mint)',
  project: 'var(--vie-honey)',
  narrative: 'var(--vie-plum)',
};

export function getAccentForTag(contentTag?: string): string {
  if (!contentTag) return 'var(--primary)';
  return ACCENT_MAP[contentTag] ?? 'var(--primary)';
}

/**
 * Build a style object exposing `--vie-accent` for descendant elements.
 * Callers spread this onto their root wrapper so child selectors like
 * `text-[var(--vie-accent)]` pick up the domain color.
 */
export function accentStyle(contentTag?: string): CSSProperties {
  return { '--vie-accent': getAccentForTag(contentTag) } as CSSProperties;
}
