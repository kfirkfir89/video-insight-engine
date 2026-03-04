// TODO: v1.5 Phase 2 — Add react-swipeable for touch gestures on mobile (desktop-first MVP)
import { memo } from "react";
import { ExternalLink, StopCircle, Radio, CheckCircle, Clock, BookOpen, Lightbulb, Loader2, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatDuration, timeAgo } from "@/lib/string-utils";
import { VideoTags } from "./VideoTags";
import { DetectionOverride } from "./DetectionOverride";
import type { VideoResponse, VideoSummary, OutputType } from "@vie/types";
import type { DetectionResult } from "@/hooks/use-summary-stream";

export interface VideoHeroShareProps {
  detectionResult?: DetectionResult | null;
  onOverrideOutputType?: (type: OutputType) => void;
  onShare?: () => void;
  isSharing?: boolean;
}

interface VideoHeroProps {
  video: VideoResponse;
  summary: VideoSummary | null;
  isStreaming: boolean;
  onStopSummarization?: () => void;
  thumbnailUrl?: string | null;
  primaryAction?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  streamingPhaseLabel?: string;
  /** Detection override + share controls */
  share?: VideoHeroShareProps;
}

/** Shared toolbar for stop/primary/actions — avoids duplicating JSX. */
function HeroToolbar({
  isStreaming,
  onStopSummarization,
  primaryAction,
  actions,
}: Pick<VideoHeroProps, "isStreaming" | "onStopSummarization" | "primaryAction" | "actions">) {
  if (!isStreaming && !primaryAction && !actions) return null;
  return (
    <div className="flex items-center justify-end gap-1 mt-4 pt-3 border-t border-border/40">
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
  );
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
  primaryAction,
  actions,
  className,
  streamingPhaseLabel,
  share,
}: VideoHeroProps) {
  const { detectionResult, onOverrideOutputType, onShare, isSharing } = share ?? {};
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
      {/* Thumbnail + title row */}
      <div className="flex">
        {thumbnailUrl && (
          <img
            src={thumbnailUrl}
            alt={video.title}
            className="hidden sm:block w-48 max-w-[33%] self-stretch rounded-tl-xl object-cover shrink-0"
            fetchPriority="high"
            decoding="async"
          />
        )}

        <div className="min-w-0 flex-1 p-5">
          {/* Title */}
          <div className="mb-1">
            {youtubeUrl ? (
              <a
                href={youtubeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group inline hover:text-primary transition-colors"
              >
                <h1 className="text-lg font-bold leading-tight inline">{video.title}</h1>
                <ExternalLink className="h-3.5 w-3.5 ml-1.5 inline-block align-text-top opacity-0 group-hover:opacity-60 transition-opacity" />
              </a>
            ) : (
              <h1 className="text-lg font-bold leading-tight">{video.title}</h1>
            )}
          </div>

          {/* Colored metadata breadcrumb */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
            {video.channel && (
              <>
                <span className="font-medium">{video.channel}</span>
                <span className="text-muted-foreground/40">&middot;</span>
              </>
            )}
            {video.duration && (
              <>
                <span className="inline-flex items-center gap-1 text-info">
                  <Clock className="h-3 w-3" />
                  {formatDuration(video.duration)}
                </span>
                <span className="text-muted-foreground/40">&middot;</span>
              </>
            )}
            {chapterCount > 0 && (
              <>
                <span className="inline-flex items-center gap-1 text-success">
                  <BookOpen className="h-3 w-3" />
                  {chapterCount} chapters
                </span>
                <span className="text-muted-foreground/40">&middot;</span>
              </>
            )}
            {conceptCount > 0 && (
              <>
                <span className="inline-flex items-center gap-1 text-warning">
                  <Lightbulb className="h-3 w-3" />
                  {conceptCount} concepts
                </span>
                <span className="text-muted-foreground/40">&middot;</span>
              </>
            )}
            <span>
              {video.status === "completed"
                ? `Summarized ${timeAgo(video.createdAt)}`
                : video.status === "processing"
                  ? "Processing..."
                  : video.status}
            </span>
          </div>

          {/* Tags */}
          {video.context?.displayTags && video.context.displayTags.length > 0 && (
            <VideoTags tags={video.context.displayTags} className="mt-1.5" />
          )}

          {/* Detection override + share */}
          {(detectionResult || onShare) && (
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {detectionResult && onOverrideOutputType && (
                <DetectionOverride
                  detectedType={detectionResult.detectedType}
                  confidence={detectionResult.confidence}
                  alternatives={detectionResult.alternatives}
                  onOverride={onOverrideOutputType}
                />
              )}
              {onShare && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 h-7 py-0 px-2 text-xs"
                  onClick={onShare}
                  disabled={isSharing}
                  aria-label="Share this summary"
                >
                  <Share2 className="h-3 w-3" />
                  {isSharing ? "Sharing..." : "Share"}
                </Button>
              )}
            </div>
          )}

          {/* Inline streaming phase indicator */}
          {isStreaming && streamingPhaseLabel && (
            <div className="flex items-center gap-2 mt-2 text-xs text-primary">
              <Radio className="h-3 w-3 animate-pulse shrink-0" />
              <span className="font-medium">{streamingPhaseLabel}</span>
              <Loader2 className="h-3 w-3 animate-spin ml-auto shrink-0" />
            </div>
          )}
        </div>
      </div>

      {/* TL;DR section — below the thumbnail row */}
      {summary && (
        <div className="px-5 pb-5">
          {/* Fade divider between metadata and TLDR */}
          <div className="h-px bg-gradient-to-r from-transparent via-border/50 to-transparent my-3" />

          <h2 className="text-base font-bold text-foreground mb-2">
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

          <HeroToolbar
            isStreaming={isStreaming}
            onStopSummarization={onStopSummarization}
            primaryAction={primaryAction}
            actions={actions}
          />
        </div>
      )}

      {/* Toolbar when no summary yet (streaming/loading) */}
      {!summary && (
        <div className="px-5 pb-5">
          <HeroToolbar
            isStreaming={isStreaming}
            onStopSummarization={onStopSummarization}
            primaryAction={primaryAction}
            actions={actions}
          />
        </div>
      )}
    </div>
  );
});
