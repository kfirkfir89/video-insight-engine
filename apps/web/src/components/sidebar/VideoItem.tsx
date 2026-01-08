import { useState } from "react";
import { Link } from "react-router-dom";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  Film,
  Loader2,
  CheckCircle,
  AlertCircle,
  Clock,
  MoreVertical,
  FolderInput,
  Folder,
  FolderX,
  Trash2,
} from "lucide-react";
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
import { useMoveVideo, useDeleteVideo } from "@/hooks/use-videos";
import type { Video, Folder as FolderType } from "@/types";

interface VideoItemProps {
  video: Video;
  level: number;
  folders?: FolderType[];
}

const INDENT_PER_LEVEL = 12;
const BASE_PADDING = 8;

export function VideoItem({ video, level, folders = [] }: VideoItemProps) {
  const moveVideo = useMoveVideo();
  const deleteVideo = useDeleteVideo();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // DnD draggable
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: video.id,
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
  const paddingLeft = BASE_PADDING + level * INDENT_PER_LEVEL;

  const statusIcon = {
    pending: <Clock className="h-3 w-3 text-yellow-500" />,
    processing: <Loader2 className="h-3 w-3 animate-spin text-blue-500" />,
    completed: <CheckCircle className="h-3 w-3 text-green-500" />,
    failed: <AlertCircle className="h-3 w-3 text-red-500" />,
  };

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
        "group flex items-center h-7 hover:bg-accent/50 rounded-sm transition-colors",
        isDragging && "opacity-50 z-50"
      )}
      {...attributes}
      {...listeners}
    >
      {/* Spacer for chevron alignment (16px) */}
      <span className="w-4 shrink-0" />

      {/* Film Icon - 16px */}
      <Film className="h-4 w-4 shrink-0 text-muted-foreground" />

      {/* Video link */}
      <Link
        to={`/video/${video.id}`}
        className="ml-2 text-sm truncate flex-1 cursor-pointer"
        onClick={(e) => isDragging && e.preventDefault()}
      >
        {video.title || "Loading..."}
      </Link>

      {/* Status icon on hover */}
      <span className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        {statusIcon[video.status]}
      </span>

      {/* Context menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="ml-1 p-0.5 rounded-sm opacity-0 group-hover:opacity-100 hover:bg-accent transition-opacity shrink-0"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
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
                      style={folder.color ? { color: folder.color } : undefined}
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
