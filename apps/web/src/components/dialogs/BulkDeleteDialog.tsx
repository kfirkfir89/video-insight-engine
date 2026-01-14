import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface BulkDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  videoCount: number;
  folderCount: number;
  onConfirm: (deleteContent: boolean) => void;
  isPending?: boolean;
}

/**
 * Dialog for confirming bulk deletion of videos and/or folders.
 * When folders are being deleted, asks whether to delete or preserve their content.
 */
export function BulkDeleteDialog({
  open,
  onOpenChange,
  videoCount,
  folderCount,
  onConfirm,
  isPending = false,
}: BulkDeleteDialogProps) {
  const [deleteContent, setDeleteContent] = useState(false);

  const totalCount = videoCount + folderCount;
  const hasFolders = folderCount > 0;

  // Build description text
  let itemDescription = "";
  if (videoCount > 0 && folderCount > 0) {
    itemDescription = `${videoCount} video${videoCount !== 1 ? "s" : ""} and ${folderCount} folder${folderCount !== 1 ? "s" : ""}`;
  } else if (videoCount > 0) {
    itemDescription = `${videoCount} video${videoCount !== 1 ? "s" : ""}`;
  } else if (folderCount > 0) {
    itemDescription = `${folderCount} folder${folderCount !== 1 ? "s" : ""}`;
  }

  const handleConfirm = () => {
    onConfirm(deleteContent);
  };

  // Reset checkbox when dialog closes
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setDeleteContent(false);
    }
    onOpenChange(open);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Delete {totalCount} item{totalCount !== 1 ? "s" : ""}?
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <p>
              You are about to delete {itemDescription}. This action cannot be undone.
            </p>

            {/* Content handling option for folders */}
            {hasFolders && (
              <div className="flex items-start space-x-2 pt-2">
                <Checkbox
                  id="delete-content"
                  checked={deleteContent}
                  onCheckedChange={(checked) => setDeleteContent(checked === true)}
                />
                <div className="grid gap-1.5 leading-none">
                  <Label
                    htmlFor="delete-content"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Delete all content inside folders
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {deleteContent
                      ? "Videos inside folders will be permanently deleted"
                      : "Videos inside folders will be moved to root level"}
                  </p>
                </div>
              </div>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleConfirm();
            }}
            disabled={isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
