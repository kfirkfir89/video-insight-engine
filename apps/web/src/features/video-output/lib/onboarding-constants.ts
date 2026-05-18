/**
 * Curated sample video used by the onboarding affordances on /generate.
 *
 * Picked because it's a stable, widely-shared explainer with permissive
 * embedding settings. Rotate quarterly via release notes if the upstream
 * video disappears or becomes paywalled. When swapping, also update the
 * unit test that asserts the sample URL is a valid YouTube watch URL.
 */
export const SAMPLE_VIDEO = {
  url: 'https://www.youtube.com/watch?v=iDbyYGrswtg',
  label: '"Attention Is All You Need" — explained in 8 min',
  durationLabel: '8 min',
} as const;

export type SampleVideo = typeof SAMPLE_VIDEO;
