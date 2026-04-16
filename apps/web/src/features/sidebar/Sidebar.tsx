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
      className="h-screen w-full flex flex-col bg-[var(--vie-nav-bg)] backdrop-blur-xl border-r border-[var(--glass-border-strong)] overflow-hidden relative"
    >
      {/* Branded header with logo */}
      <SidebarHeader />

      {/* New button — primary CTA, magnetic treatment */}
      <div className="px-2 py-1 shrink-0">
        <Button
          variant="default"
          size="sm"
          className="cta-magnetic w-full gap-1.5 text-primary-foreground"
          onClick={() => navigate("/generate")}
        >
          <Plus className="h-3.5 w-3.5" />
          New
        </Button>
      </div>

      {/* Tab bar: Collection | Assistant */}
      <SidebarTabs />

      {/* Toolbar for sidebar controls (hidden when assistant active) */}
      {!isAssistant && <SidebarToolbar />}

      {/* Content area — keyed container gives each section a brief fade-in on switch */}
      <div
        key={isAssistant ? "assistant" : "collection"}
        className="flex-1 min-h-0 flex flex-col animate-in fade-in duration-200 ease-out"
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
