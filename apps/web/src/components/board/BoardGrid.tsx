import type { Video } from "@/types";
import { BoardCard } from "./BoardCard";

interface BoardGridProps {
  videos: Video[];
}

export function BoardGrid({ videos }: BoardGridProps) {
  return (
    <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 space-y-4">
      {videos.map((video) => (
        <div key={video.id} className="break-inside-avoid">
          <BoardCard video={video} />
        </div>
      ))}
    </div>
  );
}
