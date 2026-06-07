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
import { getCmdGlyph } from "@/lib/platform";
import { useSidebarChat } from "@/features/sidebar/hooks/use-sidebar-chat";
import { useProcessingStore } from "@/features/video-output/stores/processing-store";
import { useUIStore, useSelectionMode, useActiveSection } from "@/stores/ui-store";

// Module-level — platform doesn't change mid-session; resolve once and
// keep the SSR-safe navigator guard out of the render path.
const CMD_LABEL = `${getCmdGlyph()} N`;

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
  const activeVideoId = useProcessingStore((s) => s.viewingVideoSummaryId);

  const {
    messages: chatMessages,
    status: chatStatus,
    sendMessage: handleSendMessage,
    clearMessages: handleNewChat,
  } = useSidebarChat({ videoSummaryId: activeVideoId ?? undefined });

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

      {/* New button — hero CTA with gradient glow + keyboard hint */}
      <div className="px-2 py-1.5 shrink-0">
        <Button
          variant="default"
          size="sm"
          className={cn(
            "cta-magnetic w-full gap-1.5 font-semibold relative",
            "shadow-[0_6px_20px_-8px_oklch(from_var(--primary)_l_c_h_/_0.5)]",
            "hover:shadow-[0_8px_28px_-6px_oklch(from_var(--primary)_l_c_h_/_0.6)]",
            "active:scale-[0.98] transition-all motion-reduce:active:scale-100 motion-reduce:transition-none",
          )}
          onClick={() => navigate("/generate")}
        >
          <Plus className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>New</span>
          {/* Visual keyboard hint — aria-hidden because the label is "New".
              Tabular figures so ⌘/Ctrl glyphs sit on a stable baseline.
              Translucent overlay (not solid white) to honor No-#fff rule. */}
          <kbd
            aria-hidden="true"
            className={cn(
              "ms-auto inline-flex items-center font-mono tabular-nums",
              "text-[10px] leading-none tracking-wide",
              "px-1.5 py-0.5 rounded",
              "bg-[oklch(100%_0_0_/_0.14)] text-[oklch(100%_0_0_/_0.85)]",
            )}
          >
            {CMD_LABEL}
          </kbd>
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
            onNewChat={handleNewChat}
            scope={activeVideoId ? "video" : "library"}
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

      {/* Quiet shortcut hint — surfaces the `?` modal without shouting.
          Suppressed in selection mode so SelectionToolbar owns the bottom. */}
      {!selectionMode && !isAssistant && <ShortcutHint />}

      {/* Selection toolbar at bottom when in selection mode */}
      <SelectionToolbar />
    </aside>
  );
});

/**
 * Footer reminder that surfaces the global `?` shortcut.
 * Clicking the hint opens the modal so mouse-only users find it too.
 */
function ShortcutHint() {
  const openShortcuts = useUIStore((s) => s.openShortcutsModal);
  return (
    <button
      type="button"
      onClick={openShortcuts}
      className={cn(
        "shrink-0 w-full text-start px-3 py-2 border-t border-border/40",
        "type-caption text-muted-foreground/70 hover:text-foreground/90",
        "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      Press{" "}
      <kbd className="mx-0.5 px-1.5 py-0.5 rounded bg-muted ring-1 ring-border/50 font-mono text-[10px] leading-none">
        ?
      </kbd>{" "}
      for shortcuts
    </button>
  );
}
