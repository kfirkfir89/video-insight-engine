import { useState } from "react";
import { Link } from "react-router-dom";
import type { Video, Folder } from "@/types";
import { Card } from "@/components/ui/card";
import { Loader2, CheckCircle, AlertCircle, Clock, Folder as FolderIcon, Play } from "lucide-react";
import { VideoPlayerModal } from "./VideoPlayerModal";
import { useUIStore } from "@/stores/ui-store";

interface VideoGridProps {
  videos: Video[];
  folders?: Folder[];
  isLoading: boolean;
  groupByFolder?: boolean;
}

export function VideoGrid({
  videos,
  folders = [],
  isLoading,
  groupByFolder = false,
}: VideoGridProps) {
  const setSelectedFolder = useUIStore((s) => s.setSelectedFolder);
  const setActiveSection = useUIStore((s) => s.setActiveSection);
  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-12 text-center">
        <h3 className="text-lg font-medium">No videos yet</h3>
        <p className="text-muted-foreground">
          Add your first YouTube video to get started
        </p>
      </div>
    );
  }

  // If not grouping by folder, render flat grid
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
              className="flex items-center gap-2 mb-4 pb-2 border-b border-border cursor-pointer hover:bg-accent/50 -mx-2 px-2 py-1 rounded transition-colors"
              onClick={() => {
                if (folder) {
                  setSelectedFolder(folder.id);
                  setActiveSection("summarized");
                }
              }}
            >
              <FolderIcon
                className="h-5 w-5 text-muted-foreground"
                style={folder?.color ? { color: folder.color } : undefined}
              />
              <h2 className="text-lg font-semibold">{folderName}</h2>
              <span className="text-sm text-muted-foreground">
                ({folderVideos.length} video{folderVideos.length !== 1 ? "s" : ""})
              </span>
            </div>

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
}

function VideoCard({ video }: { video: Video }) {
  const [showPlayer, setShowPlayer] = useState(false);

  const statusIcon = {
    pending: <Clock className="text-yellow-500" size={16} />,
    processing: <Loader2 className="animate-spin text-blue-500" size={16} />,
    completed: <CheckCircle className="text-green-500" size={16} />,
    failed: <AlertCircle className="text-red-500" size={16} />,
  };

  const handlePlayClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowPlayer(true);
  };

  return (
    <>
      <Link to={`/video/${video.id}`}>
        <Card className="overflow-hidden transition-shadow hover:shadow-md">
          {/* Thumbnail with Play Button Overlay */}
          <div className="aspect-video bg-muted relative group">
            {video.thumbnailUrl ? (
              <img
                src={video.thumbnailUrl}
                alt={video.title || "Video thumbnail"}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-4xl">
                Video
              </div>
            )}

            {/* Play Button Overlay - Only show for completed videos */}
            {video.status === "completed" && video.youtubeId && (
              <button
                onClick={handlePlayClick}
                className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100"
                aria-label={`Play ${video.title}`}
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/90 text-primary-foreground hover:bg-primary transition-colors">
                  <Play className="h-8 w-8 ml-1" fill="currentColor" />
                </div>
              </button>
            )}
          </div>

          {/* Info */}
          <div className="p-4">
            <div className="mb-2 flex items-center gap-2">
              {statusIcon[video.status]}
              <span className="text-xs capitalize text-muted-foreground">
                {video.status}
              </span>
            </div>
            <h3 className="line-clamp-2 font-medium">
              {video.title || "Loading..."}
            </h3>
            {video.channel && (
              <p className="mt-1 text-sm text-muted-foreground">
                {video.channel}
              </p>
            )}
          </div>
        </Card>
      </Link>

      {/* Modal for video playback */}
      <VideoPlayerModal
        video={video}
        open={showPlayer}
        onClose={() => setShowPlayer(false)}
      />
    </>
  );
}
