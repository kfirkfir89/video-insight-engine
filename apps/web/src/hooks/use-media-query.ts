import { useSyncExternalStore } from "react";

/**
 * Hook to detect if a CSS media query matches.
 * Uses useSyncExternalStore for proper sync with browser media query API.
 */
export function useMediaQuery(query: string): boolean {
  // Use useSyncExternalStore for proper external subscription
  const subscribe = (callback: () => void) => {
    const mediaQuery = window.matchMedia(query);
    mediaQuery.addEventListener("change", callback);
    return () => mediaQuery.removeEventListener("change", callback);
  };

  const getSnapshot = () => {
    return window.matchMedia(query).matches;
  };

  const getServerSnapshot = () => {
    // Default to false on server
    return false;
  };

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Hook to detect if viewport is desktop size (lg breakpoint: 1024px+)
 */
export function useIsDesktop(): boolean {
  return useMediaQuery("(min-width: 1024px)");
}
