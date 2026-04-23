import { useState, memo, useCallback, useMemo, lazy, Suspense } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { Video } from "@/types";
import type { ProcessingStatus } from "@/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { withViewTransition } from "@/lib/view-transitions";
import { getDomainGradient } from "@vie/shared/config";
import { isContentTag } from "@vie/types";
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

/** Ring is reserved for `failed` only — completed/pending/processing already
 *  carry a colored dot + label. Three signals on every card produced a disco
 *  of rings on the grid; one signal where the user must act keeps it quiet. */
const STATUS_RING_MAP: Record<ProcessingStatus, string> = {
  pending: "",
  processing: "",
  completed: "",
  failed: "ring-1 ring-destructive/40",
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
  const navigate = useNavigate();
  const relativeTime = useMemo(
    () => formatRelativeTime(video.createdAt),
    [video.createdAt]
  );

  /** Domain spine — a 3px inline-start bar using the video's content-tag gradient.
   *  Gives the grid chromatic identity without shouting: a fitness video reads
   *  coral, a code video reads mint, etc. Null while processing (no tag yet). */
  const domainGradient = useMemo(() => {
    const tag = video.outputType;
    if (!tag || !isContentTag(tag)) return null;
    return getDomainGradient(tag);
  }, [video.outputType]);

  const handlePlayClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowPlayer(true);
  }, []);

  const handleClosePlayer = useCallback(() => {
    setShowPlayer(false);
  }, []);

  /** Navigate inside a typed View Transition so the title morphs from card to
   *  detail-page header. Modifier-key clicks fall through to default browser
   *  behaviour (open in new tab, etc.). */
  const handleNavigate = useCallback((e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    withViewTransition(
      () => navigate(`/video/${video.id}`),
      { type: "navigate-to-detail" },
    );
  }, [navigate, video.id]);

  /** Per-instance VT name so navigation morphs only the clicked card. */
  const titleVTName = `vie-video-title-${video.id}`;
  const posterVTName = `vie-video-poster-${video.id}`;

  return (
    <>
      <Link
        to={`/video/${video.id}`}
        onClick={handleNavigate}
        className="block [content-visibility:auto] [contain-intrinsic-size:auto_260px]"
      >
        <Card className={cn("relative overflow-hidden transition-[box-shadow,transform] duration-200 ease-out hover:shadow-lg hover:-translate-y-0.5 motion-reduce:hover:translate-y-0", STATUS_RING_MAP[video.status])}>
          {/* Domain-colored spine — absolute inline-start strip. Renders only
              once the pipeline has assigned a content tag, so processing cards
              stay neutral until they're ready. */}
          {domainGradient && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 start-0 w-[3px] z-10"
              style={{ backgroundImage: domainGradient }}
            />
          )}
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
                style={{ viewTransitionName: posterVTName } as React.CSSProperties}
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
                <div className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-primary/90 text-primary-foreground hover:bg-primary transition-colors">
                  <Play className="h-7 w-7 sm:h-8 sm:w-8 ml-1" fill="currentColor" />
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
            <h3
              className="line-clamp-2 font-medium break-words [overflow-wrap:anywhere]"
              style={{ viewTransitionName: titleVTName } as React.CSSProperties}
            >
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
