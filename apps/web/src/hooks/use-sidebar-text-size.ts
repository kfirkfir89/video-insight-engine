import { useUIStore, type SidebarTextSize } from "@/stores/ui-store";

interface SidebarTextSizeClasses {
  size: SidebarTextSize;
  /** Main text class (folder names, video titles) */
  mainText: string;
  /** Badge/count text class */
  badgeText: string;
  /** Section header text class */
  headerText: string;
}

/**
 * Hook that returns Tailwind classes for sidebar text based on user preference.
 *
 * Size mapping:
 * - Small: text-xs for main, text-[10px] for badges
 * - Medium: text-sm for main, text-xs for badges (default)
 * - Large: text-lg for main, text-base for badges
 */
export function useSidebarTextClasses(): SidebarTextSizeClasses {
  const size = useUIStore((s) => s.sidebarTextSize);

  const classes: Record<SidebarTextSize, Omit<SidebarTextSizeClasses, "size">> = {
    small: {
      mainText: "text-xs",
      badgeText: "text-[10px]",
      headerText: "text-xs",
    },
    medium: {
      mainText: "text-sm",
      badgeText: "text-xs",
      headerText: "text-sm",
    },
    large: {
      mainText: "text-lg",
      badgeText: "text-base",
      headerText: "text-lg",
    },
  };

  return {
    size,
    ...classes[size],
  };
}
