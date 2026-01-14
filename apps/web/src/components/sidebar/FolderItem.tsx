import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ChevronRight, Folder, Plus } from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DeleteFolderDialog } from "@/components/dialogs/DeleteFolderDialog";
import { cn } from "@/lib/utils";
import { getFolderColorStyle } from "@/lib/style-utils";
import { SIDEBAR_LAYOUT } from "@/lib/layout-constants";
import { useUIStore, useSelectionMode } from "@/stores/ui-store";
import { useDeleteFolder } from "@/hooks/use-folders";
import { useSidebarTextClasses } from "@/hooks/use-sidebar-text-size";
import { useFolderDragDrop } from "@/hooks/use-folder-drag-drop";
import { FolderRenameInput } from "./FolderRenameInput";
import { CreateSubfolderInput } from "./CreateSubfolderInput";
import { FolderContextMenu } from "./FolderContextMenu";
import { VideoItem } from "./VideoItem";
import type { FolderNode } from "@/lib/folder-utils";
import type { FolderType, Video, Folder as FolderData } from "@/types";

const LONG_PRESS_DELAY = 500; // milliseconds

interface FolderItemProps {
  folder: FolderNode;
  type: FolderType;
  level: number;
  videos: Video[];
  allFolders: FolderData[];
}

export function FolderItem({ folder, type, level, videos, allFolders }: FolderItemProps) {
  const navigate = useNavigate();
  const location = useLocation();

  // Zustand state
  const expandedFolderIds = useUIStore((s) => s.expandedFolderIds);
  const toggleFolderExpansion = useUIStore((s) => s.toggleFolderExpansion);
  const selectedFolderId = useUIStore((s) => s.selectedFolderId);
  const setSelectedFolder = useUIStore((s) => s.setSelectedFolder);
  const setActiveSection = useUIStore((s) => s.setActiveSection);

  // Selection mode state
  const selectionMode = useSelectionMode();
  const enterSelectionMode = useUIStore((s) => s.enterSelectionMode);
  const handleFolderSelection = useUIStore((s) => s.handleFolderSelection);
  const isFolderSelectedFn = useUIStore((s) => s.isFolderSelected);
  const isFolderSelectionSelected = isFolderSelectedFn(folder.id);
  const selectedVideoIds = useUIStore((s) => s.selectedVideoIds);
  const selectedFolderIds = useUIStore((s) => s.selectedFolderIds);

  // Long press timer for entering selection mode
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Local UI state
  const [isRenaming, setIsRenaming] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showSubfolderInput, setShowSubfolderInput] = useState(false);

  // Mutations
  const deleteFolder = useDeleteFolder();

  // Styling
  const textClasses = useSidebarTextClasses();
  const paddingLeft = SIDEBAR_LAYOUT.BASE_PADDING + level * SIDEBAR_LAYOUT.INDENT_PER_LEVEL;

  // Drag & Drop - enabled for selected items in selection mode
  const isMultiDrag = selectionMode && isFolderSelectionSelected;
  const { setNodeRef, isOver, isDragging, attributes, listeners, dragStyle } =
    useFolderDragDrop({
      folderId: folder.id,
      folderName: folder.name,
      level: folder.level,
      // Only disable drag when in selection mode AND this item is NOT selected
      disabled: selectionMode && !isFolderSelectionSelected,
      isMultiDrag,
      selectedVideoIds,
      selectedFolderIds,
    });

  // Computed values
  const isExpanded = expandedFolderIds.includes(folder.id);
  const isSelected = selectedFolderId === folder.id;
  const folderVideos = videos.filter((v) => v.folderId === folder.id);
  const hasChildren = folder.children.length > 0 || folderVideos.length > 0;

  // Get the original Folder data (includes parentId needed for context menu)
  // Memoized to avoid O(n) lookup on every render
  const originalFolder = useMemo(
    () => allFolders.find((f) => f.id === folder.id),
    [allFolders, folder.id]
  );

  // Long press handlers
  const handlePointerDown = useCallback(() => {
    if (selectionMode) return;
    longPressTimer.current = setTimeout(() => {
      enterSelectionMode(undefined, folder.id);
    }, LONG_PRESS_DELAY);
  }, [selectionMode, enterSelectionMode, folder.id]);

  const handlePointerUp = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handlePointerLeave = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  // Cleanup long press timer on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
    };
  }, []);

  // Handlers - supports Shift+Click and Ctrl+Click for selection
  const handleClick = (e: React.MouseEvent) => {
    // If Shift or Ctrl is held, use selection mode behavior
    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      e.preventDefault();
      e.stopPropagation();
      handleFolderSelection(folder.id, e.shiftKey, e.ctrlKey || e.metaKey);
      return;
    }

    // In selection mode, toggle selection on click (add or remove)
    if (selectionMode) {
      e.preventDefault();
      e.stopPropagation();
      // Pass true for ctrlKey to toggle selection
      handleFolderSelection(folder.id, false, true);
      return;
    }

    setSelectedFolder(folder.id);
    setActiveSection(type);

    if (location.pathname !== "/") {
      navigate("/");
      if (!isExpanded && hasChildren) {
        toggleFolderExpansion(folder.id);
      }
    } else if (hasChildren) {
      toggleFolderExpansion(folder.id);
    }
  };

  const handleChevronClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFolderExpansion(folder.id);
  };

  const handleAddSubfolderClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowSubfolderInput((prev) => !prev);
    if (!showSubfolderInput && !isExpanded) {
      toggleFolderExpansion(folder.id);
    }
  };

  const handleDeleteConfirm = async (deleteContent: boolean) => {
    try {
      await deleteFolder.mutateAsync({ id: folder.id, deleteContent });
      if (selectedFolderId === folder.id) {
        setSelectedFolder(null);
      }
      setShowDeleteDialog(false);
    } catch {
      toast.error("Failed to delete folder");
    }
  };

  const ensureExpanded = useCallback(() => {
    if (!isExpanded) {
      toggleFolderExpansion(folder.id);
    }
  }, [isExpanded, toggleFolderExpansion, folder.id]);

  return (
    <div ref={setNodeRef} style={dragStyle}>
      {/* Main folder row */}
      <div
        data-sidebar-item="folder"
        className={cn(
          "group flex items-center cursor-pointer hover:bg-accent/50 rounded-sm transition-colors",
          textClasses.rowHeight,
          isSelected && !isFolderSelectionSelected && "bg-accent",
          isOver && !isDragging && "bg-primary/20 ring-1 ring-primary/50",
          isDragging && "opacity-50",
          isFolderSelectionSelected && "bg-accent border-l-2 border-l-primary"
        )}
        style={{ paddingLeft: `${paddingLeft}px`, paddingRight: "8px" }}
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        {...((!selectionMode || isFolderSelectionSelected) && attributes)}
        {...((!selectionMode || isFolderSelectionSelected) && listeners)}
      >
        {/* Checkbox in selection mode, otherwise chevron or spacer */}
        {selectionMode ? (
          <Checkbox
            checked={isFolderSelectionSelected}
            onCheckedChange={() => handleFolderSelection(folder.id, false, true)}
            className="w-4 h-4 shrink-0"
            onClick={(e) => e.stopPropagation()}
          />
        ) : hasChildren ? (
          <button
            onClick={handleChevronClick}
            className="w-4 h-4 flex items-center justify-center shrink-0 hover:bg-accent rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronRight
              className={cn(
                textClasses.smallIconSize,
                "text-muted-foreground transition-transform",
                isExpanded && "rotate-90"
              )}
            />
          </button>
        ) : (
          <span className="w-4 shrink-0" />
        )}

        {/* Folder Icon */}
        <Folder
          className={cn(textClasses.iconSize, "shrink-0 text-muted-foreground ml-1")}
          style={getFolderColorStyle(folder.color)}
        />

        {/* Name or Rename Input */}
        {isRenaming ? (
          <FolderRenameInput
            folderId={folder.id}
            currentName={folder.name}
            onComplete={() => setIsRenaming(false)}
          />
        ) : (
          <TooltipProvider delayDuration={400}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className={cn("ml-2 truncate flex-1", textClasses.mainText)}>
                  {folder.name}
                </span>
              </TooltipTrigger>
              <TooltipContent
                side="right"
                sideOffset={8}
                className="max-w-xs z-[100]"
              >
                {folder.name}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* Add subfolder button and context menu - invisible in selection mode to prevent layout shift */}
        <div className={cn(
          "flex items-center shrink-0",
          selectionMode && "invisible pointer-events-none"
        )}>
          {/* Add subfolder button */}
          {!isRenaming && (
            <button
              className="p-1.5 rounded-sm opacity-0 group-hover:opacity-100 hover:bg-accent transition-opacity shrink-0 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
              onClick={handleAddSubfolderClick}
              title="Create subfolder"
            >
              <Plus className={cn(
                textClasses.smallIconSize,
                "text-muted-foreground transition-transform duration-200",
                showSubfolderInput && "rotate-45"
              )} />
            </button>
          )}

          {/* Context Menu */}
          {!isRenaming && originalFolder && (
            <FolderContextMenu
              folder={originalFolder}
              allFolders={allFolders}
              onRename={() => setIsRenaming(true)}
              onDelete={() => setShowDeleteDialog(true)}
            />
          )}
        </div>

        {/* Video count badge - at the end of the row, fixed width for alignment */}
        {!isRenaming && (
          <span className={cn("text-muted-foreground opacity-60 shrink-0 ml-1 w-5 text-right tabular-nums", textClasses.badgeText)}>
            {folderVideos.length > 0 ? folderVideos.length : ""}
          </span>
        )}
      </div>

      {/* Subfolder creation input */}
      {showSubfolderInput && (
        <CreateSubfolderInput
          parentFolder={folder}
          type={type}
          paddingLeft={paddingLeft}
          indentPerLevel={SIDEBAR_LAYOUT.INDENT_PER_LEVEL}
          onComplete={() => setShowSubfolderInput(false)}
          onExpand={ensureExpanded}
        />
      )}

      {/* Expanded children */}
      {isExpanded && (hasChildren || showSubfolderInput) && (
        <div>
          {folder.children.map((child) => (
            <FolderItem
              key={child.id}
              folder={child}
              type={type}
              level={level + 1}
              videos={videos}
              allFolders={allFolders}
            />
          ))}
          {folderVideos.map((video) => (
            <VideoItem
              key={video.id}
              video={video}
              level={level + 1}
              folders={allFolders}
            />
          ))}
        </div>
      )}

      {/* Delete confirmation dialog */}
      <DeleteFolderDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        folderName={folder.name}
        hasContent={folderVideos.length > 0 || folder.children.length > 0}
        onConfirm={handleDeleteConfirm}
        isPending={deleteFolder.isPending}
      />
    </div>
  );
}
