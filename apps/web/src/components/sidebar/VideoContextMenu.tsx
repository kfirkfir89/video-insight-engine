import {
  MoreVertical,
  FolderInput,
  Trash2,
  RefreshCw,
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
import { cn } from "@/lib/utils";
import { FolderTreeSelect } from "./FolderTreeSelect";
import type { Video, Folder as FolderData } from "@/types";

interface VideoContextMenuProps {
  video: Video;
  folders: FolderData[];
  textClasses: {
    smallIconSize: string;
  };
  onMoveToFolder: (folderId: string | null) => void;
  onDelete: () => void;
  onResummarize: () => void;
  isRetrying: boolean;
}

/**
 * Context menu for video items in sidebar.
 * Provides move to folder, re-summarize (for failed), and delete actions.
 */
export function VideoContextMenu({
  video,
  folders,
  textClasses,
  onMoveToFolder,
  onDelete,
  onResummarize,
  isRetrying,
}: VideoContextMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="p-1.5 rounded-sm opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100 hover:bg-accent data-[state=open]:bg-accent transition-opacity shrink-0 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <MoreVertical className={cn(textClasses.smallIconSize, "text-muted-foreground")} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="right" sideOffset={8} className="w-48 z-[200]">
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <FolderInput className="h-4 w-4" />
            <span>Move to folder</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-56 max-h-64 overflow-y-auto">
            <FolderTreeSelect
              folders={folders}
              currentFolderId={video.folderId}
              onSelect={onMoveToFolder}
              showRemoveOption={!!video.folderId}
              removeLabel="Remove from folder"
            />
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        {video.status === "failed" && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onResummarize}
              disabled={isRetrying}
            >
              <RefreshCw className="h-4 w-4" />
              <span>Re-summarize</span>
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={onDelete}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
          <span>Delete</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
