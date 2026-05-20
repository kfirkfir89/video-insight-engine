import { useState, useRef, useEffect } from "react";
import { CheckSquare, Search, FolderPlus } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useUIStore, useSelectionMode } from "@/stores/ui-store";
import { cn } from "@/lib/utils";
import { SearchInput } from "./SearchInput";
import { SidebarMoreMenu } from "./SidebarMoreMenu";
import { NewFolderPanel } from "../folders/NewFolderPanel";

type ActivePanel = "search" | "newFolder" | null;

/**
 * Sidebar toolbar: Search, New Folder, Select, and a "More" overflow menu.
 *
 * Sort / Text size / Collapse all live in SidebarMoreMenu, keeping this row
 * focused on the three most-used actions. See /critique report for the
 * recognition-recall rationale.
 */
export function SidebarToolbar() {
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);

  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const pendingSidebarSearch = useUIStore((s) => s.pendingSidebarSearch);
  const consumePendingSidebarSearch = useUIStore((s) => s.consumePendingSidebarSearch);

  // Open the search panel when external code (icon strip, Cmd+K, etc.) requests it
  useEffect(() => {
    if (pendingSidebarSearch) {
      setActivePanel("search");
      consumePendingSidebarSearch();
    }
  }, [pendingSidebarSearch, consumePendingSidebarSearch]);

  const searchQuery = useUIStore((s) => s.sidebarSearchQuery);
  const setSearchQuery = useUIStore((s) => s.setSidebarSearchQuery);
  const clearSearch = useUIStore((s) => s.clearSidebarSearch);

  // Close panels and clear search when sidebar collapses
  const clearSearchRef = useRef(clearSearch);
  clearSearchRef.current = clearSearch;
  useEffect(() => {
    if (!sidebarOpen) {
      setActivePanel(null);
      clearSearchRef.current();
    }
  }, [sidebarOpen]);

  const selectionMode = useSelectionMode();
  const enterSelectionMode = useUIStore((s) => s.enterSelectionMode);
  const exitSelectionMode = useUIStore((s) => s.exitSelectionMode);

  const togglePanel = (panel: ActivePanel) => {
    setActivePanel((prev) => {
      if (prev === panel) {
        if (panel === "search") clearSearch();
        return null;
      }
      return panel;
    });
  };

  const handleSelectionToggle = () => {
    if (selectionMode) exitSelectionMode();
    else enterSelectionMode();
  };

  const isPanelOpen = activePanel !== null;

  return (
    <div className="border-b border-border/50 shrink-0">
      {/* Button row — evenly spaced. Labels are visible below icons in the
          expanded sidebar so first-time users don't have to hover each one
          to learn it. Tooltips remain as a fast-delay fallback. */}
      <div className="flex items-stretch">
        <TooltipProvider delayDuration={150}>
          <ToolbarButton
            icon={Search}
            label="Search"
            active={activePanel === "search" || !!searchQuery}
            onClick={() => togglePanel("search")}
          />
          <ToolbarButton
            icon={FolderPlus}
            label="New folder"
            active={activePanel === "newFolder"}
            onClick={() => togglePanel("newFolder")}
          />
          <ToolbarButton
            icon={CheckSquare}
            label={selectionMode ? "Exit" : "Select"}
            tooltip={selectionMode ? "Exit selection" : "Select items"}
            active={selectionMode}
            onClick={handleSelectionToggle}
          />
          <SidebarMoreMenu />
        </TooltipProvider>
      </div>

      {/* Collapsible panels — search + new folder only (sort/size moved to menu) */}
      <CollapsiblePanel open={isPanelOpen}>
        {activePanel === "search" && (
          <div className="px-3 py-2">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              onClear={() => {
                clearSearch();
                setActivePanel(null);
              }}
              placeholder="Search…"
            />
          </div>
        )}

        {activePanel === "newFolder" && (
          <NewFolderPanel onComplete={() => setActivePanel(null)} />
        )}
      </CollapsiblePanel>
    </div>
  );
}

function CollapsiblePanel({ open, children }: { open: boolean; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "grid transition-[grid-template-rows,opacity] duration-200 ease-out",
        open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
      )}
    >
      <div className="overflow-hidden">{children}</div>
    </div>
  );
}

interface ToolbarButtonProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  /** Optional longer tooltip copy when the visible label is abbreviated. */
  tooltip?: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

function ToolbarButton({ icon: Icon, label, tooltip, active, disabled, onClick }: ToolbarButtonProps) {
  const tip = tooltip ?? label;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          disabled={disabled}
          className={cn(
            "group flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 transition-colors",
            // Inactive hover: icon + label brighten to foreground for stronger
            // affordance — defaulting to muted-foreground/80 made the toolbar
            // feel passive even on hover.
            "hover:bg-accent/70 hover:[&_svg]:text-foreground hover:[&_span]:text-foreground",
            active && "text-primary bg-primary/8",
            disabled && "opacity-35 cursor-not-allowed hover:bg-transparent",
          )}
          aria-label={tip}
        >
          <Icon
            className={cn(
              "h-4 w-4 transition-colors",
              active ? "text-primary" : "text-muted-foreground",
            )}
          />
          <span
            className={cn(
              "text-[10px] font-medium leading-none tracking-wide transition-colors",
              active ? "text-primary" : "text-muted-foreground",
            )}
          >
            {label}
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {tip}
      </TooltipContent>
    </Tooltip>
  );
}
