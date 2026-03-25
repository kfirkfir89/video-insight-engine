import { useMemo, useEffect } from "react";
import { useDroppable } from "@dnd-kit/core";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { FolderTree } from "../folders/FolderTree";
import { UnassignedVideosList } from "../videos/UnassignedVideosList";
import { VideoItem } from "../videos/VideoItem";
import { useFolders } from "@/hooks/use-folders";
import { useAllVideos } from "@/hooks/use-videos";
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

  // Data fetching
  const { data: foldersData, isLoading: foldersLoading } = useFolders();
  const { data: videosData, isLoading: videosLoading } = useAllVideos();

  const folders = foldersData?.folders ?? [];
  const allVideos = videosData?.videos ?? [];

  // Computed values with sorting and filtering
  const folderTree = buildFolderTree(folders, sortOption);
  const sorted = sortVideos(allVideos, sortOption);
  const { folders: filteredFolders, videos: filteredVideos } = filterBySearch(folderTree, sorted, searchQuery);
  const unassignedVideos = filteredVideos.filter((v) => !v.folderId);

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
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
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
              <div className="px-4 py-2 text-xs text-muted-foreground">
                No videos found
              </div>
            )
          ) : (
            <>
              <FolderTree
                folders={filteredFolders}
                videos={filteredVideos}
                allFolders={folders}
              />

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
