import type { ReactNode } from "react";
import { Map, List, MessageCircle } from "lucide-react";
import { useUIStore } from "@/stores/ui-store";
import type { RightPanelId } from "@/stores/ui-store";
import { ScrollContainer } from "@/components/ui/scroll-container";
import { cn } from "@/lib/utils";

interface PanelConfig {
  id: RightPanelId;
  label: string;
  icon: typeof Map;
}

const PANELS: PanelConfig[] = [
  { id: "chapters", label: "Chapters", icon: List },
  { id: "minimap", label: "Mini Map", icon: Map },
  { id: "chat", label: "Chat", icon: MessageCircle },
];

function MinimapPlaceholder() {
  return (
    <div className="flex-1 flex items-center justify-center text-muted-foreground">
      <span className="text-sm">Coming Soon</span>
    </div>
  );
}

interface RightPanelTabsProps {
  chaptersContent: ReactNode;
  chatContent: ReactNode;
  variant: "inline" | "floating";
}

/**
 * Always-open tab panel with 3 tabs.
 * Clicking a tab shows its content; clicking the active tab deselects it (shows empty).
 */
export function RightPanelTabs({ chaptersContent, chatContent, variant }: RightPanelTabsProps) {
  const activePanel = useUIStore((s) => s.activeRightPanel);
  const setActiveRightPanel = useUIStore((s) => s.setActiveRightPanel);
  const toggleRightPanel = useUIStore((s) => s.toggleRightPanel);
  // Always show a tab — default to chapters when store says "none"
  const visiblePanel = activePanel !== "none" ? activePanel : "chapters";

  return (
    <div
      data-testid="right-panel-tabs"
      className={cn(
        "flex flex-col h-full border-l border-border/50",
        variant === "floating" && "bg-card/95 backdrop-blur-sm rounded-xl border shadow-lg overflow-hidden"
      )}
    >
      {/* Tab bar — always visible */}
      <div className="flex border-b border-border/50 shrink-0">
        {PANELS.map((panel) => {
          const isActive = visiblePanel === panel.id;
          const Icon = panel.icon;
          return (
            <button
              key={panel.id}
              data-testid={`tab-${panel.id}`}
              onClick={() => {
                if (activePanel === panel.id) {
                  // Clicking active tab — resets to default (chapters)
                  toggleRightPanel(panel.id);
                } else {
                  setActiveRightPanel(panel.id);
                }
              }}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors",
                isActive
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-foreground"
              )}
              aria-label={panel.label}
              aria-pressed={isActive}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{panel.label}</span>
            </button>
          );
        })}
      </div>

      {/* Content area — always visible */}
      <div
        data-testid="expanded-panel"
        aria-label={PANELS.find((p) => p.id === visiblePanel)?.label}
        className="flex-1 min-h-0 flex flex-col"
      >
        <ScrollContainer wrapperClassName="flex-1 min-h-0">
          {visiblePanel === "chapters" ? chaptersContent
            : visiblePanel === "chat" ? chatContent
            : <MinimapPlaceholder />}
        </ScrollContainer>
      </div>
    </div>
  );
}
