import { Check, Type, ChevronsDownUp } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUIStore, type SidebarTextSize } from "@/stores/ui-store";
import { cn } from "@/lib/utils";

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

  const hasExpandedFolders = expandedFolderIds.length > 0;

  return (
    <div className="flex items-center justify-end gap-1 px-3 py-1.5 border-b border-border/50 bg-muted/30">
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

      {/* Text Size Toggle */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="p-1.5 rounded-sm hover:bg-accent transition-colors"
            title={`Text size: ${currentSize}`}
            aria-label="Change text size"
          >
            <Type className="h-4 w-4 text-muted-foreground" />
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
  );
}
