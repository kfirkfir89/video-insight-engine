import { useMemo } from "react";
import { MoreVertical, Pencil, Trash2, FolderInput } from "lucide-react";
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
import { FolderTreeSelect } from "./FolderTreeSelect";
import { getDescendantFolderIds } from "@/lib/folder-utils";
import { useMoveFolder } from "@/hooks/use-folders";
import type { Folder } from "@/types";

interface FolderContextMenuProps {
  /** The folder this context menu is for */
  folder: Folder;
  /** All available folders for move target selection */
  allFolders: Folder[];
  onRename: () => void;
  onDelete: () => void;
}

/**
 * Context menu for folder actions (move, rename, delete).
 * Appears on hover over the folder item.
 */
export function FolderContextMenu({
  folder,
  allFolders,
  onRename,
  onDelete,
}: FolderContextMenuProps) {
  const moveFolder = useMoveFolder();

  // Get all descendant folder IDs to exclude from move targets
  // (can't move a folder into itself or its descendants)
  const excludeFolderIds = useMemo(() => {
    return [folder.id, ...getDescendantFolderIds(folder.id, allFolders)];
  }, [folder.id, allFolders]);

  const handleMoveToFolder = (targetFolderId: string | null) => {
    moveFolder.mutate({ id: folder.id, parentId: targetFolderId });
  };

  // Check if folder is already at root level
  const isAtRoot = !folder.parentId;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="p-1.5 rounded-sm opacity-0 group-hover:opacity-100 hover:bg-accent transition-opacity shrink-0 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <MoreVertical className="h-4 w-4 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {/* Move to folder */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <FolderInput className="h-4 w-4" />
            <span>Move to folder</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-56 max-h-64 overflow-y-auto">
            <FolderTreeSelect
              folders={allFolders}
              currentFolderId={folder.parentId}
              excludeFolderIds={excludeFolderIds}
              onSelect={handleMoveToFolder}
              showRemoveOption={!isAtRoot}
              removeLabel="Move to root"
            />
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />

        {/* Rename */}
        <DropdownMenuItem onClick={onRename}>
          <Pencil className="h-4 w-4" />
          <span>Rename</span>
        </DropdownMenuItem>

        {/* Delete */}
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
