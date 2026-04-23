import { memo, useEffect, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { SidebarHeader } from "./core/SidebarHeader";
import { SidebarToolbar } from "./core/SidebarToolbar";
import { SidebarTabs } from "./core/SidebarTabs";
import { SidebarSection } from "./core/SidebarSection";
import { SelectionToolbar } from "./core/SelectionToolbar";
import { DndProvider } from "./core/DndProvider";
import { RAGChatPanel } from "@/components/rag/RAGChatPanel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSidebarChat } from "@/features/sidebar/hooks/use-sidebar-chat";
import { useUIStore, useSelectionMode, useActiveSection } from "@/stores/ui-store";

// Lazy load DevToolPanel only in dev mode to ensure tree-shaking in production
const DevToolPanel = import.meta.env.DEV
  ? lazy(() =>
    import("@/components/dev/DevToolPanel").then((m) => ({
      default: m.DevToolPanel,
    }))
  )
  : null;

export const Sidebar = memo(function Sidebar() {
  const navigate = useNavigate();
  const selectionMode = useSelectionMode();
  const exitSelectionMode = useUIStore((s) => s.exitSelectionMode);
  const activeSection = useActiveSection();

  const { messages: chatMessages, status: chatStatus, sendMessage: handleSendMessage } = useSidebarChat();

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

  const isAssistant = activeSection === "assistant";

  return (
    <aside
      id="app-sidebar"
      aria-label="Navigation sidebar"
      className="h-full w-full flex flex-col bg-card overflow-hidden relative"
    >
      {/* Branded header with logo */}
      <SidebarHeader />

      {/* New button — hero CTA with gradient glow */}
      <div className="px-2 py-1.5 shrink-0">
        <Button
          variant="default"
          size="sm"
          className={cn(
            "cta-magnetic w-full gap-1.5 font-semibold",
            "shadow-[0_6px_20px_-8px_oklch(from_var(--primary)_l_c_h_/_0.5)]",
            "hover:shadow-[0_8px_28px_-6px_oklch(from_var(--primary)_l_c_h_/_0.6)]",
            "active:scale-[0.98] transition-all motion-reduce:active:scale-100 motion-reduce:transition-none",
          )}
          onClick={() => navigate("/generate")}
        >
          <Plus className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          New
        </Button>
      </div>

      {/* Tab bar: Collection | Assistant */}
      <SidebarTabs />

      {/* Toolbar for sidebar controls (hidden when assistant active) */}
      {!isAssistant && <SidebarToolbar />}

      {/* Content area — keyed so Collection↔Assistant swap cleanly. No entrance
           animation: Layout remounts on route change, and a fade would flash. */}
      <div
        key={isAssistant ? "assistant" : "collection"}
        className="flex-1 min-h-0 flex flex-col"
      >
        {isAssistant ? (
          <RAGChatPanel
            messages={chatMessages}
            status={chatStatus}
            onSendMessage={handleSendMessage}
            placeholder="Ask about your videos..."
          />
        ) : (
          <DndProvider>
            <div className="flex-1 flex flex-col min-h-0">
              <SidebarSection />
            </div>
          </DndProvider>
        )}
      </div>

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
