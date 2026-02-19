import { useState, useRef, useEffect } from "react";
import {
  ALargeSmall,
  ChevronsDownUp,
  CheckSquare,
  Search,
  FolderPlus,
  ArrowDownAZ,
  ArrowUpZA,
  CalendarArrowDown,
  CalendarArrowUp,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  useUIStore,
  useSelectionMode,
  type SidebarTextSize,
  type SortOption,
} from "@/stores/ui-store";
import { cn } from "@/lib/utils";
import { SearchInput } from "./SearchInput";
import { NewFolderPanel } from "./NewFolderPanel";

type ActivePanel = "search" | "sort" | "textSize" | "newFolder" | null;

const SORT_OPTIONS: { value: SortOption; label: string; icon: typeof ArrowDownAZ }[] = [
  { value: "name-asc", label: "A-Z", icon: ArrowDownAZ },
  { value: "name-desc", label: "Z-A", icon: ArrowUpZA },
  { value: "created-desc", label: "Newest", icon: CalendarArrowDown },
  { value: "created-asc", label: "Oldest", icon: CalendarArrowUp },
];

const SIZE_OPTIONS: { value: SidebarTextSize; label: string }[] = [
  { value: "small", label: "S" },
  { value: "medium", label: "M" },
  { value: "large", label: "L" },
];

/**
 * Toolbar with evenly-spaced icon buttons.
 * Search, Sort, Text Size, and New Folder each toggle a collapsible panel below.
 */
export function SidebarToolbar() {
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);

  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const currentSize = useUIStore((s) => s.sidebarTextSize);
  const setSidebarTextSize = useUIStore((s) => s.setSidebarTextSize);
  const collapseAllFolders = useUIStore((s) => s.collapseAllFolders);
  const expandedFolderIds = useUIStore((s) => s.expandedFolderIds);
  const sortOption = useUIStore((s) => s.sidebarSortOption);
  const setSortOption = useUIStore((s) => s.setSidebarSortOption);
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

  const hasExpandedFolders = expandedFolderIds.length > 0;

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
      {/* Button row — evenly spaced */}
      <div className="flex items-stretch">
        <TooltipProvider delayDuration={400}>
          {/* Search */}
          <ToolbarButton
            icon={Search}
            label="Search"
            active={activePanel === "search" || !!searchQuery}
            onClick={() => togglePanel("search")}
          />

          {/* Sort */}
          <ToolbarButton
            icon={SORT_OPTIONS.find((o) => o.value === sortOption)?.icon ?? ArrowDownAZ}
            label="Sort"
            active={activePanel === "sort"}
            onClick={() => togglePanel("sort")}
          />

          {/* Text size */}
          <ToolbarButton
            icon={ALargeSmall}
            label="Text size"
            active={activePanel === "textSize"}
            onClick={() => togglePanel("textSize")}
          />

          {/* Collapse all */}
          <ToolbarButton
            icon={ChevronsDownUp}
            label="Collapse all"
            disabled={!hasExpandedFolders}
            onClick={collapseAllFolders}
          />

          {/* Multi-select */}
          <ToolbarButton
            icon={CheckSquare}
            label={selectionMode ? "Exit selection" : "Select items"}
            active={selectionMode}
            onClick={handleSelectionToggle}
          />

          {/* New folder */}
          <ToolbarButton
            icon={FolderPlus}
            label="New folder"
            active={activePanel === "newFolder"}
            onClick={() => togglePanel("newFolder")}
          />
        </TooltipProvider>
      </div>

      {/* ── Collapsible panels ────────────────────────────── */}
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
              placeholder="Search folders and videos..."
            />
          </div>
        )}

        {activePanel === "sort" && (
          <div className="px-3 py-2 flex gap-1">
            {SORT_OPTIONS.map((option) => {
              const Icon = option.icon;
              const isActive = sortOption === option.value;
              return (
                <button
                  key={option.value}
                  onClick={() => setSortOption(option.value)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{option.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {activePanel === "textSize" && (
          <div className="px-3 py-2 flex gap-1">
            {SIZE_OPTIONS.map((option) => {
              const isActive = currentSize === option.value;
              return (
                <button
                  key={option.value}
                  onClick={() => setSidebarTextSize(option.value)}
                  className={cn(
                    "flex-1 flex items-center justify-center py-1.5 rounded-md text-xs font-medium transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        )}

        {activePanel === "newFolder" && (
          <NewFolderPanel onComplete={() => setActivePanel(null)} />
        )}
      </CollapsiblePanel>
    </div>
  );
}

/* ── Collapsible Panel ──────────────────────────────────── */

function CollapsiblePanel({ open, children }: { open: boolean; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "grid transition-all duration-200 ease-out",
        open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
      )}
    >
      <div className="overflow-hidden">{children}</div>
    </div>
  );
}

/* ── Toolbar Button ─────────────────────────────────────── */

interface ToolbarButtonProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

function ToolbarButton({ icon: Icon, label, active, disabled, onClick }: ToolbarButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          disabled={disabled}
          className={cn(
            "flex-1 flex items-center justify-center py-2.5 transition-colors",
            "hover:bg-accent/60",
            active && "text-primary bg-primary/8",
            disabled && "opacity-35 cursor-not-allowed hover:bg-transparent"
          )}
          aria-label={label}
        >
          <Icon
            className={cn(
              "h-4 w-4",
              active ? "text-primary" : "text-muted-foreground"
            )}
          />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
