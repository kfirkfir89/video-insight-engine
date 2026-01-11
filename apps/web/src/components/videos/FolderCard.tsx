import type { Folder, Video } from "@/types";
import { Card } from "@/components/ui/card";
import { Folder as FolderIcon, ChevronRight } from "lucide-react";
import { getFolderItemCount } from "@/lib/folder-utils";

interface FolderCardProps {
  folder: Folder;
  allFolders: Folder[];
  allVideos: Video[];
  onClick: (folderId: string) => void;
}

export function FolderCard({
  folder,
  allFolders,
  allVideos,
  onClick,
}: FolderCardProps) {
  const { subfolderCount, videoCount, total } = getFolderItemCount(
    folder.id,
    allFolders,
    allVideos
  );

  // Simple inline styles - no memoization needed for trivial computations
  const iconStyle = folder.color ? { color: folder.color } : undefined;
  const largeIconStyle = folder.color
    ? { color: folder.color }
    : { color: "hsl(var(--muted-foreground))" };

  return (
    <Card
      className="overflow-hidden transition-shadow hover:shadow-md cursor-pointer group"
      onClick={() => onClick(folder.id)}
    >
      {/* Folder visual area - matches aspect-video from VideoCard */}
      <div className="aspect-video bg-muted flex items-center justify-center relative">
        <FolderIcon className="h-16 w-16" style={largeIconStyle} />

        {/* Hover indicator */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="flex items-center gap-1 text-white">
            <span className="text-sm font-medium">Open</span>
            <ChevronRight className="h-4 w-4" />
          </div>
        </div>
      </div>

      {/* Info section - similar to VideoCard */}
      <div className="p-4">
        <h3 className="line-clamp-2 font-medium flex items-center gap-2">
          <FolderIcon className="h-4 w-4 shrink-0" style={iconStyle} />
          {folder.name}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {total === 0 ? (
            "Empty folder"
          ) : (
            <>
              {subfolderCount > 0 &&
                `${subfolderCount} folder${subfolderCount !== 1 ? "s" : ""}`}
              {subfolderCount > 0 && videoCount > 0 && " · "}
              {videoCount > 0 &&
                `${videoCount} video${videoCount !== 1 ? "s" : ""}`}
            </>
          )}
        </p>
      </div>
    </Card>
  );
}
