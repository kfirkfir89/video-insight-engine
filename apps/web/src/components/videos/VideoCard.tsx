import { useState, memo, useCallback, lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import type { Video } from "@/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusIcon } from "@/components/ui/status-icon";
import { Play } from "lucide-react";

// Lazy load VideoPlayerModal - only needed when user clicks play
const VideoPlayerModal = lazy(() =>
  import("./VideoPlayerModal").then((m) => ({ default: m.VideoPlayerModal }))
);

interface VideoCardProps {
  video: Video;
}

export const VideoCard = memo(function VideoCard({ video }: VideoCardProps) {
  const [showPlayer, setShowPlayer] = useState(false);

  const handlePlayClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowPlayer(true);
  }, []);

  const handleClosePlayer = useCallback(() => {
    setShowPlayer(false);
  }, []);

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
                loading="lazy"
                decoding="async"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-4xl">
                Video
              </div>
            )}

            {/* Play Button Overlay - Only show for completed videos */}
            {video.status === "completed" && video.youtubeId && (
              <Button
                variant="ghost"
                size="icon-bare"
                onClick={handlePlayClick}
                className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100 rounded-none"
                aria-label={`Play ${video.title}`}
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/90 text-primary-foreground hover:bg-primary transition-colors">
                  <Play className="h-8 w-8 ml-1" fill="currentColor" />
                </div>
              </Button>
            )}
          </div>

          {/* Info */}
          <div className="p-4">
            <div className="mb-2 flex items-center gap-2">
              <StatusIcon status={video.status} />
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

      {/* Modal for video playback - lazy loaded */}
      {showPlayer && (
        <Suspense fallback={null}>
          <VideoPlayerModal
            video={video}
            open={showPlayer}
            onClose={handleClosePlayer}
          />
        </Suspense>
      )}
    </>
  );
});
