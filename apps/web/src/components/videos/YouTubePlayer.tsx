import { useRef, useImperativeHandle, forwardRef, useEffect } from "react";
import { cn } from "@/lib/utils";

// YouTube video IDs are exactly 11 characters: alphanumeric, dash, underscore
const YOUTUBE_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;

export interface YouTubePlayerRef {
  seekTo: (seconds: number) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  getCurrentTime: () => number;
}

interface YouTubePlayerProps {
  youtubeId: string;
  startSeconds?: number;
  autoplay?: boolean;
  className?: string;
  onReady?: () => void;
}

export const YouTubePlayer = forwardRef<YouTubePlayerRef, YouTubePlayerProps>(
  function YouTubePlayer(
    { youtubeId, startSeconds = 0, autoplay = false, className, onReady },
    ref
  ) {
    const iframeRef = useRef<HTMLIFrameElement>(null);

    // TODO: Implement YouTube IFrame API for proper player control
    // Current implementation is a stub - iframe postMessage API required for seekTo/play/pause
    useImperativeHandle(ref, () => ({
      seekTo: (_seconds: number) => {
        // Requires YouTube IFrame API postMessage implementation
      },
      playVideo: () => {
        // Requires YouTube IFrame API postMessage implementation
      },
      pauseVideo: () => {
        // Requires YouTube IFrame API postMessage implementation
      },
      getCurrentTime: () => {
        return 0;
      },
    }));

    useEffect(() => {
      onReady?.();
    }, [onReady]);

    // Validate YouTube ID format
    if (!YOUTUBE_ID_REGEX.test(youtubeId)) {
      return (
        <div className={cn("aspect-video w-full overflow-hidden rounded-lg bg-muted flex items-center justify-center", className)}>
          <span className="text-muted-foreground">Invalid video ID</span>
        </div>
      );
    }

    const params = new URLSearchParams({
      autoplay: autoplay ? "1" : "0",
      start: String(startSeconds),
      modestbranding: "1",
      rel: "0",
      enablejsapi: "1",
    });

    return (
      <div className={cn("aspect-video w-full overflow-hidden rounded-lg bg-black", className)}>
        <iframe
          ref={iframeRef}
          src={`https://www.youtube.com/embed/${encodeURIComponent(youtubeId)}?${params.toString()}`}
          title="YouTube video player"
          className="h-full w-full"
          sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }
);
