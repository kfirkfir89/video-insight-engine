import { useDroppable } from "@dnd-kit/core";
import { VideoItem } from "./VideoItem";
import { cn } from "@/lib/utils";
import type { Video, Folder } from "@/types";

interface UnassignedVideosListProps {
  videos: Video[];
  folders: Folder[];
}

/**
 * List of videos that are not assigned to any folder.
 * Displayed at root level in the summarized section.
 * Also acts as a drop target to move items to root level.
 */
export function UnassignedVideosList({ videos, folders }: UnassignedVideosListProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: "root-summarized-unassigned",
    data: { type: "root", folderId: null },
  });

  // Show a minimal drop zone even when empty
  if (videos.length === 0) {
    return (
      <div
        ref={setNodeRef}
        className={cn(
          "py-2 mx-2 rounded-sm transition-colors min-h-[32px]",
          isOver && "bg-primary/10 ring-1 ring-primary/20"
        )}
      />
    );
  }

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "transition-colors",
        isOver && "bg-primary/10"
      )}
    >
      {videos.map((video) => (
        <VideoItem
          key={video.id}
          video={video}
          level={0}
          folders={folders}
        />
      ))}
    </div>
  );
}
