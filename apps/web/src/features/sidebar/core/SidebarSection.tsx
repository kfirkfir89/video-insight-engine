import { useMemo, useEffect } from "react";
import { useDroppable } from "@dnd-kit/core";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { FolderTree } from "../folders/FolderTree";
import { UnassignedVideosList } from "../videos/UnassignedVideosList";
import { VideoItem } from "../videos/VideoItem";
import { useFolders } from "@/hooks/use-folders";
import { useAllVideos } from "@/hooks/use-videos";
import { useAuthStore } from "@/stores/auth-store";
import { useUIStore, useSelectionMode, useActiveSection } from "@/stores/ui-store";
import { buildFolderTree, sortVideos, filterBySearch } from "@/features/sidebar/lib/folder-utils";
import { SIDEBAR_SELECTION } from "@/features/sidebar/lib/layout-constants";
import { cn } from "@/lib/utils";

export function SidebarSection() {
  const activeSection = useActiveSection();

  // Only render when summarized tab is active
  const isVisible = activeSection === "summarized";

  // Zustand state
  const sortOption = useUIStore((s) => s.sidebarSortOption);
  const searchQuery = useUIStore((s) => s.sidebarSearchQuery);
  const setItemOrder = useUIStore((s) => s.setItemOrder);
  const expandedFolderIds = useUIStore((s) => s.expandedFolderIds);

  // Selection mode state
  const selectionMode = useSelectionMode();
  const exitSelectionMode = useUIStore((s) => s.exitSelectionMode);

  // Data fetching — gated on auth like CommandPalette/GeneratePage. An
  // unauthenticated mount must not fire /videos + /folders requests that
  // 401/CORS-error in the console (root cause of the rtl.spec.ts failure).
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { data: foldersData, isLoading: foldersLoading } = useFolders({ enabled: isAuthenticated });
  const { data: videosData, isLoading: videosLoading } = useAllVideos({ enabled: isAuthenticated });

  const folders = foldersData?.folders ?? [];
  const allVideos = videosData?.videos ?? [];

  // Memoize derived data — without this, every parent re-render creates new
  // arrays that bust memo() on FolderTree/VideoItem, causing the entire
  // sidebar to visually "refresh" on every route navigation.
  const folderTree = useMemo(() => buildFolderTree(folders, sortOption), [folders, sortOption]);
  const sorted = useMemo(() => sortVideos(allVideos, sortOption), [allVideos, sortOption]);
  const { folders: filteredFolders, videos: filteredVideos } = useMemo(
    () => filterBySearch(folderTree, sorted, searchQuery),
    [folderTree, sorted, searchQuery],
  );
  const unassignedVideos = useMemo(
    () => filteredVideos.filter((v) => !v.folderId),
    [filteredVideos],
  );

  const isSearching = searchQuery.trim().length > 0;

  // Compute flat item order for range selection (only when in selection mode).
  const itemOrder = useMemo(() => {
    if (!selectionMode) return [] as string[];

    const order: string[] = [];

    const addFolderAndContents = (folder: typeof filteredFolders[0]) => {
      order.push(`f_${folder.id}`);
      if (expandedFolderIds.includes(folder.id)) {
        for (const child of folder.children) {
          addFolderAndContents(child);
        }
        const folderVideos = filteredVideos.filter((v) => v.folderId === folder.id);
        for (const video of folderVideos) {
          order.push(`v_${video.id}`);
        }
      }
    };

    for (const folder of filteredFolders) {
      addFolderAndContents(folder);
    }

    for (const video of unassignedVideos) {
      order.push(`v_${video.id}`);
    }

    return order;
  }, [selectionMode, filteredFolders, filteredVideos, unassignedVideos, expandedFolderIds]);

  // Sync derived itemOrder to Zustand store for range-select consumers.
  useEffect(() => {
    setItemOrder(itemOrder);
  }, [itemOrder, setItemOrder]);

  // Styling
  const isLoading = foldersLoading || videosLoading;

  // Handle clicking on empty background space - exits selection mode
  const handleBackgroundClick = (e: React.MouseEvent) => {
    if (!selectionMode) return;

    const target = e.target as HTMLElement;
    const currentTarget = e.currentTarget as HTMLElement;

    if (target === currentTarget) {
      exitSelectionMode();
      return;
    }

    const isOnItem = target.closest(SIDEBAR_SELECTION.INTERACTIVE_SELECTOR);
    if (!isOnItem) {
      exitSelectionMode();
    }
  };

  // Root drop target for moving items to root level
  const { isOver: isRootOver, setNodeRef: setRootDropRef } = useDroppable({
    id: "root-summarized",
    data: { type: "root", folderId: null },
    disabled: !isVisible,
  });

  if (!isVisible) return null;

  return (
    <div
      className="flex-1 min-h-0 overflow-hidden"
      onClick={handleBackgroundClick}
    >
      <ScrollArea className="h-full">
        <div
          ref={setRootDropRef}
          className={cn(
            "flex flex-col py-2",
            isRootOver && "bg-primary/10"
          )}
        >
          {isLoading ? (
            <div className="px-4 py-2 space-y-2">
              <Skeleton className="h-7 w-full rounded-md" />
              <Skeleton className="h-7 w-full rounded-md" />
              <Skeleton className="h-7 w-4/5 rounded-md" />
              <Skeleton className="h-7 w-full rounded-md" />
              <Skeleton className="h-7 w-3/4 rounded-md" />
              <Skeleton className="h-7 w-full rounded-md" />
            </div>
          ) : allVideos.length === 0 && folders.length === 0 && !isSearching ? (
            /* Quiet placeholder — the main board already shows a full empty
               state, so the sidebar doesn't need to repeat the pitch. A
               single muted line keeps the rail visually calm. */
            <p className="px-4 py-6 text-xs text-muted-foreground/70">
              No videos yet.
            </p>
          ) : isSearching ? (
            filteredVideos.length > 0 ? (
              <>
                {filteredVideos.map((video) => (
                  <VideoItem
                    key={video.id}
                    video={video}
                    level={0}
                    folders={folders}
                  />
                ))}
              </>
            ) : (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No matches for &ldquo;{searchQuery}&rdquo;
              </div>
            )
          ) : (
            <>
              {filteredFolders.length > 0 && (
                <SectionHeader label="Folders" count={filteredFolders.length} />
              )}
              <FolderTree
                folders={filteredFolders}
                videos={filteredVideos}
                allFolders={folders}
              />

              {/* Soft divider — border/40 keeps the rhythm without shouting.
                  Only shows when both folders AND unassigned videos exist. */}
              {filteredFolders.length > 0 && unassignedVideos.length > 0 && (
                <div className="mx-3 my-2 border-t border-border/40" aria-hidden="true" />
              )}

              {unassignedVideos.length > 0 && (
                <SectionHeader label="Recent" count={unassignedVideos.length} />
              )}
              <UnassignedVideosList
                videos={unassignedVideos}
                folders={folders}
              />
            </>
          )}

          {/* Drop zone at bottom for DnD */}
          <div className="min-h-16" />
        </div>
      </ScrollArea>
    </div>
  );
}

interface SectionHeaderProps {
  label: string;
  count: number;
}

/**
 * Section header rendered above grouped lists (Folders / Recent).
 *
 * Uses `.type-eyebrow` (uppercase 11px / 0.08em tracking / weight 600) so
 * the label reads as a section divider, not a generic header. Counts use
 * `.tabular-nums` per DESIGN.md §3 Tabular-Figure Rule — proportional
 * digits in counts are a tell that nobody tuned it.
 */
function SectionHeader({ label, count }: SectionHeaderProps) {
  return (
    <div className="flex items-baseline gap-2 px-4 pt-3 pb-1.5">
      <span className="type-eyebrow">{label}</span>
      <span className="text-[10px] tabular-nums text-muted-foreground/60 leading-none">
        {count}
      </span>
    </div>
  );
}
