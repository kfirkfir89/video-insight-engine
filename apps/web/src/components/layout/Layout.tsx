import { useRef, useCallback, useEffect, lazy, Suspense } from "react";
import type { ReactNode } from "react";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { useUIStore } from "@/stores/ui-store";
import { AppHeader } from "./AppHeader";
import { LeftSidebarIconStrip } from "./LeftSidebarIconStrip";
import { ScrollContainer } from "@/components/ui/scroll-container";
import { CommandPalette } from "@/components/CommandPalette";
import { KeyboardShortcutsModal } from "@/components/KeyboardShortcutsModal";
import { cn } from "@/lib/utils";

// Lazy load Sidebar - it includes DnD Kit context (~100KB)
const Sidebar = lazy(() =>
  import("@/features/sidebar").then((m) => ({ default: m.Sidebar }))
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

function SidebarErrorFallback() {
  return (
    <div className="h-full bg-card border-r flex items-center justify-center p-4">
      <div className="text-center space-y-2">
        <p className="text-sm font-medium text-destructive">Sidebar failed to load</p>
        <button
          onClick={() => window.location.reload()}
          className="text-xs text-primary hover:underline"
        >
          Reload page
        </button>
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

  // Lock body scroll when the mobile drawer is open so the page behind doesn't move.
  // Desktop ignores this — the sidebar is in-flow above 768px.
  useEffect(() => {
    if (!showSidebar || !sidebarOpen) return;
    const mql = window.matchMedia("(max-width: 767px)");
    if (!mql.matches) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [showSidebar, sidebarOpen]);

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
      {/* Skip to main content — accessible keyboard navigation */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-modal focus:top-2 focus:left-2 focus:rounded-md focus:bg-primary focus:text-primary-foreground focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        Skip to main content
      </a>

      {/* Left sidebar
          Desktop (md+): in-flow column, user-resizable between 300–440px.
          Mobile (<md):  overlay drawer slides over content with a tap-to-close backdrop.
          The icon strip is desktop-only chrome — mobile users toggle from AppHeader. */}
      {showSidebar && (
        sidebarOpen ? (
          <>
            {/* Mobile backdrop — tap to close */}
            <button
              type="button"
              aria-label="Close sidebar"
              onClick={() => useUIStore.setState({ sidebarOpen: false })}
              className="md:hidden fixed inset-0 z-modal bg-background/70 backdrop-blur-sm animate-in fade-in duration-150"
            />
            <div
              className="fixed inset-y-0 left-0 z-modal flex shrink-0 h-screen w-[min(85vw,22rem)] shadow-xl md:relative md:inset-auto md:z-auto md:w-[var(--sb-w)] md:shadow-none"
              style={{ ['--sb-w' as string]: `${sidebarWidth}px` } as React.CSSProperties}
            >
              <ErrorBoundary fallback={<SidebarErrorFallback />}>
                <Suspense fallback={<SidebarSkeleton />}>
                  <Sidebar />
                </Suspense>
              </ErrorBoundary>
              {/* Resize handle — desktop only */}
              <div
                role="separator"
                aria-orientation="vertical"
                aria-label="Resize sidebar"
                tabIndex={0}
                className={cn(
                  "hidden md:block absolute right-0 w-1 bg-transparent h-full cursor-col-resize shrink-0 transition-colors hover:bg-primary/20 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:bg-primary/20"
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
          </>
        ) : (
          <div className="hidden md:block">
            <LeftSidebarIconStrip />
          </div>
        )
      )}

      {/* Right column: header + content */}
      <div className="flex-1 flex flex-col min-w-0">
        <AppHeader />
        <main id="main-content" className="flex-1 flex flex-col min-h-0">
          <ScrollContainer wrapperClassName="flex-1 min-w-0 min-h-0">
            {children}
          </ScrollContainer>
        </main>
      </div>

      {/* Global overlays — always mounted, self-managing visibility */}
      <CommandPalette />
      <KeyboardShortcutsModal />
    </div>
  );
}
