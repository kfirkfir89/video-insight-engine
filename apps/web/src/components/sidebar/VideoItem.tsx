import { useState } from "react";
import { Link } from "react-router-dom";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  Film,
  MoreVertical,
  FolderInput,
  Folder,
  FolderX,
  Trash2,
} from "lucide-react";
import { StatusIcon } from "@/components/ui/status-icon";
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
import { DeleteVideoDialog } from "@/components/dialogs/DeleteVideoDialog";
import { cn } from "@/lib/utils";
import { getFolderColorStyle } from "@/lib/style-utils";
import { SIDEBAR_LAYOUT } from "@/lib/layout-constants";
import { useMoveVideo, useDeleteVideo } from "@/hooks/use-videos";
import { useSidebarTextClasses } from "@/hooks/use-sidebar-text-size";
import type { Video, Folder as FolderData } from "@/types";

interface VideoItemProps {
  video: Video;
  level: number;
  folders?: FolderData[];
}

export function VideoItem({ video, level, folders = [] }: VideoItemProps) {
  const moveVideo = useMoveVideo();
  const deleteVideo = useDeleteVideo();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const textClasses = useSidebarTextClasses();

  // DnD draggable - use prefixed ID to ensure uniqueness
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `video-${video.id}`,
    data: {
      type: "video",
      id: video.id,
      title: video.title || "Untitled",
    },
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

  // Filter out current folder from the list
  const availableFolders = folders.filter((f) => f.id !== video.folderId);

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, paddingLeft: `${paddingLeft}px`, paddingRight: "8px" }}
      className={cn(
        "group flex items-center hover:bg-accent/50 rounded-sm transition-colors",
        textClasses.rowHeight,
        isDragging && "opacity-50 z-50"
      )}
      {...attributes}
      {...listeners}
    >
      {/* Spacer for chevron alignment (16px) */}
      <span className="w-4 shrink-0" />

      {/* Film Icon */}
      <Film className={cn(textClasses.iconSize, "shrink-0 text-muted-foreground")} />

      {/* Video link */}
      <Link
        to={`/video/${video.id}`}
        className={cn("ml-2 truncate flex-1 cursor-pointer", textClasses.mainText)}
        onClick={(e) => isDragging && e.preventDefault()}
      >
        {video.title || "Loading..."}
      </Link>

      {/* Status icon on hover */}
      <span className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <StatusIcon status={video.status} size={12} />
      </span>

      {/* Context menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="ml-1 p-0.5 rounded-sm opacity-0 group-hover:opacity-100 hover:bg-accent transition-opacity shrink-0 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
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
            <DropdownMenuSubContent className="w-48">
              {/* Remove from folder option */}
              {video.folderId && (
                <>
                  <DropdownMenuItem onClick={() => handleMoveToFolder(null)}>
                    <FolderX className="h-4 w-4" />
                    <span>Remove from folder</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}

              {/* Available folders */}
              {availableFolders.length > 0 ? (
                availableFolders.map((folder) => (
                  <DropdownMenuItem
                    key={folder.id}
                    onClick={() => handleMoveToFolder(folder.id)}
                  >
                    <Folder
                      className="h-4 w-4"
                      style={getFolderColorStyle(folder.color)}
                    />
                    <span>{folder.name}</span>
                  </DropdownMenuItem>
                ))
              ) : (
                <DropdownMenuItem disabled>
                  <span className="text-muted-foreground">No other folders</span>
                </DropdownMenuItem>
              )}
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
}
