import { memo } from 'react';
import { motion, useReducedMotion } from 'motion/react';

interface PlayCloseGlyphProps {
  /** Render the close (X) form when true, otherwise the play arrow. */
  open: boolean;
  className?: string;
}

// The two slanted edges of the play arrow are the same strokes that become the
// two bars of the X — they travel along their natural slope so the arrow visibly
// "bursts open" into the close mark rather than crossfading. The arrow's back
// edge collapses to the centre and fades, since the X needs no third stroke.
// Lucide has no play↔close morph (separate static icons), so this glyph is a
// deliberate custom SVG. Coordinates live in a 24×24 viewBox; the play triangle
// is nudged right so it sits optically centred inside the round button.
const EDGES = {
  top: {
    play: { x1: 9, y1: 6, x2: 17.5, y2: 12 },
    close: { x1: 6.5, y1: 6.5, x2: 17.5, y2: 17.5 },
  },
  bottom: {
    play: { x1: 9, y1: 18, x2: 17.5, y2: 12 },
    close: { x1: 6.5, y1: 17.5, x2: 17.5, y2: 6.5 },
  },
  back: {
    play: { x1: 9, y1: 6, x2: 9, y2: 18, opacity: 1 },
    close: { x1: 12, y1: 12, x2: 12, y2: 12, opacity: 0 },
  },
} as const;

export const PlayCloseGlyph = memo(function PlayCloseGlyph({ open, className }: PlayCloseGlyphProps) {
  const reduceMotion = useReducedMotion();
  const state = open ? 'close' : 'play';
  const transition = reduceMotion
    ? { duration: 0 }
    : ({ type: 'spring', stiffness: 380, damping: 26, mass: 0.7 } as const);

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      data-state={state}
      aria-hidden="true"
      className={className}
    >
      <motion.line initial={false} animate={EDGES.top[state]} transition={transition} />
      <motion.line initial={false} animate={EDGES.bottom[state]} transition={transition} />
      <motion.line initial={false} animate={EDGES.back[state]} transition={transition} />
    </svg>
  );
});
