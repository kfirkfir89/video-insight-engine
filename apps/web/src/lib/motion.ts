/**
 * Shared motion presets for the VIE component library.
 *
 * Rule: motion should feel inevitable, never performative.
 * Reserve elastic / overshoot springs for celebration moments only.
 */
import type { Transition, Variants } from 'motion/react';

export const springs = {
  /** Soft landing — default for entrances, card hovers, layout shifts. */
  soft: { type: 'spring', stiffness: 260, damping: 28, mass: 0.8 },
  /** Snappier — buttons, toggles, small UI reactions. */
  crisp: { type: 'spring', stiffness: 420, damping: 32, mass: 0.7 },
  /** Playful — reserved for celebration (score reveal, correct answer). */
  bouncy: { type: 'spring', stiffness: 480, damping: 18, mass: 0.9 },
  /** Heavy slab — content sliding in under its own weight. */
  weighty: { type: 'spring', stiffness: 180, damping: 26, mass: 1.2 },
} as const satisfies Record<string, Transition>;

export const easings = {
  outExpo: [0.16, 1, 0.3, 1] as const,
  outQuart: [0.25, 1, 0.5, 1] as const,
  outQuint: [0.22, 1, 0.36, 1] as const,
  smooth: [0.4, 0, 0.2, 1] as const,
} as const;

/** Standard fade-up entrance used across cards and content blocks. */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { ...springs.soft } },
};

/** Quicker, smaller — for list items inside a stagger. */
export const fadeUpTight: Variants = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.32, ease: easings.outExpo } },
};

/** Scale-in — for modal content, badges, emoji popping. */
export const popIn: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { opacity: 1, scale: 1, transition: { ...springs.crisp } },
};

/** Parent orchestrator — stagger children on enter. */
export const stagger = (delayChildren = 0, staggerChildren = 0.06): Variants => ({
  hidden: {},
  visible: {
    transition: { delayChildren, staggerChildren },
  },
});

/** Viewport options matching `@starting-style` feel — fire once, within 10% of frame. */
export const inViewOptions = { once: true, margin: '0px 0px -10% 0px' } as const;
