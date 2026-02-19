import { memo, useEffect, lazy, Suspense } from "react";
import { SidebarHeader } from "./SidebarHeader";
import { SidebarToolbar } from "./SidebarToolbar";
import { SidebarTabs } from "./SidebarTabs";
import { SidebarSection } from "./SidebarSection";
import { SelectionToolbar } from "./SelectionToolbar";
import { DndProvider } from "./DndProvider";
import { useUIStore, useSelectionMode } from "@/stores/ui-store";

// Lazy load DevToolPanel only in dev mode to ensure tree-shaking in production
const DevToolPanel = import.meta.env.DEV
  ? lazy(() =>
    import("@/components/dev/DevToolPanel").then((m) => ({
      default: m.DevToolPanel,
    }))
  )
  : null;

export const Sidebar = memo(function Sidebar() {
  const selectionMode = useSelectionMode();
  const exitSelectionMode = useUIStore((s) => s.exitSelectionMode);

  // Handle Escape key to exit selection mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectionMode) {
        exitSelectionMode();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectionMode, exitSelectionMode]);

  return (
    <aside className="h-screen w-full flex flex-col bg-muted border-r overflow-hidden relative">
      {/* Branded header with logo */}
      <SidebarHeader />

      {/* Tab bar: Summaries | Memorized — directly after logo */}
      <SidebarTabs />

      {/* Toolbar for sidebar controls */}
      <SidebarToolbar />

      {/* Content area - one section at a time via tabs */}
      <DndProvider>
        <div className="flex-1 flex flex-col min-h-0">
          <SidebarSection type="summarized" />
          <SidebarSection type="memorized" />
        </div>
      </DndProvider>

      {/* Dev tools panel below header (only in development) */}
      {DevToolPanel && (
        <Suspense fallback={null}>
          <DevToolPanel />
        </Suspense>
      )}

      {/* Selection toolbar at bottom when in selection mode */}
      <SelectionToolbar />
    </aside>
  );
});
