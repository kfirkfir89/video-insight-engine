import { useRef, useImperativeHandle, forwardRef, useEffect, useState, useCallback } from "react";
import { cn } from "@/lib/utils";

// YouTube video IDs are exactly 11 characters: alphanumeric, dash, underscore
const YOUTUBE_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;

// YouTube IFrame API type declarations
declare global {
  interface Window {
    YT: {
      Player: new (
        element: HTMLElement | string,
        options: {
          videoId: string;
          playerVars?: {
            autoplay?: 0 | 1;
            start?: number;
            modestbranding?: 0 | 1;
            rel?: 0 | 1;
            enablejsapi?: 0 | 1;
            playsinline?: 0 | 1;
            origin?: string;
          };
          events?: {
            onReady?: (event: { target: YTPlayer }) => void;
            onStateChange?: (event: { data: number; target: YTPlayer }) => void;
            onError?: (event: { data: number }) => void;
          };
        }
      ) => YTPlayer;
      PlayerState: {
        UNSTARTED: -1;
        ENDED: 0;
        PLAYING: 1;
        PAUSED: 2;
        BUFFERING: 3;
        CUED: 5;
      };
    };
    onYouTubeIframeAPIReady: (() => void) | undefined;
  }
}

interface YTPlayer {
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  getCurrentTime: () => number;
  destroy: () => void;
  getPlayerState: () => number;
}

// Track API loading state globally
let apiLoadPromise: Promise<void> | null = null;

/** Timeout for YouTube API script load (10 seconds) */
const API_LOAD_TIMEOUT_MS = 10000;

function loadYouTubeAPI(): Promise<void> {
  // Already loaded
  if (window.YT?.Player) {
    return Promise.resolve();
  }

  // Already loading
  if (apiLoadPromise) {
    return apiLoadPromise;
  }

  apiLoadPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("YouTube API load timeout"));
    }, API_LOAD_TIMEOUT_MS);

    const existingCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      clearTimeout(timeout);
      existingCallback?.();
      resolve();
    };

    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    tag.onerror = () => {
      clearTimeout(timeout);
      reject(new Error("Failed to load YouTube API script"));
    };
    const firstScriptTag = document.getElementsByTagName("script")[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
  });

  return apiLoadPromise;
}

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
    const containerRef = useRef<HTMLDivElement>(null);
    const playerRef = useRef<YTPlayer | null>(null);
    const [isReady, setIsReady] = useState(false);
    const [hasError, setHasError] = useState(false);

    // Stable callback for onReady
    const handleReady = useCallback(() => {
      setIsReady(true);
      onReady?.();
    }, [onReady]);

    // Expose player methods via ref
    useImperativeHandle(ref, () => ({
      seekTo: (seconds: number) => {
        if (playerRef.current && isReady) {
          playerRef.current.seekTo(seconds, true);
        }
      },
      playVideo: () => {
        if (playerRef.current && isReady) {
          playerRef.current.playVideo();
        }
      },
      pauseVideo: () => {
        if (playerRef.current && isReady) {
          playerRef.current.pauseVideo();
        }
      },
      getCurrentTime: () => {
        if (playerRef.current && isReady) {
          return playerRef.current.getCurrentTime();
        }
        return 0;
      },
    }), [isReady]);

    // Initialize YouTube player
    useEffect(() => {
      if (!YOUTUBE_ID_REGEX.test(youtubeId)) {
        return;
      }

      let mounted = true;
      let player: YTPlayer | null = null;

      loadYouTubeAPI()
        .then(() => {
          if (!mounted || !containerRef.current) return;

          // Create unique ID for the container
          const containerId = `yt-player-${youtubeId}-${Date.now()}`;
          containerRef.current.id = containerId;

          player = new window.YT.Player(containerId, {
            videoId: youtubeId,
            playerVars: {
              autoplay: autoplay ? 1 : 0,
              start: startSeconds,
              modestbranding: 1,
              rel: 0,
              enablejsapi: 1,
              playsinline: 1,
              origin: window.location.origin,
            },
            events: {
              onReady: () => {
                if (mounted) {
                  playerRef.current = player;
                  handleReady();
                }
              },
              onError: () => {
                if (mounted) {
                  setHasError(true);
                }
              },
            },
          });
        })
        .catch(() => {
          if (mounted) {
            setHasError(true);
          }
        });

      return () => {
        mounted = false;
        if (player) {
          try {
            player.destroy();
          } catch (error) {
            // Player may already be destroyed - log in dev for debugging
            if (import.meta.env.DEV) {
              console.debug("YouTube player cleanup:", error);
            }
          }
        }
        playerRef.current = null;
        setIsReady(false);
      };
    }, [youtubeId, startSeconds, autoplay, handleReady]);

    // Validate YouTube ID format
    if (!YOUTUBE_ID_REGEX.test(youtubeId)) {
      return (
        <div className={cn("aspect-video w-full overflow-hidden rounded-lg bg-muted flex items-center justify-center", className)}>
          <span className="text-muted-foreground">Invalid video ID</span>
        </div>
      );
    }

    if (hasError) {
      return (
        <div className={cn("aspect-video w-full overflow-hidden rounded-lg bg-muted flex items-center justify-center", className)}>
          <span className="text-muted-foreground">Failed to load video</span>
        </div>
      );
    }

    return (
      <div className={cn("aspect-video w-full overflow-hidden rounded-lg bg-black", className)}>
        <div ref={containerRef} className="h-full w-full" />
      </div>
    );
  }
);
