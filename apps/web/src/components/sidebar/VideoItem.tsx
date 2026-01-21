import { useState, useRef, useCallback, useEffect, memo } from "react";
import { Link } from "react-router-dom";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  Film,
  MoreVertical,
  FolderInput,
  Trash2,
} from "lucide-react";
import { StatusIcon } from "@/components/ui/status-icon";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DeleteVideoDialog } from "@/components/dialogs/DeleteVideoDialog";
import { cn } from "@/lib/utils";

import { SIDEBAR_LAYOUT } from "@/lib/layout-constants";
import { useMoveVideo, useDeleteVideo } from "@/hooks/use-videos";
import { useSidebarTextClasses } from "@/hooks/use-sidebar-text-size";
import { useUIStore, useSelectionMode } from "@/stores/ui-store";

import type { Video, Folder as FolderData } from "@/types";
import { FolderTreeSelect } from "./FolderTreeSelect";

const LONG_PRESS_DELAY = 500; // milliseconds

interface VideoItemProps {
  video: Video;
  level: number;
  folders?: FolderData[];
}

export const VideoItem = memo(function VideoItem({ video, level, folders = [] }: VideoItemProps) {
  const moveVideo = useMoveVideo();
  const deleteVideo = useDeleteVideo();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const textClasses = useSidebarTextClasses();

  // Selection mode state
  const selectionMode = useSelectionMode();
  const enterSelectionMode = useUIStore((s) => s.enterSelectionMode);
  const handleVideoSelection = useUIStore((s) => s.handleVideoSelection);
  const isVideoSelected = useUIStore((s) => s.isVideoSelected);
  const isSelected = isVideoSelected(video.id);
  const selectedVideoIds = useUIStore((s) => s.selectedVideoIds);
  const selectedFolderIds = useUIStore((s) => s.selectedFolderIds);

  // Long press timer for entering selection mode
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // DnD draggable - use prefixed ID to ensure uniqueness
  // Enable drag for selected items in selection mode, disable for unselected
  const isMultiDrag = selectionMode && isSelected;
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `video-${video.id}`,
    data: {
      type: isMultiDrag ? "multi" : "video",
      id: video.id,
      title: video.title || "Untitled",
      selectedVideoIds: isMultiDrag ? selectedVideoIds : [video.id],
      selectedFolderIds: isMultiDrag ? selectedFolderIds : [],
    },
    // Only disable drag when in selection mode AND this item is NOT selected
    disabled: selectionMode && !isSelected,
  });

  const style = transform
    ? {
        transform: CSS.Translate.toString(transform),
      }
    : undefined;

  // Use consistent padding with FolderItem (level already includes +1 from parent)
  const paddingLeft = SIDEBAR_LAYOUT.BASE_PADDING + level * SIDEBAR_LAYOUT.INDENT_PER_LEVEL;

  const handleMoveToFolder = (folderId: string | null) => {
    moveVideo.mutate({ id: video.id, folderId });
  };

  const handleDeleteConfirm = () => {
    deleteVideo.mutate(video.id, {
      onSuccess: () => {
        setShowDeleteDialog(false);
      },
    });
  };

  // Long press handlers
  const handlePointerDown = useCallback(() => {
    if (selectionMode) return;
    longPressTimer.current = setTimeout(() => {
      enterSelectionMode(video.id, undefined);
    }, LONG_PRESS_DELAY);
  }, [selectionMode, enterSelectionMode, video.id]);

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

  // Handle click - supports Shift+Click and Ctrl+Click for selection
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      // If Shift or Ctrl is held, use selection mode behavior
      if (e.shiftKey || e.ctrlKey || e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        handleVideoSelection(video.id, e.shiftKey, e.ctrlKey || e.metaKey);
        return;
      }

      // In selection mode, toggle selection on click (add or remove)
      if (selectionMode) {
        e.preventDefault();
        e.stopPropagation();
        // Pass true for ctrlKey to toggle selection
        handleVideoSelection(video.id, false, true);
      }
    },
    [selectionMode, handleVideoSelection, video.id]
  );

  return (
    <div
      ref={setNodeRef}
      data-sidebar-item="video"
      style={{ ...style, paddingLeft: `${paddingLeft}px`, paddingRight: "8px" }}
      className={cn(
        "group flex items-center hover:bg-accent/50 rounded-sm transition-colors",
        textClasses.rowHeight,
        isDragging && "opacity-50 z-50",
        isSelected && "bg-accent border-l-2 border-l-primary"
      )}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      onClick={handleClick}
      {...((!selectionMode || isSelected) && attributes)}
      {...((!selectionMode || isSelected) && listeners)}
    >
      {/* Checkbox in selection mode, otherwise spacer */}
      {selectionMode ? (
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => handleVideoSelection(video.id, false, true)}
          className="w-4 h-4 shrink-0"
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span className="w-4 shrink-0" />
      )}

      {/* Film Icon */}
      <Film className={cn(textClasses.iconSize, "shrink-0 text-muted-foreground ml-1")} />

      {/* Video link with tooltip for truncated names */}
      <TooltipProvider delayDuration={400}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              to={`/video/${video.id}`}
              className={cn("ml-2 truncate flex-1 cursor-pointer", textClasses.mainText)}
              onClick={(e) => (isDragging || selectionMode) && e.preventDefault()}
            >
              {video.title || "Loading..."}
            </Link>
          </TooltipTrigger>
          <TooltipContent
            side="right"
            sideOffset={8}
            className="max-w-xs z-[100]"
          >
            {video.title || "Loading..."}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Status icon and context menu - invisible in selection mode to prevent layout shift */}
      <div className={cn(
        "flex items-center shrink-0",
        selectionMode && "invisible pointer-events-none"
      )}>
        {/* Status icon on hover - only show for non-completed statuses */}
        {video.status !== "completed" && (
          <span className="shrink-0 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <StatusIcon status={video.status} size={16} />
          </span>
        )}

        {/* Context menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="p-1.5 rounded-sm opacity-0 group-hover:opacity-100 hover:bg-accent transition-opacity shrink-0 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <MoreVertical className={cn(textClasses.smallIconSize, "text-muted-foreground")} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <FolderInput className="h-4 w-4" />
                <span>Move to folder</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-56 max-h-64 overflow-y-auto">
                <FolderTreeSelect
                  folders={folders}
                  currentFolderId={video.folderId}
                  onSelect={handleMoveToFolder}
                  showRemoveOption={!!video.folderId}
                  removeLabel="Remove from folder"
                />
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setShowDeleteDialog(true)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
              <span>Delete</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Delete confirmation dialog */}
      <DeleteVideoDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        videoTitle={video.title || "Untitled video"}
        onConfirm={handleDeleteConfirm}
        isPending={deleteVideo.isPending}
      />
    </div>
  );
});
