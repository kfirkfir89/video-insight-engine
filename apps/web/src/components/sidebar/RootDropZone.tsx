import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import type { FolderType } from "@/types";

interface RootDropZoneProps {
  type: FolderType;
}

/**
 * Drop zone for removing videos from folders (move to root/unassigned).
 * Only visible when dragging a video.
 */
export function RootDropZone({ type }: RootDropZoneProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: `root-${type}`,
    data: { type: "root", folderId: null },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "h-6 mx-2 mt-1 border border-dashed border-transparent rounded transition-colors",
        isOver && "border-primary/50 bg-primary/10"
      )}
    >
      {isOver && (
        <span className="text-xs text-muted-foreground px-2">
          Drop to remove from folder
        </span>
      )}
    </div>
  );
}
