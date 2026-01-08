import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ChevronRight, Library, Brain, ListVideo, Plus, Loader2 } from "lucide-react";
import { useDroppable } from "@dnd-kit/core";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { FolderTree } from "./FolderTree";
import { VideoItem } from "./VideoItem";
import { useFolders, useCreateFolder } from "@/hooks/use-folders";
import { useAllVideos } from "@/hooks/use-videos";
import { useUIStore } from "@/stores/ui-store";
import { buildFolderTree } from "@/lib/folder-utils";
import { cn } from "@/lib/utils";
import type { FolderType } from "@/types";

interface SidebarSectionProps {
  type: FolderType;
  label: string;
}

export function SidebarSection({ type, label }: SidebarSectionProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const isOpen = useUIStore((s) =>
    type === "summarized" ? s.summarizedSectionOpen : s.memorizedSectionOpen
  );
  const toggle = useUIStore((s) =>
    type === "summarized" ? s.toggleSummarizedSection : s.toggleMemorizedSection
  );
  const selectedFolderId = useUIStore((s) => s.selectedFolderId);
  const setSelectedFolder = useUIStore((s) => s.setSelectedFolder);
  const setActiveSection = useUIStore((s) => s.setActiveSection);

  // Inline folder creation state
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const createFolder = useCreateFolder();

  const { data: foldersData, isLoading: foldersLoading } = useFolders(type);
  const { data: videosData, isLoading: videosLoading } = useAllVideos();

  // Root drop zone for removing videos from folders
  const { isOver: isOverRoot, setNodeRef: setRootRef } = useDroppable({
    id: `root-${type}`,
    data: { type: "root", folderId: null },
  });

  const folderTree = buildFolderTree(foldersData?.folders || []);
  const allVideos = videosData?.videos || [];

  // Videos without a folder (shown under "All")
  const unassignedVideos = allVideos.filter((v) => !v.folderId);

  // Get all folder IDs in this section to filter videos
  const folderIds = new Set((foldersData?.folders || []).map((f) => f.id));
  const sectionVideos = allVideos.filter(
    (v) => v.folderId && folderIds.has(v.folderId)
  );

  // Choose icons based on type
  const SectionIcon = type === "summarized" ? Library : Brain;
  const isLoading = foldersLoading || videosLoading;

  const handleAllClick = () => {
    setSelectedFolder(null);
    setActiveSection(type);
    // Navigate to dashboard if not already there
    if (location.pathname !== "/") {
      navigate("/");
    }
  };

  // Focus input when showing
  useEffect(() => {
    if (showNewFolderInput && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showNewFolderInput]);

  // Check for duplicate folder name at root level
  const isDuplicateRootFolder = (name: string) => {
    const rootFolders = (foldersData?.folders || []).filter((f) => !f.parentId);
    return rootFolders.some(
      (f) => f.name.toLowerCase() === name.toLowerCase()
    );
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;

    // Check for duplicate at root level
    if (isDuplicateRootFolder(newFolderName.trim())) {
      console.error("A folder with this name already exists at root level");
      return;
    }

    try {
      // Section header "+" always creates at root level (parentId: null)
      await createFolder.mutateAsync({
        name: newFolderName.trim(),
        type,
        parentId: null,
      });
      setNewFolderName("");
      setShowNewFolderInput(false);
    } catch (err) {
      console.error("Failed to create folder:", err);
    }
  };

  const handleNewFolderKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCreateFolder();
    }
    if (e.key === "Escape") {
      setShowNewFolderInput(false);
      setNewFolderName("");
    }
  };

  // Total count for the section
  const totalCount = type === "summarized"
    ? sectionVideos.length + unassignedVideos.length
    : 0; // Memorized section doesn't have videos yet

  // Handler for section header click - navigates and selects "All"
  const handleSectionClick = () => {
    setSelectedFolder(null);
    setActiveSection(type);
    // Navigate to dashboard if not already there
    if (location.pathname !== "/") {
      navigate("/");
    }
    // Open section if closed
    if (!isOpen) {
      toggle();
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={toggle}>
      {/* Section Header */}
      <div className="group flex items-center px-2 py-2.5 text-sm font-semibold text-foreground border-b border-border/50 hover:bg-accent/50 transition-colors">
        {/* Chevron - just toggles expand/collapse */}
        <CollapsibleTrigger className="flex items-center justify-center w-4 h-4 shrink-0 cursor-pointer">
          <ChevronRight
            className={cn(
              "h-4 w-4 transition-transform",
              isOpen && "rotate-90"
            )}
          />
        </CollapsibleTrigger>
        {/* Section label - navigates to section */}
        <button
          className="flex items-center gap-1 min-w-0 flex-1 cursor-pointer"
          onClick={handleSectionClick}
        >
          <SectionIcon className="h-4 w-4 shrink-0" />
          <span className="truncate">{label}</span>
          {totalCount > 0 && (
            <span className="text-xs opacity-60 shrink-0">({totalCount})</span>
          )}
        </button>
        <button
          className="h-7 w-7 shrink-0 flex items-center justify-center rounded hover:bg-accent"
          onClick={(e) => {
            e.stopPropagation();
            // Toggle instead of always setting true
            setShowNewFolderInput((prev) => !prev);
            // Only open section if we're showing input AND section is closed
            if (!showNewFolderInput && !isOpen) {
              toggle();
            }
          }}
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>

      <CollapsibleContent>
        {/* Inline folder creation input */}
        {showNewFolderInput && (
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border/30">
            <Input
              ref={inputRef}
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Folder name..."
              className="h-7 text-sm flex-1"
              onKeyDown={handleNewFolderKeyDown}
              onBlur={() => {
                if (!newFolderName.trim() && !createFolder.isPending) {
                  setShowNewFolderInput(false);
                }
              }}
              disabled={createFolder.isPending}
            />
            <Button
              size="sm"
              className="h-7 px-3"
              onClick={handleCreateFolder}
              disabled={!newFolderName.trim() || createFolder.isPending}
            >
              {createFolder.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                "Create"
              )}
            </Button>
          </div>
        )}

        {/* "All" option - uses ListVideo icon, not folder */}
        <div
          className={cn(
            "flex items-center h-7 cursor-pointer hover:bg-accent/50 rounded-sm",
            selectedFolderId === null && "bg-accent"
          )}
          style={{ paddingLeft: "8px", paddingRight: "8px" }}
          onClick={handleAllClick}
        >
          {/* Spacer for chevron alignment (16px) */}
          <span className="w-4 shrink-0" />
          <ListVideo className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="ml-2 text-sm">All {label}</span>
        </div>

        {isLoading ? (
          <div className="px-4 py-2 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ) : (
          <>
            <FolderTree
              folders={folderTree}
              type={type}
              videos={allVideos}
              allFolders={foldersData?.folders || []}
            />
            {/* Unassigned videos (no folder) - shown at root level for summarized */}
            {type === "summarized" && unassignedVideos.length > 0 && (
              <div className="py-1">
                {unassignedVideos.map((video) => (
                  <VideoItem
                    key={video.id}
                    video={video}
                    level={0}
                    folders={foldersData?.folders || []}
                  />
                ))}
              </div>
            )}

            {/* Root drop zone for removing from folders */}
            {type === "summarized" && (
              <div
                ref={setRootRef}
                className={cn(
                  "h-6 mx-2 mt-1 border border-dashed border-transparent rounded transition-colors",
                  isOverRoot && "border-primary/50 bg-primary/10"
                )}
              >
                {isOverRoot && (
                  <span className="text-xs text-muted-foreground px-2">
                    Drop to remove from folder
                  </span>
                )}
              </div>
            )}
          </>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
