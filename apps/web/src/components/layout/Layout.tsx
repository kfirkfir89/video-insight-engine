import { useState, useRef, useCallback, useEffect, lazy, Suspense } from "react";
import type { ReactNode } from "react";
import { PanelRightClose } from "lucide-react";
import { useUIStore } from "@/stores/ui-store";
import { useRightSidebarContext } from "@/components/layout/RightSidebarContext";
import { useIsLargeDesktop } from "@/hooks/use-media-query";
import { LeftSidebarIconStrip } from "./LeftSidebarIconStrip";
import { RightSidebarIconStrip } from "./RightSidebarIconStrip";
import { cn } from "@/lib/utils";

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
  const rightSidebarOpen = useUIStore((s) => s.rightSidebarOpen);
  const toggleRightSidebar = useUIStore((s) => s.toggleRightSidebar);
  const sidebarWidth = useUIStore((s) => s.sidebarWidth);
  const setSidebarWidth = useUIStore((s) => s.setSidebarWidth);
  const [isResizing, setIsResizing] = useState(false);

  const isLargeDesktop = useIsLargeDesktop();
  const { sidebarContent, sidebarEnabled } = useRightSidebarContext();
  const showRightSidebar = isLargeDesktop && sidebarEnabled && !!sidebarContent;

  // Resize refs
  const startXRef = useRef(0);
  const startWidthRef = useRef(380);
  const rafIdRef = useRef<number | null>(null);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
    }
    rafIdRef.current = requestAnimationFrame(() => {
      const newWidth = startWidthRef.current + (e.clientX - startXRef.current);
      if (newWidth >= 200 && newWidth <= 600) {
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
    setIsResizing(false);
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
  }, [handleMouseMove]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
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
      {showSidebar && (
        sidebarOpen ? (
          <>
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
                "w-1 cursor-col-resize shrink-0 transition-colors hover:bg-primary/20 focus-visible:bg-primary/20 outline-none",
                isResizing ? "bg-primary/30" : "bg-transparent"
              )}
              onMouseDown={handleMouseDown}
              onKeyDown={(e) => {
                if (e.key === "ArrowLeft") {
                  e.preventDefault();
                  setSidebarWidth(Math.max(200, sidebarWidth - 20));
                } else if (e.key === "ArrowRight") {
                  e.preventDefault();
                  setSidebarWidth(Math.min(600, sidebarWidth + 20));
                }
              }}
            />
          </>
        ) : (
          <LeftSidebarIconStrip />
        )
      )}

      {/* Main content */}
      <main className="flex-1 min-w-0 overflow-auto p-4 md:p-6 relative scrollbar-thin">
        {children}
      </main>

      {/* Right sidebar or icon strip */}
      {showRightSidebar && (
        rightSidebarOpen ? (
          <aside className="w-[360px] shrink-0 h-full border-l bg-background overflow-hidden flex flex-col">
            {/* Right sidebar collapse header */}
            <div className="flex items-center justify-end px-2 py-1.5 border-b border-border/50 shrink-0">
              <button
                onClick={toggleRightSidebar}
                className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                aria-label="Collapse right sidebar"
              >
                <PanelRightClose className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              {sidebarContent}
            </div>
          </aside>
        ) : (
          <RightSidebarIconStrip />
        )
      )}
    </div>
  );
}
