import { useRef, useCallback, useEffect, lazy, Suspense } from "react";
import type { ReactNode } from "react";
import { useUIStore } from "@/stores/ui-store";
import { useRightSidebarContext } from "@/components/layout/RightSidebarContext";
import { useIsLargeDesktop } from "@/hooks/use-media-query";
import { LeftSidebarIconStrip } from "./LeftSidebarIconStrip";
import { ScrollContainer } from "@/components/ui/scroll-container";
import { cn } from "@/lib/utils";

const RIGHT_PANEL_WIDTH = 360;
const CUBE_STRIP_WIDTH = 64;

// Lazy load Sidebar - it includes DnD Kit context (~100KB)
const Sidebar = lazy(() =>
  import("@/components/sidebar").then((m) => ({ default: m.Sidebar }))
);

function SidebarSkeleton() {
  return (
    <div className="h-full bg-card border-r animate-pulse flex flex-col">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border/50">
        <div className="h-7 w-7 bg-muted rounded-lg" />
        <div className="h-4 bg-muted rounded w-24" />
      </div>
      <div className="px-3 py-2">
        <div className="h-8 bg-muted rounded-md" />
      </div>
      <div className="flex gap-4 px-3 py-2 border-b border-border/50">
        <div className="h-4 bg-muted rounded w-20" />
        <div className="h-4 bg-muted rounded w-20" />
      </div>
      <div className="flex-1 p-3 space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-8 bg-muted rounded-md" />
        ))}
      </div>
    </div>
  );
}

interface LayoutProps {
  children: ReactNode;
  showSidebar?: boolean;
}

export function Layout({ children, showSidebar = true }: LayoutProps) {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const activeRightPanel = useUIStore((s) => s.activeRightPanel);
  const sidebarWidth = useUIStore((s) => s.sidebarWidth);
  const setSidebarWidth = useUIStore((s) => s.setSidebarWidth);

  const isLargeDesktop = useIsLargeDesktop();
  const { sidebarContent, sidebarEnabled } = useRightSidebarContext();
  const showRightSidebar = isLargeDesktop && sidebarEnabled && !!sidebarContent;
  const rightPanelExpanded = showRightSidebar && activeRightPanel !== "none";

  // Resize refs
  const startXRef = useRef(0);
  const startWidthRef = useRef(360);
  const rafIdRef = useRef<number | null>(null);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
    }
    rafIdRef.current = requestAnimationFrame(() => {
      const newWidth = startWidthRef.current + (e.clientX - startXRef.current);
      if (newWidth >= 300 && newWidth <= 500) {
        setSidebarWidth(newWidth);
      }
      rafIdRef.current = null;
    });
  }, [setSidebarWidth]);

  const handleMouseUp = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
  }, [handleMouseMove]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    startXRef.current = e.clientX;
    startWidthRef.current = sidebarWidth;
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [sidebarWidth, handleMouseMove, handleMouseUp]);

  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  return (
    <div className="h-screen flex bg-background overflow-hidden">
      {/* Left sidebar or icon strip */}
      <div className="h-screen z-100">
        {showSidebar && (
          sidebarOpen ? (
            <div className="flex relative">
              <div className="shrink-0 h-full" style={{ width: sidebarWidth }}>
                <Suspense fallback={<SidebarSkeleton />}>
                  <Sidebar />
                </Suspense>
              </div>
              <div
                role="separator"
                aria-orientation="vertical"
                aria-label="Resize sidebar"
                tabIndex={0}
                className={cn(
                  "w-1 h-screen z-100 cursor-col-resize shrink-0 transition-colors hover:bg-primary/20 focus-visible:bg-primary/20 outline-none"
                )}
                onMouseDown={handleMouseDown}
                onKeyDown={(e) => {
                  if (e.key === "ArrowLeft") {
                    e.preventDefault();
                    setSidebarWidth(Math.max(300, sidebarWidth - 20));
                  } else if (e.key === "ArrowRight") {
                    e.preventDefault();
                    setSidebarWidth(Math.min(400, sidebarWidth + 20));
                  }
                }}
              />
            </div>
          ) : (
            <LeftSidebarIconStrip />
          )
        )}
      </div>

      {/* Main content */}
      <ScrollContainer
        wrapperClassName="flex-1 min-w-0"
        className="p-4 md:p-6"
      >
        {children}
      </ScrollContainer>

      {/* Right panel — cube strip (64px) or expanded panel (360px) */}
      {showRightSidebar && (
        <aside
          data-testid="right-cube-rail"
          className="absolute top-[130px] bottom-0 right-0 z-100 shrink-0 transition-[width] duration-1200 ease-[cubic-bezier(0.16,1,0.3,1)] overflow-hidden"
          style={{ width: rightPanelExpanded ? RIGHT_PANEL_WIDTH : CUBE_STRIP_WIDTH }}
        >
          {sidebarContent}
        </aside>
      )}
    </div>
  );
}
