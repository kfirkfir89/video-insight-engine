import { useState } from "react";
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

interface DeleteFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folderName: string;
  hasContent: boolean;
  onConfirm: (deleteContent: boolean) => void;
  isPending?: boolean;
}

export function DeleteFolderDialog({
  open,
  onOpenChange,
  folderName,
  hasContent,
  onConfirm,
  isPending = false,
}: DeleteFolderDialogProps) {
  const [deleteContent, setDeleteContent] = useState(false);

  // Reset checkbox when dialog closes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setDeleteContent(false);
    }
    onOpenChange(newOpen);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete "{folderName}"?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {hasContent && (
          <div className="flex items-start space-x-3 py-4">
            <Checkbox
              id="delete-content"
              checked={deleteContent}
              onCheckedChange={(checked) => setDeleteContent(checked === true)}
              disabled={isPending}
            />
            <div className="grid gap-1.5 leading-none">
              <label
                htmlFor="delete-content"
                className="text-sm font-medium cursor-pointer"
              >
                Delete all content in this folder
              </label>
              <p className="text-sm text-muted-foreground">
                {deleteContent
                  ? "All videos in this folder will be permanently deleted."
                  : "Videos will be moved to the root level (uncategorized)."}
              </p>
            </div>
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => onConfirm(deleteContent)}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={isPending}
          >
            {isPending ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
