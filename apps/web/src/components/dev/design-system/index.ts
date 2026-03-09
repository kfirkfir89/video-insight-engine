/**
 * Design System Components - Dev Only
 *
 * Barrel export for all design system showcase components.
 */

// Production guard
if (!import.meta.env.DEV) {
  throw new Error('design-system components should not be imported in production');
}

export { ColorPalette } from './ColorPalette';
export { Typography } from './Typography';
export { SpacingScale } from './SpacingScale';
export { BlockShowcase } from './BlockShowcase';
