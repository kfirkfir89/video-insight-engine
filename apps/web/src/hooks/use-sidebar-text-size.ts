import { useUIStore, type SidebarTextSize } from "@/stores/ui-store";

interface SidebarSizeClasses {
  size: SidebarTextSize;
  /** Main text class (folder names, video titles) */
  mainText: string;
  /** Badge/count text class */
  badgeText: string;
  /** Section header text class */
  headerText: string;
  /** Primary icon size (folder, film icons) */
  iconSize: string;
  /** Secondary icon size (chevron, plus, more icons) */
  smallIconSize: string;
  /** Row height for folder/video items */
  rowHeight: string;
  /** Vertical padding for rows */
  rowPadding: string;
}

/**
 * Hook that returns Tailwind classes for sidebar sizing based on user preference.
 * Includes text, icons, and spacing for proportional scaling.
 *
 * Size mapping:
 * - Small: compact layout with smaller text and icons
 * - Medium: default balanced layout
 * - Large: expanded layout with larger text and icons
 */
export function useSidebarTextClasses(): SidebarSizeClasses {
  const size = useUIStore((s) => s.sidebarTextSize);

  const classes: Record<SidebarTextSize, Omit<SidebarSizeClasses, "size">> = {
    small: {
      mainText: "text-xs",
      badgeText: "text-[10px]",
      headerText: "text-xs",
      iconSize: "h-3.5 w-3.5",
      smallIconSize: "h-3 w-3",
      rowHeight: "h-6",
      rowPadding: "py-0.5",
    },
    medium: {
      mainText: "text-sm",
      badgeText: "text-xs",
      headerText: "text-sm",
      iconSize: "h-4 w-4",
      smallIconSize: "h-3.5 w-3.5",
      rowHeight: "h-7",
      rowPadding: "py-1",
    },
    large: {
      mainText: "text-lg",
      badgeText: "text-base",
      headerText: "text-lg",
      iconSize: "h-5 w-5",
      smallIconSize: "h-4 w-4",
      rowHeight: "h-9",
      rowPadding: "py-1.5",
    },
  };

  return {
    size,
    ...classes[size],
  };
}
