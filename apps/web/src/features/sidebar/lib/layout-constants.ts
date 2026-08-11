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

/** Tailwind class for the minimized right panel width. */
export const RIGHT_PANEL_MINIMIZED_WIDTH = "w-11";

/**
 * Sidebar selection constants for click detection and selection mode.
 * Centralized to avoid magic strings scattered across components.
 */
export const SIDEBAR_SELECTION = {
  /** Data attribute name for sidebar items (folders/videos) */
  ITEM_ATTR: "data-sidebar-item",
  /** CSS selector for sidebar items */
  ITEM_SELECTOR: "[data-sidebar-item]",
  /** CSS selector for all interactive elements that should NOT exit selection mode when clicked */
  INTERACTIVE_SELECTOR:
    "[data-sidebar-item], button, a, input, textarea, [role='button'], [data-slot='checkbox']",
} as const;
