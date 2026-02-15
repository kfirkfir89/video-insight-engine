import { useState, useRef, useCallback, useEffect, lazy, Suspense } from "react";
import type { ReactNode } from "react";
import { PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
    <div className="h-full bg-card border-r animate-pulse flex flex-col">
      {/* Header skeleton */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border/50">
        <div className="h-7 w-7 bg-muted rounded-lg" />
        <div className="h-4 bg-muted rounded w-24" />
      </div>
      {/* Input skeleton */}
      <div className="px-3 py-2">
        <div className="h-8 bg-muted rounded-md" />
      </div>
      {/* Tabs skeleton */}
      <div className="flex gap-4 px-3 py-2 border-b border-border/50">
        <div className="h-4 bg-muted rounded w-20" />
        <div className="h-4 bg-muted rounded w-20" />
      </div>
      {/* Items skeleton */}
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
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
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
    <div className="h-screen flex bg-background overflow-hidden">
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
              "w-1 cursor-col-resize shrink-0 transition-colors hover:bg-primary/20",
              isResizing ? "bg-primary/30" : "bg-transparent"
            )}
            onMouseDown={handleMouseDown}
          />
        </>
      )}
      <main className="flex-1 overflow-auto p-4 md:p-6 relative">
        {/* Floating sidebar toggle when sidebar is closed */}
        {showSidebar && !sidebarOpen && (
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-3 left-3 h-8 w-8 z-10"
                  onClick={toggleSidebar}
                  title="Show sidebar"
                >
                  <PanelLeft className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs">
                Show sidebar
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {children}
      </main>
    </div>
  );
}
