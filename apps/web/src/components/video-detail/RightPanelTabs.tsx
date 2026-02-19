import type { ReactNode } from "react";
import { Map, List, MessageCircle, PanelRightClose, PanelRightOpen } from "lucide-react";
import { useUIStore } from "@/stores/ui-store";
import type { RightPanelId } from "@/stores/ui-store";
import { ScrollContainer } from "@/components/ui/scroll-container";
import { cn } from "@/lib/utils";
import { handleVerticalTablistKeyDown } from "@/lib/keyboard-nav";

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
 * Tab panel for the right sidebar with minimize support.
 * Inline variant can be minimized to a narrow icon strip.
 * Clicking a tab shows its content; clicking the active tab deselects it.
 */
export function RightPanelTabs({ chaptersContent, chatContent, variant }: RightPanelTabsProps) {
  const activePanel = useUIStore((s) => s.activeRightPanel);
  const isMinimized = useUIStore((s) => s.isRightPanelMinimized);
  const setActiveRightPanel = useUIStore((s) => s.setActiveRightPanel);
  const toggleRightPanel = useUIStore((s) => s.toggleRightPanel);
  const toggleMinimized = useUIStore((s) => s.toggleRightPanelMinimized);
  const expandToTab = useUIStore((s) => s.expandRightPanelToTab);

  const visiblePanel = activePanel !== "none" ? activePanel : "chapters";

  // Minimized state — vertical icon strip (inline variant only)
  if (isMinimized && variant === "inline") {
    return (
      <div
        data-testid="right-panel-tabs"
        className="flex flex-col h-full border-l border-border/50"
      >
        {/* Expand button */}
        <button
          onClick={toggleMinimized}
          className="flex items-center justify-center py-2.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors border-b border-border/50"
          aria-label="Expand panel"
        >
          <PanelRightOpen className="h-4 w-4" aria-hidden="true" />
        </button>

        {/* Vertical tab icons with keyboard navigation (WAI-ARIA vertical tablist) */}
        <div role="tablist" aria-orientation="vertical" aria-label="Panel tabs">
          {PANELS.map((panel, index) => {
            const isActive = visiblePanel === panel.id;
            const Icon = panel.icon;
            return (
              <button
                key={panel.id}
                role="tab"
                aria-selected={isActive}
                tabIndex={isActive ? 0 : -1}
                data-testid={`tab-${panel.id}`}
                onClick={() => expandToTab(panel.id)}
                onKeyDown={(e) => handleVerticalTablistKeyDown(e, index, PANELS.length)}
                className={cn(
                  "flex items-center justify-center py-3 w-full transition-colors",
                  isActive
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
                aria-label={panel.label}
                title={panel.label}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
              </button>
            );
          })}
        </div>
      </div>
    );
  }

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
        {variant === "inline" && (
          <button
            onClick={toggleMinimized}
            className="flex items-center justify-center px-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors border-r border-border/50"
            aria-label="Minimize panel"
          >
            <PanelRightClose className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
        {PANELS.map((panel) => {
          const isActive = visiblePanel === panel.id;
          const Icon = panel.icon;
          return (
            <button
              key={panel.id}
              data-testid={`tab-${panel.id}`}
              onClick={() => {
                if (activePanel === panel.id) {
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
