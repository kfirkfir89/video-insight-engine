import { memo, useEffect, lazy, Suspense } from "react";
import { AddVideoInput } from "./AddVideoInput";
import { SidebarToolbar } from "./SidebarToolbar";
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
    <aside className="h-full w-full flex flex-col bg-card border-r overflow-hidden relative">
      {/* Add Video Input at top */}
      <AddVideoInput />

      {/* Toolbar for sidebar controls */}
      <SidebarToolbar />

      {/* Folder sections with DnD context - each section scrolls independently */}
      <DndProvider>
        <div className="flex-1 flex flex-col min-h-0 py-2">
          <SidebarSection type="summarized" label="Summaries" />
          <SidebarSection type="memorized" label="Memorized" />
        </div>
      </DndProvider>

      {/* Selection toolbar at bottom when in selection mode */}
      <SelectionToolbar />

      {/* Dev tools panel (only in development) */}
      {DevToolPanel && (
        <Suspense fallback={null}>
          <DevToolPanel />
        </Suspense>
      )}
    </aside>
  );
});
