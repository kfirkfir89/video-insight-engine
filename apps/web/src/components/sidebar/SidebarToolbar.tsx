import { Check, ALargeSmall, ChevronsDownUp, CheckSquare } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUIStore, useSelectionMode, type SidebarTextSize } from "@/stores/ui-store";
import { cn } from "@/lib/utils";
import { SearchInput } from "./SearchInput";
import { SortDropdown } from "./SortDropdown";

const SIZE_OPTIONS: { value: SidebarTextSize; label: string }[] = [
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
];

/**
 * Toolbar for sidebar layout controls.
 * Positioned below the URL input, above the section tabs.
 */
export function SidebarToolbar() {
  const currentSize = useUIStore((s) => s.sidebarTextSize);
  const setSidebarTextSize = useUIStore((s) => s.setSidebarTextSize);
  const collapseAllFolders = useUIStore((s) => s.collapseAllFolders);
  const expandedFolderIds = useUIStore((s) => s.expandedFolderIds);
  const sortOption = useUIStore((s) => s.sidebarSortOption);
  const setSortOption = useUIStore((s) => s.setSidebarSortOption);
  const searchQuery = useUIStore((s) => s.sidebarSearchQuery);
  const setSearchQuery = useUIStore((s) => s.setSidebarSearchQuery);
  const clearSearch = useUIStore((s) => s.clearSidebarSearch);

  // Selection mode
  const selectionMode = useSelectionMode();
  const enterSelectionMode = useUIStore((s) => s.enterSelectionMode);
  const exitSelectionMode = useUIStore((s) => s.exitSelectionMode);

  const hasExpandedFolders = expandedFolderIds.length > 0;

  const handleSelectionToggle = () => {
    if (selectionMode) {
      exitSelectionMode();
    } else {
      enterSelectionMode();
    }
  };

  return (
    <div className="flex flex-col gap-1.5 px-3 py-1.5 border-b border-border/50 bg-muted/30">
      {/* Search input row */}
      <SearchInput
        value={searchQuery}
        onChange={setSearchQuery}
        onClear={clearSearch}
        placeholder="Search folders and videos..."
      />

      {/* Controls row */}
      <div className="flex items-center justify-end gap-1">
        {/* Multi-select toggle */}
        <button
          onClick={handleSelectionToggle}
          className={cn(
            "p-1.5 rounded-sm hover:bg-accent transition-colors",
            selectionMode && "bg-accent text-primary"
          )}
          title={selectionMode ? "Exit selection mode" : "Select multiple items"}
          aria-label={selectionMode ? "Exit selection mode" : "Select multiple items"}
        >
          <CheckSquare className={cn("h-4 w-4", selectionMode ? "text-primary" : "text-muted-foreground")} />
        </button>

        {/* Collapse All Folders */}
        <button
          onClick={collapseAllFolders}
          disabled={!hasExpandedFolders}
          className={cn(
            "p-1.5 rounded-sm hover:bg-accent transition-colors",
            !hasExpandedFolders && "opacity-40 cursor-not-allowed"
          )}
          title="Collapse all folders"
          aria-label="Collapse all folders"
        >
          <ChevronsDownUp className="h-4 w-4 text-muted-foreground" />
        </button>

        {/* Sort Dropdown */}
        <SortDropdown value={sortOption} onChange={setSortOption} />

        {/* Text Size Toggle */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="p-1.5 rounded-sm hover:bg-accent transition-colors"
              title={`Text size: ${currentSize}`}
              aria-label="Change text size"
            >
              <ALargeSmall className="h-4 w-4 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-32">
            {SIZE_OPTIONS.map((option) => (
              <DropdownMenuItem
                key={option.value}
                onClick={() => setSidebarTextSize(option.value)}
                className="flex items-center justify-between"
              >
                <span>{option.label}</span>
                {currentSize === option.value && (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
