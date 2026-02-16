import { Clock, Layers, Lightbulb, StopCircle, ExternalLink, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VideoTags } from "./VideoTags";
import type { VideoResponse, VideoSummary } from "@vie/types";

interface VideoHeaderSectionProps {
  video: VideoResponse;
  summary: VideoSummary | null;
  isStreaming: boolean;
  onStopSummarization?: () => void;
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
}: VideoHeaderSectionProps) {
  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString();
  };

  const youtubeUrl = video.youtubeId
    ? `https://youtube.com/watch?v=${video.youtubeId}`
    : null;

  const chapterCount = summary?.chapters?.length ?? 0;
  const conceptCount = summary?.concepts?.length ?? 0;

  return (
    <header id="video-header" className="mb-3">
      {/* Title */}
      <div className="mb-1.5">
        {youtubeUrl ? (
          <a
            href={youtubeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-start gap-2 hover:text-primary transition-colors"
          >
            <h1 className="text-xl font-bold leading-snug">{video.title}</h1>
            <ExternalLink className="h-3.5 w-3.5 mt-1.5 opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
          </a>
        ) : (
          <h1 className="text-xl font-bold leading-snug">{video.title}</h1>
        )}
      </div>

      {/* Breadcrumb subtitle: channel · summarized time */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2.5">
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

      {/* Colorful stat pills */}
      <div className="flex items-center gap-2 flex-wrap mb-2">
        {video.duration && (
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
            style={{ background: "oklch(88% 0.08 250)", color: "oklch(40% 0.18 255)" }}
          >
            <Clock className="h-3 w-3" />
            {formatDuration(video.duration)}
          </span>
        )}
        {chapterCount > 0 && (
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
            style={{ background: "oklch(88% 0.08 155)", color: "oklch(40% 0.14 160)" }}
          >
            <Layers className="h-3 w-3" />
            {chapterCount} Chapters
          </span>
        )}
        {conceptCount > 0 && (
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
            style={{ background: "oklch(90% 0.08 80)", color: "oklch(42% 0.12 55)" }}
          >
            <Lightbulb className="h-3 w-3" />
            {conceptCount} Concepts
          </span>
        )}

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
      </div>

      {/* Tags */}
      {video.context?.displayTags && video.context.displayTags.length > 0 && (
        <VideoTags tags={video.context.displayTags} className="mb-1" />
      )}
    </header>
  );
}
