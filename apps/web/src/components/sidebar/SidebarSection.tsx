import { useState, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ChevronRight, Library, Brain, ListVideo, Plus } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { FolderTree } from "./FolderTree";
import { NewFolderInput } from "./NewFolderInput";
import { RootDropZone } from "./RootDropZone";
import { UnassignedVideosList } from "./UnassignedVideosList";
import { useFolders } from "@/hooks/use-folders";
import { useAllVideos } from "@/hooks/use-videos";
import { useSidebarTextClasses } from "@/hooks/use-sidebar-text-size";
import { useUIStore } from "@/stores/ui-store";
import { buildFolderTree, sortVideos, filterBySearch } from "@/lib/folder-utils";
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
  const selectedFolderId = useUIStore((s) => s.selectedFolderId);
  const setSelectedFolder = useUIStore((s) => s.setSelectedFolder);
  const setActiveSection = useUIStore((s) => s.setActiveSection);
  const sortOption = useUIStore((s) => s.sidebarSortOption);
  const searchQuery = useUIStore((s) => s.sidebarSearchQuery);

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

  // Styling
  const SectionIcon = type === "summarized" ? Library : Brain;
  const isLoading = foldersLoading || videosLoading;
  const textClasses = useSidebarTextClasses();
  const totalCount = type === "summarized" ? sectionVideos.length + unassignedVideos.length : 0;

  // Handlers
  const handleAllClick = () => {
    setSelectedFolder(null);
    setActiveSection(type);
    if (location.pathname !== "/") {
      navigate("/");
    }
  };

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

  return (
    <Collapsible open={isOpen} onOpenChange={toggle}>
      {/* Section Header */}
      <div className={cn(
        "group flex items-center px-2 py-2.5 font-semibold text-foreground border-b border-border/50 hover:bg-accent/50 transition-colors",
        textClasses.headerText
      )}>
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
          className="h-7 w-7 shrink-0 flex items-center justify-center rounded hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={handleAddFolderClick}
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>

      <CollapsibleContent>
        {/* New folder input */}
        {showNewFolderInput && (
          <NewFolderInput
            type={type}
            existingFolders={foldersData?.folders || []}
            onComplete={() => setShowNewFolderInput(false)}
          />
        )}

        {/* "All" option */}
        <div
          className={cn(
            "flex items-center cursor-pointer hover:bg-accent/50 rounded-sm",
            textClasses.rowHeight,
            selectedFolderId === null && "bg-accent"
          )}
          style={{ paddingLeft: "8px", paddingRight: "8px" }}
          onClick={handleAllClick}
        >
          <span className="w-4 shrink-0" />
          <ListVideo className={cn(textClasses.iconSize, "shrink-0 text-muted-foreground")} />
          <span className={cn("ml-2", textClasses.mainText)}>All {label}</span>
        </div>

        {isLoading ? (
          <div className="px-4 py-2 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ) : (
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

            {/* Root drop zone */}
            {type === "summarized" && <RootDropZone type={type} />}
          </>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
