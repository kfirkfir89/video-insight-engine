import { useRef, useCallback, useEffect, lazy, Suspense } from "react";
import type { ReactNode } from "react";
import { useUIStore } from "@/stores/ui-store";
import { AppHeader } from "./AppHeader";
import { LeftSidebarIconStrip } from "./LeftSidebarIconStrip";
import { ScrollContainer } from "@/components/ui/scroll-container";
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
  const sidebarWidth = useUIStore((s) => s.sidebarWidth);
  const setSidebarWidth = useUIStore((s) => s.setSidebarWidth);

  // Resize state — all kept in refs to avoid re-renders during drag
  const startXRef = useRef(0);
  const startWidthRef = useRef(360);
  const rafIdRef = useRef<number | null>(null);
  const setSidebarWidthRef = useRef(setSidebarWidth);
  const mouseHandlersRef = useRef<{ move: (e: MouseEvent) => void; up: () => void } | null>(null);

  useEffect(() => {
    setSidebarWidthRef.current = setSidebarWidth;
  }, [setSidebarWidth]);

  // Build stable handlers once on mount via effect
  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
      rafIdRef.current = requestAnimationFrame(() => {
        const newWidth = startWidthRef.current + (e.clientX - startXRef.current);
        if (newWidth >= 300 && newWidth <= 440) {
          setSidebarWidthRef.current(newWidth);
        }
        rafIdRef.current = null;
      });
    };

    const up = () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
    };

    mouseHandlersRef.current = { move, up };

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
    };
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    startXRef.current = e.clientX;
    startWidthRef.current = sidebarWidth;
    const handlers = mouseHandlersRef.current;
    if (handlers) {
      document.addEventListener("mousemove", handlers.move);
      document.addEventListener("mouseup", handlers.up);
    }
  }, [sidebarWidth]);

  return (
    <div className="h-screen flex bg-background overflow-hidden">
      {/* Left sidebar (full height) or icon strip */}
      {showSidebar && (
        sidebarOpen ? (
          <div className="relative flex shrink-0 h-screen" style={{ width: sidebarWidth }}>
            <Suspense fallback={<SidebarSkeleton />}>
              <Sidebar />
            </Suspense>
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize sidebar"
              tabIndex={0}
              className={cn(
                "absolute right-0 w-1 bg-transparent h-full cursor-col-resize shrink-0 transition-colors hover:bg-primary/20 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:bg-primary/20"
              )}
              onMouseDown={handleMouseDown}
              onKeyDown={(e) => {
                if (e.key === "ArrowLeft") {
                  e.preventDefault();
                  setSidebarWidth(Math.max(300, sidebarWidth - 20));
                } else if (e.key === "ArrowRight") {
                  e.preventDefault();
                  setSidebarWidth(Math.min(440, sidebarWidth + 20));
                }
              }}
            />
          </div>
        ) : (
          <LeftSidebarIconStrip />
        )
      )}

      {/* Right column: header + content */}
      <div className="flex-1 flex flex-col min-w-0">
        <AppHeader />
        <ScrollContainer wrapperClassName="flex-1 min-w-0 min-h-0">
          {children}
        </ScrollContainer>
      </div>
    </div>
  );
}
