import { memo, useEffect, lazy, Suspense } from "react";
import { SidebarHeader } from "./SidebarHeader";
import { AddVideoInput } from "./AddVideoInput";
import { SidebarToolbar } from "./SidebarToolbar";
import { SidebarTabs } from "./SidebarTabs";
import { SidebarSection } from "./SidebarSection";
import { SidebarFooter } from "./SidebarFooter";
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
      {/* Branded header with logo + close button */}
      <SidebarHeader />

      {/* Dev tools panel below header (only in development) */}
      {DevToolPanel && (
        <Suspense fallback={null}>
          <DevToolPanel />
        </Suspense>
      )}

      {/* Add Video Input */}
      <AddVideoInput />

      {/* Toolbar for sidebar controls */}
      <SidebarToolbar />

      {/* Tab bar: Summaries | Memorized */}
      <SidebarTabs />

      {/* Content area - one section at a time via tabs */}
      <DndProvider>
        <div className="flex-1 flex flex-col min-h-0">
          <SidebarSection type="summarized" />
          <SidebarSection type="memorized" />
        </div>
      </DndProvider>

      {/* Footer with video count, theme toggle, user profile */}
      <SidebarFooter />

      {/* Selection toolbar at bottom when in selection mode */}
      <SelectionToolbar />
    </aside>
  );
});
