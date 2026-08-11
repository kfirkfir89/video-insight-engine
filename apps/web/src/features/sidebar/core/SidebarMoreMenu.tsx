import {
  ALargeSmall,
  ArrowDownAZ,
  ArrowUpZA,
  CalendarArrowDown,
  CalendarArrowUp,
  Check,
  ChevronsDownUp,
  MoreHorizontal,
} from "lucide-react";
import {
  VieMenu,
  VieMenuItem,
  VieMenuSeparator,
  VieMenuSub,
} from "@/components/vie";
import { Button } from "@/components/ui/button";
import { useUIStore, type SidebarTextSize, type SortOption } from "@/stores/ui-store";
import { cn } from "@/lib/utils";

const SORT_OPTIONS: { value: SortOption; label: string; icon: typeof ArrowDownAZ }[] = [
  { value: "name-asc", label: "Name (A–Z)", icon: ArrowDownAZ },
  { value: "name-desc", label: "Name (Z–A)", icon: ArrowUpZA },
  { value: "created-desc", label: "Newest first", icon: CalendarArrowDown },
  { value: "created-asc", label: "Oldest first", icon: CalendarArrowUp },
];

const SIZE_OPTIONS: { value: SidebarTextSize; label: string }[] = [
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
];

/**
 * Overflow menu for secondary sidebar controls: Sort, Text size, Collapse all.
 * Renders through VieMenu so the sidebar overflow inherits the unified menu
 * surface (radius, border, blur, hover-accent) shared with AppHeader, the
 * folder picker on /generate, and every other dropdown in the app.
 *
 * Trigger is a button with the visible label "More" rendered below the icon —
 * no hover tooltip needed because the label is always visible and aria-label
 * covers screen readers.
 */
export function SidebarMoreMenu() {
  const currentSize = useUIStore((s) => s.sidebarTextSize);
  const setSidebarTextSize = useUIStore((s) => s.setSidebarTextSize);
  const collapseAllFolders = useUIStore((s) => s.collapseAllFolders);
  const expandedFolderIds = useUIStore((s) => s.expandedFolderIds);
  const sortOption = useUIStore((s) => s.sidebarSortOption);
  const setSortOption = useUIStore((s) => s.setSidebarSortOption);

  const hasExpandedFolders = expandedFolderIds.length > 0;
  const activeSortOption = SORT_OPTIONS.find((o) => o.value === sortOption);
  const activeSizeOption = SIZE_OPTIONS.find((o) => o.value === currentSize);

  return (
    <VieMenu
      align="end"
      className="w-52"
      trigger={
        <Button
          type="button"
          variant="ghost"
          aria-label="More options"
          className={cn(
            "flex-1 h-auto flex-col items-center justify-center gap-0.5 py-1.5 rounded-none",
            "text-muted-foreground hover:bg-accent/70 hover:text-muted-foreground",
          )}
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
          <span className="text-[10px] font-medium leading-none tracking-wide text-muted-foreground/80">
            More
          </span>
        </Button>
      }
    >
      <VieMenuSeparator label="Sidebar options" />

      <VieMenuSub
        icon={activeSortOption ? <activeSortOption.icon className="h-4 w-4" /> : null}
        trigger="Sort"
        hint={activeSortOption?.label}
      >
        {SORT_OPTIONS.map((option) => {
          const Icon = option.icon;
          const isActive = sortOption === option.value;
          return (
            <VieMenuItem
              key={option.value}
              icon={<Icon className="h-4 w-4" />}
              hint={isActive ? <Check className="h-3.5 w-3.5 text-primary" /> : undefined}
              onSelect={() => setSortOption(option.value)}
            >
              {option.label}
            </VieMenuItem>
          );
        })}
      </VieMenuSub>

      <VieMenuSub
        icon={<ALargeSmall className="h-4 w-4" />}
        trigger="Text size"
        hint={activeSizeOption?.label}
      >
        {SIZE_OPTIONS.map((option) => {
          const isActive = currentSize === option.value;
          return (
            <VieMenuItem
              key={option.value}
              hint={isActive ? <Check className="h-3.5 w-3.5 text-primary" /> : undefined}
              onSelect={() => setSidebarTextSize(option.value)}
            >
              {option.label}
            </VieMenuItem>
          );
        })}
      </VieMenuSub>

      <VieMenuSeparator />

      <VieMenuItem
        icon={<ChevronsDownUp className="h-4 w-4" />}
        disabled={!hasExpandedFolders}
        onSelect={collapseAllFolders}
      >
        Collapse all folders
      </VieMenuItem>
    </VieMenu>
  );
}
