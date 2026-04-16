import { useState, memo, useCallback, useMemo, lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import type { Video } from "@/types";
import type { ProcessingStatus } from "@/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Play } from "lucide-react";

const STATUS_DOT_MAP: Record<ProcessingStatus, string> = {
  pending: "bg-[var(--status-pending)]",
  processing: "bg-[var(--status-processing)] animate-pulse",
  completed: "bg-[var(--status-success)]",
  failed: "bg-[var(--status-error)]",
};

const STATUS_TEXT_MAP: Record<ProcessingStatus, string> = {
  pending: "text-[var(--status-pending)]",
  processing: "text-[var(--status-processing)]",
  completed: "text-muted-foreground",
  failed: "text-destructive",
};

/** Active-state ring on the card so processing/failed videos are identifiable
 *  at a glance — completed cards stay quiet. */
const STATUS_RING_MAP: Record<ProcessingStatus, string> = {
  pending: "ring-1 ring-[oklch(from_var(--status-pending)_l_c_h_/_0.3)]",
  processing: "ring-1 ring-[oklch(from_var(--status-processing)_l_c_h_/_0.35)]",
  completed: "",
  failed: "ring-1 ring-destructive/35",
};

const STATUS_LABEL_MAP: Record<ProcessingStatus, string> = {
  pending: "Queued",
  processing: "Processing",
  completed: "Ready",
  failed: "Failed",
};

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffSeconds = Math.floor((now - then) / 1000);

  if (diffSeconds < 60) return "just now";
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths}mo ago`;
  const diffYears = Math.floor(diffDays / 365);
  return `${diffYears}y ago`;
}

// Lazy load VideoPlayerModal - only needed when user clicks play
const VideoPlayerModal = lazy(() =>
  import("./VideoPlayerModal").then((m) => ({ default: m.VideoPlayerModal }))
);

interface VideoCardProps {
  video: Video;
}

export const VideoCard = memo(function VideoCard({ video }: VideoCardProps) {
  const [showPlayer, setShowPlayer] = useState(false);
  const relativeTime = useMemo(
    () => formatRelativeTime(video.createdAt),
    [video.createdAt]
  );

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
      <Link
        to={`/video/${video.id}`}
        className="block [content-visibility:auto] [contain-intrinsic-size:auto_260px]"
      >
        <Card className={cn("overflow-hidden transition-[box-shadow,transform] duration-200 ease-out hover:shadow-lg hover:-translate-y-0.5 motion-reduce:hover:translate-y-0", STATUS_RING_MAP[video.status])}>
          {/* Thumbnail with Play Button Overlay */}
          <div className="aspect-video bg-muted relative group">
            {video.thumbnailUrl ? (
              <img
                src={video.thumbnailUrl}
                alt={video.title || "Video thumbnail"}
                className="h-full w-full object-cover"
                loading="lazy"
                decoding="async"
                width={320}
                height={180}
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
                className="absolute inset-0 flex items-center justify-center bg-[var(--overlay-bg)] opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100 rounded-none"
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
              <span
                className={cn("h-2 w-2 shrink-0 rounded-full", STATUS_DOT_MAP[video.status])}
                aria-hidden="true"
              />
              <span className={cn("text-xs font-medium", STATUS_TEXT_MAP[video.status])}>
                {STATUS_LABEL_MAP[video.status]}
              </span>
              <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                {relativeTime}
              </span>
            </div>
            <h3 className="line-clamp-2 font-medium break-words [overflow-wrap:anywhere]">
              {video.title || "Loading..."}
            </h3>
            {video.channel && (
              <p className="mt-1 text-sm text-muted-foreground truncate" title={video.channel}>
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
