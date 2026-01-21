import { memo } from "react";
import type { Video, Folder } from "@/types";
import { Loader2, Folder as FolderIcon, Play } from "lucide-react";
import { FolderCard } from "./FolderCard";
import { VideoCard } from "./VideoCard";
import { useUIStore } from "@/stores/ui-store";
import { getFolderColorStyle } from "@/lib/style-utils";

/**
 * Context object for folder-related display options.
 * Groups related folder props into a single object for cleaner API.
 */
export interface FolderContext {
  /** Currently selected folder ID (null = root/all) */
  currentFolderId: string | null;
  /** Direct children folders of the current folder */
  subfolders: Folder[];
  /** All folders in the hierarchy (for grouping and navigation) */
  allFolders: Folder[];
  /** All videos (for counting in FolderCard) */
  allVideos: Video[];
}

interface VideoGridProps {
  /** Videos to display */
  videos: Video[];
  /** Loading state */
  isLoading: boolean;
  /** Group videos by folder (for "All Videos" view) */
  groupByFolder?: boolean;
  /** Folder context for navigation and display */
  folderContext?: FolderContext;
}

export const VideoGrid = memo(function VideoGrid({
  videos,
  isLoading,
  groupByFolder = false,
  folderContext,
}: VideoGridProps) {
  // Extract folder context with defaults
  const currentFolderId = folderContext?.currentFolderId ?? null;
  const subfolders = folderContext?.subfolders ?? [];
  const folders = folderContext?.allFolders ?? [];
  const allVideos = folderContext?.allVideos ?? [];
  const setSelectedFolder = useUIStore((s) => s.setSelectedFolder);
  const setActiveSection = useUIStore((s) => s.setActiveSection);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Handler for clicking on a folder card
  const handleFolderClick = (folderId: string) => {
    setSelectedFolder(folderId);
    setActiveSection("summarized");
  };

  // Check if we have any content (videos or subfolders)
  const hasContent = videos.length > 0 || subfolders.length > 0;

  if (!hasContent) {
    return (
      <div className="rounded-lg border border-dashed border-border p-12 text-center">
        <FolderIcon size={48} className="mx-auto mb-4 text-muted-foreground" />
        <h3 className="text-lg font-medium">
          {currentFolderId ? "This folder is empty" : "No videos yet"}
        </h3>
        <p className="text-muted-foreground">
          {currentFolderId
            ? "Add videos or create subfolders to organize your content"
            : "Add your first YouTube video to get started"}
        </p>
      </div>
    );
  }

  // If viewing a specific folder (not grouped mode), show subfolders + videos
  if (!groupByFolder && currentFolderId !== null) {
    return (
      <div className="space-y-6">
        {/* Subfolders section */}
        {subfolders.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <FolderIcon className="h-5 w-5 text-muted-foreground" />
              Folders
              <span className="text-sm text-muted-foreground font-normal">
                ({subfolders.length})
              </span>
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {subfolders.map((folder) => (
                <FolderCard
                  key={folder.id}
                  folder={folder}
                  allFolders={folders}
                  allVideos={allVideos}
                  onClick={handleFolderClick}
                />
              ))}
            </div>
          </section>
        )}

        {/* Videos section */}
        {videos.length > 0 && (
          <section>
            {subfolders.length > 0 && (
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Play className="h-5 w-5 text-muted-foreground" />
                Videos
                <span className="text-sm text-muted-foreground font-normal">
                  ({videos.length})
                </span>
              </h2>
            )}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {videos.map((video) => (
                <VideoCard key={video.id} video={video} />
              ))}
            </div>
          </section>
        )}
      </div>
    );
  }

  // If not grouping by folder (flat view without folder context)
  if (!groupByFolder) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {videos.map((video) => (
          <VideoCard key={video.id} video={video} />
        ))}
      </div>
    );
  }

  // Group videos by folder
  const folderMap = new Map(folders.map((f) => [f.id, f]));
  const grouped = new Map<string | null, Video[]>();

  // Initialize groups for all folders (even empty ones won't show)
  for (const video of videos) {
    const folderId = video.folderId;
    if (!grouped.has(folderId)) {
      grouped.set(folderId, []);
    }
    grouped.get(folderId)!.push(video);
  }

  // Sort folder groups: folders first (alphabetically), then unassigned at the end
  const sortedGroups = Array.from(grouped.entries()).sort((a, b) => {
    const [folderIdA] = a;
    const [folderIdB] = b;

    // Unassigned goes last
    if (folderIdA === null) return 1;
    if (folderIdB === null) return -1;

    // Sort by folder name
    const folderA = folderMap.get(folderIdA);
    const folderB = folderMap.get(folderIdB);
    return (folderA?.name || "").localeCompare(folderB?.name || "");
  });

  return (
    <div className="space-y-8">
      {sortedGroups.map(([folderId, folderVideos]) => {
        const folder = folderId ? folderMap.get(folderId) : null;
        const folderName = folder?.name || "Uncategorized";

        return (
          <section key={folderId || "uncategorized"}>
            {/* Folder Header - clickable to navigate to folder view */}
            <div
              className="flex items-center gap-2 cursor-pointer hover:bg-accent/30 -mx-2 px-2 py-2 rounded-lg transition-colors"
              onClick={() => {
                if (folder) {
                  setSelectedFolder(folder.id);
                  setActiveSection("summarized");
                }
              }}
            >
              <FolderIcon
                className="h-5 w-5 shrink-0"
                style={getFolderColorStyle(folder?.color)}
              />
              <h2 className="text-lg font-semibold">{folderName}</h2>
              <span className="text-sm text-muted-foreground">
                ({folderVideos.length})
              </span>
            </div>
            {/* Subtle separator */}
            <div className="border-b border-border/30 -mx-2 mb-4" />

            {/* Videos Grid */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {folderVideos.map((video) => (
                <VideoCard key={video.id} video={video} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
});

// VideoCard component has been extracted to ./VideoCard.tsx
