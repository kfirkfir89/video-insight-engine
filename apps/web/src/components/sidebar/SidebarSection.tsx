import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useDroppable } from "@dnd-kit/core";
import { ChevronRight, Library, Brain, Plus } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { FolderTree } from "./FolderTree";
import { NewFolderInput } from "./NewFolderInput";
import { UnassignedVideosList } from "./UnassignedVideosList";
import { VideoItem } from "./VideoItem";
import { useFolders } from "@/hooks/use-folders";
import { useAllVideos } from "@/hooks/use-videos";
import { useSidebarTextClasses } from "@/hooks/use-sidebar-text-size";
import { useUIStore, useSelectionMode } from "@/stores/ui-store";
import { buildFolderTree, sortVideos, filterBySearch } from "@/lib/folder-utils";
import { SIDEBAR_SELECTION } from "@/lib/layout-constants";
import { cn } from "@/lib/utils";
import type { FolderType } from "@/types";

interface SidebarSectionProps {
  type: FolderType;
  label: string;
}

export function SidebarSection({ type, label }: SidebarSectionProps) {
  const navigate = useNavigate();
  const location = useLocation();

  // Zustand state
  const isOpen = useUIStore((s) =>
    type === "summarized" ? s.summarizedSectionOpen : s.memorizedSectionOpen
  );
  const toggle = useUIStore((s) =>
    type === "summarized" ? s.toggleSummarizedSection : s.toggleMemorizedSection
  );
  const setSelectedFolder = useUIStore((s) => s.setSelectedFolder);
  const setActiveSection = useUIStore((s) => s.setActiveSection);
  const sortOption = useUIStore((s) => s.sidebarSortOption);
  const searchQuery = useUIStore((s) => s.sidebarSearchQuery);
  const setItemOrder = useUIStore((s) => s.setItemOrder);
  const expandedFolderIds = useUIStore((s) => s.expandedFolderIds);

  // Selection mode state
  const selectionMode = useSelectionMode();
  const exitSelectionMode = useUIStore((s) => s.exitSelectionMode);

  // Local UI state
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);

  // Data fetching
  const { data: foldersData, isLoading: foldersLoading } = useFolders(type);
  const { data: videosData, isLoading: videosLoading } = useAllVideos();

  // Computed values with sorting and filtering
  const { sortedVideos, filteredFolders, filteredVideos, unassignedVideos } = useMemo(() => {
    const rawFolders = foldersData?.folders || [];
    const rawVideos = videosData?.videos || [];

    // Build folder tree with sort option
    const folderTree = buildFolderTree(rawFolders, sortOption);

    // Sort all videos
    const sorted = sortVideos(rawVideos, sortOption);

    // Apply search filter
    const { folders: filtered, videos: filteredVids } = filterBySearch(folderTree, sorted, searchQuery);

    // Get unassigned videos (those without a folder)
    const unassigned = filteredVids.filter((v) => !v.folderId);

    return {
      sortedVideos: sorted,
      filteredFolders: filtered,
      filteredVideos: filteredVids,
      unassignedVideos: unassigned,
    };
  }, [foldersData?.folders, videosData?.videos, sortOption, searchQuery]);

  const folderIds = new Set((foldersData?.folders || []).map((f) => f.id));
  const sectionVideos = sortedVideos.filter((v) => v.folderId && folderIds.has(v.folderId));
  const isSearching = searchQuery.trim().length > 0;

  // Compute flat item order for range selection (only for summarized section)
  useEffect(() => {
    if (type !== "summarized") return;

    const order: string[] = [];

    // Helper to recursively add folders and their videos
    const addFolderAndContents = (folder: typeof filteredFolders[0]) => {
      order.push(`f_${folder.id}`);

      // Only add children if folder is expanded
      if (expandedFolderIds.includes(folder.id)) {
        // Add child folders first
        for (const child of folder.children) {
          addFolderAndContents(child);
        }

        // Add videos in this folder
        const folderVideos = filteredVideos.filter((v) => v.folderId === folder.id);
        for (const video of folderVideos) {
          order.push(`v_${video.id}`);
        }
      }
    };

    // Add all root folders and their contents
    for (const folder of filteredFolders) {
      addFolderAndContents(folder);
    }

    // Add unassigned videos at the end
    for (const video of unassignedVideos) {
      order.push(`v_${video.id}`);
    }

    setItemOrder(order);
  }, [type, filteredFolders, filteredVideos, unassignedVideos, expandedFolderIds, setItemOrder]);

  // Styling
  const SectionIcon = type === "summarized" ? Library : Brain;
  const isLoading = foldersLoading || videosLoading;
  const textClasses = useSidebarTextClasses();
  const totalCount = type === "summarized" ? sectionVideos.length + unassignedVideos.length : 0;

  // Handlers
  const handleSectionClick = () => {
    setSelectedFolder(null);
    setActiveSection(type);
    if (location.pathname !== "/") {
      navigate("/");
    }
    if (!isOpen) {
      toggle();
    }
  };

  const handleAddFolderClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowNewFolderInput((prev) => !prev);
    if (!showNewFolderInput && !isOpen) {
      toggle();
    }
  };

  // Handle clicking on empty background space - exits selection mode
  const handleBackgroundClick = useCallback((e: React.MouseEvent) => {
    if (!selectionMode) return;

    const target = e.target as HTMLElement;
    const currentTarget = e.currentTarget as HTMLElement;

    // Direct click on the background wrapper div itself (padding areas)
    if (target === currentTarget) {
      exitSelectionMode();
      return;
    }

    // Check if click was on an interactive element or actual sidebar item (folder/video)
    // Uses centralized selector that includes: sidebar items, buttons, links, inputs, textareas, etc.
    const isOnItem = target.closest(SIDEBAR_SELECTION.INTERACTIVE_SELECTOR);

    // Exit selection mode if clicking on empty space (not on items or interactive elements)
    if (!isOnItem) {
      exitSelectionMode();
    }
  }, [selectionMode, exitSelectionMode]);

  // Handle clicking on section header - exits selection mode when clicking empty header space
  const handleHeaderClick = useCallback((e: React.MouseEvent) => {
    if (selectionMode && e.target === e.currentTarget) {
      exitSelectionMode();
    }
  }, [selectionMode, exitSelectionMode]);

  // Root drop target for moving items to root level
  const { isOver: isRootOver, setNodeRef: setRootDropRef } = useDroppable({
    id: `root-${type}`,
    data: { type: "root", folderId: null },
  });

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={toggle}
      className={cn(
        "flex flex-col min-h-0",
        isOpen && "flex-1"
      )}
    >
      {/* Section Header */}
      <div
        className={cn(
          "group flex items-center px-2 py-2.5 font-semibold text-foreground border-b border-border/50 hover:bg-accent/50 transition-colors shrink-0",
          textClasses.headerText
        )}
        onClick={handleHeaderClick}
      >
        <CollapsibleTrigger className="flex items-center justify-center w-4 h-4 shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm">
          <ChevronRight
            className={cn(
              "h-4 w-4 transition-transform",
              isOpen && "rotate-90"
            )}
          />
        </CollapsibleTrigger>
        <button
          className="flex items-center gap-1 min-w-0 flex-1 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
          onClick={handleSectionClick}
        >
          <SectionIcon className="h-4 w-4 shrink-0" />
          <span className="truncate">{label}</span>
          {totalCount > 0 && (
            <span className={cn("opacity-60 shrink-0", textClasses.badgeText)}>
              ({totalCount})
            </span>
          )}
        </button>
        <button
          type="button"
          className="h-7 w-7 shrink-0 flex items-center justify-center rounded hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={handleAddFolderClick}
        >
          <Plus className={cn("h-5 w-5 transition-transform duration-200", showNewFolderInput && "rotate-45")} />
        </button>
      </div>

      <CollapsibleContent
        className="flex-1 min-h-0 overflow-hidden data-[state=open]:![height:auto]"
        onClick={handleBackgroundClick}
      >
        <ScrollArea className="h-full">
          {/* Root drop wrapper - covers full height for drag-to-root anywhere */}
          {/* Note: onClick is NOT on this div to avoid double-firing (already on CollapsibleContent) */}
          <div
            ref={setRootDropRef}
            className={cn(
              "h-full flex flex-col pb-8 pr-2",
              isRootOver && "bg-primary/10"
            )}
          >
            {/* New folder input */}
            {showNewFolderInput && (
              <NewFolderInput
                type={type}
                existingFolders={foldersData?.folders || []}
                onComplete={() => setShowNewFolderInput(false)}
              />
            )}

            {isLoading ? (
              <div className="px-4 py-2 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ) : isSearching ? (
              // Search mode: show flat list of matching videos only
              filteredVideos.length > 0 ? (
                <div className="py-1">
                  {filteredVideos.map((video) => (
                    <VideoItem
                      key={video.id}
                      video={video}
                      level={0}
                      folders={foldersData?.folders || []}
                    />
                  ))}
                </div>
              ) : (
                <div className="px-4 py-2 text-xs text-muted-foreground">
                  No videos found
                </div>
              )
            ) : (
              // Normal mode: folder tree + unassigned videos
              <>
                <FolderTree
                  folders={filteredFolders}
                  type={type}
                  videos={filteredVideos}
                  allFolders={foldersData?.folders || []}
                />

                {/* Unassigned videos */}
                {type === "summarized" && (
                  <UnassignedVideosList
                    videos={unassignedVideos}
                    folders={foldersData?.folders || []}
                  />
                )}
              </>
            )}

            {/* Empty drop zone at bottom - ensures drag-to-root works in empty space */}
            <div className="flex-grow min-h-[200px]" />
          </div>
        </ScrollArea>
      </CollapsibleContent>
    </Collapsible>
  );
}
