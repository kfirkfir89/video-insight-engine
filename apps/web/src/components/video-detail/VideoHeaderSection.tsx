import { Clock, CheckCircle, StopCircle, ExternalLink, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VideoTags } from "./VideoTags";
import type { VideoResponse, VideoSummary } from "@vie/types";

interface VideoHeaderSectionProps {
  video: VideoResponse;
  summary: VideoSummary | null;
  isStreaming: boolean;
  onStopSummarization?: () => void;
  onOpenMasterSummary: () => void;
}

/**
 * Displays video metadata header with title, channel, tags, duration, and status.
 * Also shows Quick Read button (when master summary available) and Stop button (when streaming).
 */
export function VideoHeaderSection({
  video,
  summary,
  isStreaming,
  onStopSummarization,
  onOpenMasterSummary,
}: VideoHeaderSectionProps) {
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const youtubeUrl = video.youtubeId
    ? `https://youtube.com/watch?v=${video.youtubeId}`
    : null;

  return (
    <header id="video-header" className="mb-6">
      <div className="flex flex-col justify-center">
        {/* Clickable title linking to YouTube */}
        {youtubeUrl ? (
          <a
            href={youtubeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-start gap-2 hover:text-primary transition-colors mb-2"
          >
            <h1 className="text-2xl font-bold">{video.title}</h1>
            <ExternalLink className="h-5 w-5 mt-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
          </a>
        ) : (
          <h1 className="text-2xl font-bold mb-2">{video.title}</h1>
        )}

        {video.channel && (
          <p className="text-muted-foreground mb-2">{video.channel}</p>
        )}

        {/* YouTube-style tags display */}
        {video.context?.displayTags && video.context.displayTags.length > 0 && (
          <VideoTags tags={video.context.displayTags} className="mb-3" />
        )}

        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          {video.duration && (
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {formatDuration(video.duration)}
            </span>
          )}
          <span className="flex items-center gap-1">
            <CheckCircle className="h-4 w-4 text-status-success" />
            {video.status}
          </span>
          {/* Quick Read button - show when master summary is available */}
          {summary?.masterSummary && (
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenMasterSummary}
              className="gap-1.5"
            >
              <FileText className="h-4 w-4" />
              Quick Read
            </Button>
          )}
          {/* Stop button when streaming */}
          {isStreaming && onStopSummarization && (
            <Button
              variant="outline"
              size="sm"
              onClick={onStopSummarization}
              className="gap-1.5 text-destructive hover:bg-destructive/10"
            >
              <StopCircle className="h-4 w-4" />
              Stop
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
