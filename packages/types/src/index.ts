// ═══════════════════════════════════════════════════
// VIDEO INSIGHT ENGINE - Shared Types
// Clean re-exports organized by domain.
// ═══════════════════════════════════════════════════

// Common (status, transcript, generation)
export * from './common.js';

// User & Tier
export * from './user.js';

// Content Blocks
export * from './content-blocks.js';

// Video (context, chapters, summary, response)
export * from './video.js';

// Memorized Items
export * from './memorized.js';

// Playlists
export * from './playlist.js';

// Sharing
export * from './share.js';

// API responses, errors, WebSocket/SSE events
export * from './api.js';

// Output types (triage pipeline, enrichment, synthesis)
export * from './output-types.js';

// VIE Response (domain data interfaces, triage result)
export * from './vie-response.js';
