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
      iconSize: "h-4 w-4",
      smallIconSize: "h-3.5 w-3.5",
      rowHeight: "h-7",
      rowPadding: "py-1",
    },
    medium: {
      mainText: "text-sm",
      badgeText: "text-xs",
      headerText: "text-sm",
      iconSize: "h-[18px] w-[18px]",
      smallIconSize: "h-4 w-4",
      rowHeight: "h-8",
      rowPadding: "py-1.5",
    },
    large: {
      mainText: "text-lg",
      badgeText: "text-base",
      headerText: "text-lg",
      iconSize: "h-6 w-6",
      smallIconSize: "h-5 w-5",
      rowHeight: "h-10",
      rowPadding: "py-2",
    },
  };

  return {
    size,
    ...classes[size],
  };
}
