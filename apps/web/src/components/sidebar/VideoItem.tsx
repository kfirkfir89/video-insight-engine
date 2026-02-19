import { useState, useCallback, useRef, memo } from "react";
import { Link, useLocation } from "react-router-dom";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Film } from "lucide-react";
import { StatusIcon } from "@/components/ui/status-icon";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DeleteVideoDialog } from "@/components/dialogs/DeleteVideoDialog";
import { cn } from "@/lib/utils";

import { SIDEBAR_LAYOUT } from "@/lib/layout-constants";
import { useMoveVideo, useDeleteVideo, useRetryVideo } from "@/hooks/use-videos";
import { useSidebarTextClasses } from "@/hooks/use-sidebar-text-size";
import { useLongPress } from "@/hooks/use-long-press";
import { useIsTruncated } from "@/hooks/use-is-truncated";
import { useUIStore, useSelectionMode } from "@/stores/ui-store";

import type { Video, Folder as FolderData } from "@/types";
import { VideoContextMenu } from "./VideoContextMenu";

interface VideoItemProps {
  video: Video;
  level: number;
  folders?: FolderData[];
}

export const VideoItem = memo(function VideoItem({ video, level, folders = [] }: VideoItemProps) {
  const location = useLocation();
  const moveVideo = useMoveVideo();
  const deleteVideo = useDeleteVideo();
  const retryVideo = useRetryVideo();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const textClasses = useSidebarTextClasses();
  const titleRef = useRef<HTMLAnchorElement>(null);
  const isTruncated = useIsTruncated(titleRef);
  const [tooltipOpen, setTooltipOpen] = useState(false);

  // Check if this video is currently being viewed (active)
  const isActiveVideo = location.pathname === `/video/${video.id}`;

  // Selection mode state
  const selectionMode = useSelectionMode();
  const enterSelectionMode = useUIStore((s) => s.enterSelectionMode);
  const handleVideoSelection = useUIStore((s) => s.handleVideoSelection);
  const isVideoSelected = useUIStore((s) => s.isVideoSelected);
  const isSelected = isVideoSelected(video.id);
  const selectedVideoIds = useUIStore((s) => s.selectedVideoIds);
  const selectedFolderIds = useUIStore((s) => s.selectedFolderIds);
  const setSelectedFolder = useUIStore((s) => s.setSelectedFolder);

  // Long press for entering selection mode
  const longPress = useLongPress({
    onLongPress: () => enterSelectionMode(video.id, undefined),
    disabled: selectionMode,
  });

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

  const handleResummarize = () => {
    if (!video.youtubeId) return;
    retryVideo.mutate({ youtubeId: video.youtubeId, folderId: video.folderId });
  };

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
    <TooltipProvider delayDuration={400}>
      <Tooltip open={isTruncated && tooltipOpen} onOpenChange={setTooltipOpen}>
        <TooltipTrigger asChild>
          <div
            ref={setNodeRef}
            data-sidebar-item="video"
            style={{ ...style, paddingLeft: `${paddingLeft}px`, paddingRight: "8px" }}
            className={cn(
              "group flex items-center rounded-sm transition-colors hover:bg-primary/8",
              // Keep row highlighted when dropdown menu is open
              "has-[[data-state=open]]:bg-accent/50",
              textClasses.rowHeight,
              isDragging && "opacity-50 z-50",
              isSelected && "bg-primary/6",
              // Highlight the currently viewed video
              isActiveVideo && !isSelected && "bg-primary/8 font-medium"
            )}
            onPointerDown={longPress.onPointerDown}
            onPointerUp={longPress.onPointerUp}
            onPointerLeave={longPress.onPointerLeave}
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

            {/* Video Icon */}
            <Film className={cn(textClasses.iconSize, "shrink-0 text-primary fill-warning/50 ml-1")} />

            {/* Video link */}
            <Link
              ref={titleRef}
              to={`/video/${video.id}`}
              className={cn("ml-2 truncate flex-1 cursor-pointer", textClasses.mainText)}
              onClick={(e) => {
                if (isDragging || selectionMode) {
                  e.preventDefault();
                  return;
                }
                // Clear folder selection when navigating to a video
                setSelectedFolder(null);
              }}
            >
              {video.title || "Processing..."}
            </Link>

            {/* Status icon and context menu - invisible in selection mode to prevent layout shift */}
            <div className={cn(
              "flex items-center shrink-0",
              selectionMode && "invisible pointer-events-none"
            )}>
              {/* Status icon on hover with tooltip - always reserve space for consistent layout */}
              <span className="shrink-0 w-[26px] flex items-center justify-center">
                {video.status !== "completed" && (
                  <TooltipProvider delayDuration={0}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="p-1">
                          <StatusIcon status={video.status} size={16} />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top" sideOffset={4}>
                        {video.status === "pending" && "Pending"}
                        {video.status === "processing" && "Processing..."}
                        {video.status === "failed" && "Failed to process"}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </span>

              {/* Context menu */}
              <VideoContextMenu
                video={video}
                folders={folders}
                textClasses={textClasses}
                onMoveToFolder={handleMoveToFolder}
                onDelete={() => setShowDeleteDialog(true)}
                onResummarize={handleResummarize}
                isRetrying={retryVideo.isPending}
              />
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent
          side="right"
          align="start"
          sideOffset={8}
          className="max-w-xs z-100"
        >
          {video.title || "Processing..."}
        </TooltipContent>
      </Tooltip>

      {/* Delete confirmation dialog - outside tooltip to prevent interference */}
      <DeleteVideoDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        videoTitle={video.title || "Untitled video"}
        onConfirm={handleDeleteConfirm}
        isPending={deleteVideo.isPending}
      />
    </TooltipProvider>
  );
});
