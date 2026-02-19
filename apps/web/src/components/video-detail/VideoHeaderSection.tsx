import { Clock, Layers, Lightbulb, StopCircle, ExternalLink, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDuration, timeAgo } from "@/lib/string-utils";
import { VideoTags } from "./VideoTags";
import type { VideoResponse, VideoSummary } from "@vie/types";

interface VideoHeaderSectionProps {
  video: VideoResponse;
  summary: VideoSummary | null;
  isStreaming: boolean;
  onStopSummarization?: () => void;
  actions?: React.ReactNode;
  backButton?: React.ReactNode;
  thumbnailUrl?: string | null;
}

/**
 * Video metadata header with colorful stat pills.
 * Inspired by modern dashboard headers — title, subtitle breadcrumb, colored badges.
 */
export function VideoHeaderSection({
  video,
  summary,
  isStreaming,
  onStopSummarization,
  actions,
  backButton,
  thumbnailUrl,
}: VideoHeaderSectionProps) {
  const youtubeUrl = video.youtubeId
    ? `https://youtube.com/watch?v=${video.youtubeId}`
    : null;

  const chapterCount = summary?.chapters?.length ?? 0;
  const conceptCount = summary?.concepts?.length ?? 0;

  return (
    <header id="video-header" className="mb-0 flex gap-4">
      <div className="flex justify-between flex-1 min-w-0">
        <div className="flex">
          <div>
            <div className="flex gap-2">
              {backButton}
              <div className="flex-col w-full">
                {/* Title + Actions row */}
                <div className={cn("flex items-start justify-between gap-4 mb-1")}>
                  <div className="flex items-center gap-1 min-w-0">
                    {youtubeUrl ? (
                      <a
                        href={youtubeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group inline-flex items-start gap-2 hover:text-primary transition-colors min-w-0"
                      >
                        <h1 className="text-xl font-bold leading-snug">{video.title}</h1>
                        <ExternalLink className="h-3.5 w-3.5 mt-1.5 opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
                      </a>
                    ) : (
                      <h1 className="text-xl font-bold leading-snug">{video.title}</h1>
                    )}
                  </div>
                </div>

                {/* Breadcrumb subtitle: channel · summarized time */}
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
                  {video.channel && (
                    <>
                      <span className="font-medium">{video.channel}</span>
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

                {/* Author + Tags */}
                {video.context?.displayTags && video.context.displayTags.length > 0 && (
                  <VideoTags tags={video.context.displayTags} className="mb-2" />
                )}
              </div>
            </div>

            {/* Colorful stat pills — theme-aware */}
            <div className="flex gap-2 flex-wrap">
              {video.duration && (
                <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                  <Clock className="h-3 w-3" />
                  {formatDuration(video.duration)}
                </span>
              )}
              {chapterCount > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                  <Layers className="h-3 w-3" />
                  {chapterCount} Chapters
                </span>
              )}
              {conceptCount > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                  <Lightbulb className="h-3 w-3" />
                  {conceptCount} Concepts
                </span>
              )}
            </div>
          </div>
          {/* Thumbnail — far right of header */}
          {thumbnailUrl && (
            <img
              src={thumbnailUrl}
              alt=""
              className="w-32 rounded-lg object-cover shrink-0 self-stretch"
              loading="lazy"
            />
          )}
        </div>
        <div className="self-end">
          {/* Streaming stop button as a pill */}
          {isStreaming && onStopSummarization && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onStopSummarization}
              className="gap-1 h-auto py-1 px-2.5 text-xs rounded-full text-destructive hover:bg-destructive/10"
            >
              <StopCircle className="h-3 w-3" />
              Stop
            </Button>
          )}

          {actions && (
            <div className="flex items-center gap-2 shrink-0">
              {actions}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
