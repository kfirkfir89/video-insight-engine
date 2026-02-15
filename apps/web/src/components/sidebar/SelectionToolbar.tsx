import { useState } from "react";
import { Trash2, X, FolderInput } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BulkDeleteDialog } from "@/components/dialogs/BulkDeleteDialog";
import { FolderTreeSelect } from "./FolderTreeSelect";
import {
  useUIStore,
  useSelectionMode,
  useSelectedVideoIds,
  useSelectedFolderIds,
  useSelectionCount,
} from "@/stores/ui-store";
import { useBulkDeleteVideos, useBulkMoveVideos } from "@/hooks/use-videos";
import { useBulkDeleteFolders, useBulkMoveFolders, useFolders } from "@/hooks/use-folders";

/**
 * Toolbar shown at the bottom of the sidebar when in selection mode.
 * Provides bulk actions: Delete, Move to folder, Cancel.
 */
export function SelectionToolbar() {
  const selectionMode = useSelectionMode();
  const selectedVideoIds = useSelectedVideoIds();
  const selectedFolderIds = useSelectedFolderIds();
  const selectionCount = useSelectionCount();
  const exitSelectionMode = useUIStore((s) => s.exitSelectionMode);

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Mutations for bulk operations
  const bulkDeleteVideos = useBulkDeleteVideos();
  const bulkDeleteFolders = useBulkDeleteFolders();
  const bulkMoveVideos = useBulkMoveVideos();
  const bulkMoveFolders = useBulkMoveFolders();

  // Get all folders for move target selection
  const { data: foldersData } = useFolders("summarized");
  const allFolders = foldersData?.folders || [];

  if (!selectionMode || selectionCount === 0) {
    return null;
  }

  const hasFolders = selectedFolderIds.length > 0;
  const hasVideos = selectedVideoIds.length > 0;

  const handleMoveToFolder = async (targetFolderId: string | null) => {
    try {
      const promises: Promise<void>[] = [];

      if (hasVideos) {
        promises.push(
          bulkMoveVideos.mutateAsync({
            videoIds: selectedVideoIds,
            folderId: targetFolderId,
          })
        );
      }

      if (hasFolders) {
        promises.push(
          bulkMoveFolders.mutateAsync({
            folderIds: selectedFolderIds,
            parentId: targetFolderId,
          })
        );
      }

      await Promise.all(promises);
      toast.success(`Moved ${selectionCount} item${selectionCount !== 1 ? "s" : ""}`);
      exitSelectionMode();
    } catch {
      toast.error("Failed to move items");
    }
  };

  const handleBulkDelete = async (deleteContent: boolean) => {
    try {
      const promises: Promise<void>[] = [];

      if (hasVideos) {
        promises.push(bulkDeleteVideos.mutateAsync(selectedVideoIds));
      }

      if (hasFolders) {
        promises.push(
          bulkDeleteFolders.mutateAsync({
            folderIds: selectedFolderIds,
            deleteContent,
          })
        );
      }

      await Promise.all(promises);
      toast.success(`Deleted ${selectionCount} item${selectionCount !== 1 ? "s" : ""}`);
      setShowDeleteDialog(false);
      exitSelectionMode();
    } catch {
      toast.error("Failed to delete items");
    }
  };

  const isPending =
    bulkDeleteVideos.isPending ||
    bulkDeleteFolders.isPending ||
    bulkMoveVideos.isPending ||
    bulkMoveFolders.isPending;

  return (
    <>
      <div className="absolute bottom-0 left-0 right-0 bg-card border-t p-2 flex items-center gap-2 shadow-xl rounded-t-lg z-10">
        {/* Selection count */}
        <span className="text-sm text-muted-foreground flex-1">
          {selectionCount} selected
        </span>

        {/* Move to folder */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" disabled={isPending}>
              <FolderInput className="h-4 w-4 mr-1" />
              Move
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 max-h-64 overflow-y-auto">
            <FolderTreeSelect
              folders={allFolders}
              excludeFolderIds={selectedFolderIds}
              onSelect={handleMoveToFolder}
              showRemoveOption={true}
              removeLabel="Move to root"
            />
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Delete */}
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setShowDeleteDialog(true)}
          disabled={isPending}
        >
          <Trash2 className="h-4 w-4 mr-1" />
          Delete
        </Button>

        {/* Cancel */}
        <Button
          variant="ghost"
          size="sm"
          onClick={exitSelectionMode}
          disabled={isPending}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Bulk delete confirmation dialog */}
      <BulkDeleteDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        videoCount={selectedVideoIds.length}
        folderCount={selectedFolderIds.length}
        onConfirm={handleBulkDelete}
        isPending={isPending}
      />
    </>
  );
}
