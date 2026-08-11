// ═══════════════════════════════════════════════════
// Share Types
// ═══════════════════════════════════════════════════

/** Sharing metadata attached to a VideoSummary */
export interface ShareInfo {
  shareSlug: string;
  sharedAt: string;        // ISO date
  viewsCount: number;
  likesCount: number;
}
