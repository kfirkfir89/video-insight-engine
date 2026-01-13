/**
 * Shared layout constants for consistent spacing across components.
 *
 * These values ensure visual consistency in the sidebar and other
 * nested/hierarchical UI elements.
 */

/** Sidebar layout constants for consistent indentation */
export const SIDEBAR_LAYOUT = {
  /** Pixels of indentation per folder/item level */
  INDENT_PER_LEVEL: 12,
  /** Base padding for sidebar items (left padding at level 0) */
  BASE_PADDING: 8,
} as const;
