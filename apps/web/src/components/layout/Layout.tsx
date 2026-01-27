import { useState, useRef, useCallback, useEffect, lazy, Suspense } from "react";
import type { ReactNode } from "react";
import { Header } from "./Header";
import { useUIStore } from "@/stores/ui-store";
import { cn } from "@/lib/utils";

// Lazy load Sidebar - it includes DnD Kit context (~100KB)
// Only loaded after main content renders
const Sidebar = lazy(() =>
  import("@/components/sidebar").then((m) => ({ default: m.Sidebar }))
);

// Skeleton placeholder for sidebar while loading
function SidebarSkeleton() {
  return (
    <div className="h-full bg-muted/30 animate-pulse flex flex-col gap-4 p-4">
      <div className="h-8 bg-muted rounded-md w-3/4" />
      <div className="h-6 bg-muted rounded-md w-1/2" />
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-10 bg-muted rounded-md" />
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
  const [sidebarWidth, setSidebarWidth] = useState(380);
  const [isResizing, setIsResizing] = useState(false);

  // Use refs for resize state to avoid stale closures and reduce re-renders
  const startXRef = useRef(0);
  const startWidthRef = useRef(380);
  const rafIdRef = useRef<number | null>(null);

  // Memoized handlers using refs for current values
  const handleMouseMove = useCallback((e: MouseEvent) => {
    // Cancel any pending animation frame to throttle updates
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
    }

    // Use requestAnimationFrame for natural 60fps throttling
    rafIdRef.current = requestAnimationFrame(() => {
      const newWidth = startWidthRef.current + (e.clientX - startXRef.current);
      if (newWidth >= 200 && newWidth <= 600) {
        setSidebarWidth(newWidth);
      }
      rafIdRef.current = null;
    });
  }, []);

  const handleMouseUp = useCallback(() => {
    // Cancel any pending animation frame
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

    // Store start values in refs
    startXRef.current = e.clientX;
    startWidthRef.current = sidebarWidth;

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [sidebarWidth, handleMouseMove, handleMouseUp]);

  // Cleanup on unmount
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
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <Header />

      <div className="flex-1 flex overflow-hidden">
        {showSidebar && sidebarOpen && (
          <>
            <div
              className="shrink-0 h-full"
              style={{ width: sidebarWidth }}
            >
              <Suspense fallback={<SidebarSkeleton />}>
                <Sidebar />
              </Suspense>
            </div>
            {/* Resize Handle */}
            <div
              className={cn(
                "w-1 bg-border hover:bg-primary/20 cursor-col-resize shrink-0 transition-colors",
                isResizing && "bg-primary/30"
              )}
              onMouseDown={handleMouseDown}
            />
          </>
        )}
        <main className="flex-1 overflow-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
