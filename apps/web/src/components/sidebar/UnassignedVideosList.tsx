import { VideoItem } from "./VideoItem";
import type { Video, Folder } from "@/types";

interface UnassignedVideosListProps {
  videos: Video[];
  folders: Folder[];
}

/**
 * List of videos that are not assigned to any folder.
 * Displayed at root level in the summarized section.
 */
export function UnassignedVideosList({ videos, folders }: UnassignedVideosListProps) {
  if (videos.length === 0) {
    return null;
  }

  return (
    <div className="py-1">
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
