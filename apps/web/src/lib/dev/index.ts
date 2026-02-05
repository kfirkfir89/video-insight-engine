/**
 * Dev Library - Barrel Export
 *
 * IMPORTANT: Dev-only module - tree-shaken in production.
 * All exports are guarded and should only be used in DEV mode.
 */

// Production guard
if (!import.meta.env.DEV) {
  throw new Error('lib/dev should not be imported in production');
}

export * from './mock-blocks';
export * from './mock-videos';
