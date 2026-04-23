import { useCallback } from "react";
import { useUIStore } from "@/stores/ui-store";
import { withViewTransition } from "@/lib/view-transitions";

/**
 * Sidebar visibility controls wrapped in a typed View Transition so the layout
 * cross-fade feels intentional rather than instant. Use these everywhere the
 * sidebar's open state changes — direct `useUIStore.setState({ sidebarOpen })`
 * skips the transition.
 */
export function useSidebarToggle(): {
  toggle: () => void;
  setOpen: (open: boolean) => void;
} {
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen);

  const toggle = useCallback(() => {
    withViewTransition(toggleSidebar, { type: "sidebar-collapse" });
  }, [toggleSidebar]);

  const setOpen = useCallback((open: boolean) => {
    withViewTransition(() => setSidebarOpen(open), { type: "sidebar-collapse" });
  }, [setSidebarOpen]);

  return { toggle, setOpen };
}
