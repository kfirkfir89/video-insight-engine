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
 * Build a style object exposing `--vie-accent` (and its contrast-safe
 * `--vie-accent-foreground`) for descendant elements. Callers spread this onto
 * their root wrapper so child selectors like `text-[var(--vie-accent)]` and
 * `text-[var(--vie-accent-foreground)]` pick up the domain color.
 *
 * `--vie-accent-foreground` and `--vie-accent-ink` are re-emitted here (not
 * just inherited from :root) so the `oklch(from var(--vie-accent) …)`
 * computation runs against THIS wrapper's overridden accent. `-foreground` is
 * text ON a solid accent fill; `-ink` is accent-colored text on the page
 * surface (its lightness clamp, `--vie-accent-ink-l`, stays theme-owned in
 * index.css so light and dark resolve differently).
 */
export function accentStyle(contentTag?: string): CSSProperties {
  return {
    '--vie-accent': getAccentForTag(contentTag),
    '--vie-accent-foreground':
      'oklch(from var(--vie-accent) calc(0.18 + 0.8 * clamp(0, (0.62 - l) * 100, 1)) 0.015 280)',
    '--vie-accent-ink': 'oklch(from var(--vie-accent) var(--vie-accent-ink-l) c h)',
  } as CSSProperties;
}
