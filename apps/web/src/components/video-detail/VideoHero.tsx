import { memo } from "react";
import { ExternalLink, StopCircle, Radio, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatDuration, timeAgo } from "@/lib/string-utils";
import { VideoTags } from "./VideoTags";
import type { VideoResponse, VideoSummary } from "@vie/types";

interface VideoHeroProps {
  video: VideoResponse;
  summary: VideoSummary | null;
  isStreaming: boolean;
  onStopSummarization?: () => void;
  thumbnailUrl?: string | null;
  backButton?: React.ReactNode;
  primaryAction?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

/**
 * Hero card — centered card with video metadata + TL;DR.
 */
export const VideoHero = memo(function VideoHero({
  video,
  summary,
  isStreaming,
  onStopSummarization,
  thumbnailUrl,
  backButton,
  primaryAction,
  actions,
  className,
}: VideoHeroProps) {
  const youtubeUrl = video.youtubeId
    ? `https://youtube.com/watch?v=${video.youtubeId}`
    : null;

  const chapterCount = summary?.chapters?.length ?? 0;
  const conceptCount = summary?.concepts?.length ?? 0;
  const tldr = summary?.tldr ?? "";
  const keyTakeaways = summary?.keyTakeaways ?? [];
  const showSkeleton = !tldr && isStreaming;
  const showCursor = isStreaming && !!tldr;

  return (
    <div
      id="video-header"
      className={cn(
        "relative overflow-hidden rounded-xl border border-border/50 bg-card shadow-sm",
        className,
      )}
    >
      <div className="p-5">
        {/* Toolbar — compact solid bar */}
        <div className="flex items-center justify-between mb-2 pb-2 border-b border-border/40">
          <div className="shrink-0">{backButton}</div>
          <div className="flex items-center gap-1">
            {isStreaming && onStopSummarization && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onStopSummarization}
                className="gap-1 h-7 py-0 px-2 text-xs text-destructive hover:bg-destructive/10"
              >
                <StopCircle className="h-3 w-3" />
                Stop
              </Button>
            )}
            {primaryAction}
            {actions}
          </div>
        </div>

        {/* Thumbnail + title row */}
        <div className="flex gap-4 mb-1.5">
          {thumbnailUrl && (
            <img
              src={thumbnailUrl}
              alt=""
              className="w-40 h-[90px] rounded-lg object-cover shrink-0"
              loading="lazy"
            />
          )}
          <div className="min-w-0 flex-1">
            {/* Title with YouTube link + ExternalLink hover icon */}
            <div className="flex items-center gap-1 min-w-0 mb-1">
              {youtubeUrl ? (
                <a
                  href={youtubeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-start gap-2 hover:text-primary transition-colors min-w-0"
                >
                  <h1 className="text-lg font-bold leading-snug">{video.title}</h1>
                  <ExternalLink className="h-3.5 w-3.5 mt-1.5 opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
                </a>
              ) : (
                <h1 className="text-lg font-bold leading-snug">{video.title}</h1>
              )}
            </div>

            {/* Inline metadata breadcrumb — plain text, middot-separated */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
              {video.channel && (
                <>
                  <span className="font-medium">{video.channel}</span>
                  <span className="text-muted-foreground/30">&middot;</span>
                </>
              )}
              {video.duration && (
                <>
                  <span>{formatDuration(video.duration)}</span>
                  <span className="text-muted-foreground/30">&middot;</span>
                </>
              )}
              {chapterCount > 0 && (
                <>
                  <span>{chapterCount} chapters</span>
                  <span className="text-muted-foreground/30">&middot;</span>
                </>
              )}
              {conceptCount > 0 && (
                <>
                  <span>{conceptCount} concepts</span>
                  <span className="text-muted-foreground/30">&middot;</span>
                </>
              )}
              <span>
                {video.status === "completed"
                  ? `Summarized ${timeAgo(video.createdAt)}`
                  : video.status === "processing"
                    ? "Processing..."
                    : video.status}
              </span>
              {isStreaming && (
                <>
                  <span className="text-muted-foreground/30">&middot;</span>
                  <span className="flex items-center gap-1 text-primary">
                    <Radio className="h-3 w-3 animate-pulse" />
                    Live
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Tags */}
        {video.context?.displayTags && video.context.displayTags.length > 0 && (
          <VideoTags tags={video.context.displayTags} className="mb-2" />
        )}

        {/* TL;DR section — only when summary exists */}
        {summary && (
          <>
            {/* Fade divider between metadata and TLDR */}
            <div className="h-px bg-gradient-to-r from-transparent via-border/50 to-transparent my-3" />

            <h2 className="text-xs font-bold uppercase tracking-widest text-primary/60 mb-2">
              TL;DR
            </h2>

            {showSkeleton ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-4 w-3/5" />
              </div>
            ) : (
              tldr && (
                <p className="text-sm leading-relaxed text-foreground">
                  {tldr}
                  {showCursor && (
                    <span className="inline-block w-0.5 h-4 ml-0.5 bg-primary align-middle animate-pulse" />
                  )}
                </p>
              )
            )}

            {/* Key takeaways */}
            {keyTakeaways.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {keyTakeaways.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <CheckCircle className="h-3.5 w-3.5 text-primary/70 shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
});
