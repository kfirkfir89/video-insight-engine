import { useEffect, useRef, useCallback, type ReactNode } from "react";
import { Map, List, MessageCircle } from "lucide-react";
import { useUIStore } from "@/stores/ui-store";
import type { RightPanelId } from "@/stores/ui-store";
import { ScrollContainer } from "@/components/ui/scroll-container";
import { cn } from "@/lib/utils";

type CubeColor = "info" | "success" | "destructive";

interface PanelConfig {
  id: RightPanelId;
  label: string;
  icon: typeof Map;
  color: CubeColor;
}

const PANELS: PanelConfig[] = [
  { id: "minimap", label: "Mini Map", icon: Map, color: "info" },
  { id: "chapters", label: "Chapters", icon: List, color: "success" },
  { id: "chat", label: "Chat", icon: MessageCircle, color: "destructive" },
];

const STYLES: Record<CubeColor, { cssVar: string; panel: string; header: string }> = {
  info: { cssVar: "var(--info)", panel: "bg-info-soft", header: "text-info" },
  success: { cssVar: "var(--success)", panel: "bg-success-soft", header: "text-success" },
  destructive: { cssVar: "var(--destructive)", panel: "bg-destructive/10", header: "text-destructive" },
};

const ANIM = "transition-[flex-grow] duration-[1200ms] ease-[cubic-bezier(0.16,1,0.3,1)]";

function MinimapPlaceholder() {
  return (
    <div className="flex-1 flex items-center justify-center text-muted-foreground">
      <span className="text-sm">Coming Soon</span>
    </div>
  );
}

interface RightPanelStackProps {
  chaptersContent: ReactNode;
  chatContent: ReactNode;
}

export function RightPanelStack({ chaptersContent, chatContent }: RightPanelStackProps) {
  const activePanel = useUIStore((s) => s.activeRightPanel);
  const toggleRightPanel = useUIStore((s) => s.toggleRightPanel);
  const containerRef = useRef<HTMLDivElement>(null);

  const closePanel = useCallback(() => {
    if (activePanel !== "none") toggleRightPanel(activePanel);
  }, [activePanel, toggleRightPanel]);

  useEffect(() => {
    if (activePanel === "none") return;
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only close if the event target is not inside a dialog/modal
      const target = e.target as HTMLElement;
      if (e.key === "Escape" && !target.closest("[role=dialog]")) {
        closePanel();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [activePanel, closePanel]);

  useEffect(() => {
    if (activePanel === "none") return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      // Ignore clicks inside the panel or inside portaled elements (dialogs, popovers)
      if (containerRef.current?.contains(target)) return;
      if ((target as HTMLElement).closest?.("[role=dialog], [data-radix-popper-content-wrapper]")) return;
      closePanel();
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [activePanel, closePanel]);

  const contentMap: Record<string, ReactNode> = {
    minimap: <MinimapPlaceholder />,
    chapters: chaptersContent,
    chat: chatContent,
  };

  return (
    <div ref={containerRef} data-testid="cube-strip" className="h-full flex flex-col justify-end">
      {PANELS.map((panel) => {
        const isActive = activePanel === panel.id;
        const Icon = panel.icon;
        const s = STYLES[panel.color];

        return (
          <div
            key={panel.id}
            className={cn(
              "flex flex-col overflow-hidden",
              ANIM,
              isActive ? "grow basis-0 min-h-0" : "grow-0 shrink-0"
            )}
          >
            {/* Cube button — always a small cube icon */}
            <button
              data-testid={`cube-${panel.id}`}
              onClick={() => toggleRightPanel(panel.id)}
              className="shrink-0 h-11 w-11 rounded-xl flex items-center justify-center self-end mr-2.5 mt-1 text-white hover:opacity-80 transition-opacity"
              style={{ backgroundColor: `color-mix(in oklch, ${s.cssVar} 70%, transparent)` }}
              aria-label={isActive ? `Close ${panel.label}` : panel.label}
              aria-pressed={isActive}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            </button>

            {/* Expanding panel — title + content inside, rounded edges preserved */}
            <div
              data-testid={isActive ? "expanded-panel" : undefined}
              aria-label={panel.label}
              className={cn(
                "overflow-hidden rounded-xl mr-1 mt-1",
                ANIM,
                isActive ? cn("grow basis-0 min-h-0 flex flex-col", s.panel) : "grow-0 h-0"
              )}
            >
              {isActive && (
                <>
                  <button
                    onClick={() => toggleRightPanel(panel.id)}
                    className={cn("shrink-0 w-full px-3 py-2 flex items-center gap-2", s.header)}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="text-sm font-medium truncate">{panel.label}</span>
                  </button>
                  <ScrollContainer wrapperClassName="flex-1 min-h-0">
                    {contentMap[panel.id]}
                  </ScrollContainer>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
