/**
 * Video Examples Components - Dev Only
 *
 * Barrel export for video examples components.
 */

// Production guard
if (!import.meta.env.DEV) {
  throw new Error('video-examples components should not be imported in production');
}

export { CategoryVideoExample } from './CategoryVideoExample';
