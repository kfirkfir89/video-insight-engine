import { useEffect } from "react";
import type { ReactNode } from "react";
import { useRightSidebarContext } from "@/components/layout/RightSidebarContext";

/**
 * Convenience hook for pages to push content into the layout-level right sidebar.
 * Automatically cleans up on unmount.
 *
 * **IMPORTANT:** `content` must be memoized (wrapped in useMemo) by the caller.
 * Passing inline JSX will cause infinite re-renders since ReactNode creates
 * a new reference on every render.
 */
export function useRightSidebar(content: ReactNode, enabled: boolean) {
  const { setRightSidebarContent, setRightSidebarEnabled } = useRightSidebarContext();

  useEffect(() => {
    setRightSidebarContent(content);
  }, [content, setRightSidebarContent]);

  useEffect(() => {
    setRightSidebarEnabled(enabled);
  }, [enabled, setRightSidebarEnabled]);

  useEffect(() => {
    return () => {
      setRightSidebarContent(null);
      setRightSidebarEnabled(false);
    };
  }, [setRightSidebarContent, setRightSidebarEnabled]);
}
