// ═══════════════════════════════════════════════════
// Share Types
// ═══════════════════════════════════════════════════

import type { OutputType } from './output-types.js';
import type { VideoContext } from './video.js';
import type { VideoSummary } from './video.js';

/** Sharing metadata attached to a VideoSummary */
export interface ShareInfo {
  shareSlug: string;
  sharedAt: string;        // ISO date
  viewsCount: number;
  likesCount: number;
}

/** Public-facing video summary for shared/embed pages (no auth required) */
export interface PublicVideoSummary {
  id: string;
  youtubeId: string;
  title: string;
  channel: string | null;
  thumbnailUrl: string | null;
  duration: number | null;
  outputType: OutputType | string;
  context: VideoContext | null;
  summary: VideoSummary;
  shareSlug: string;
  viewsCount: number;
  likesCount: number;
  sharedAt: string;        // ISO date
}
