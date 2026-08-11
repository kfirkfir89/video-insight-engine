import { createContext, useContext, useRef, useState, useCallback, useEffect, useMemo, type ReactNode } from 'react';
import type { YouTubePlayerRef } from '@/components/videos/YouTubePlayer';

interface VideoPlayerContextType {
  seekTo: (seconds: number) => void;
  isPlayerOpen: boolean;
  openPlayer: () => void;
  closePlayer: () => void;
  togglePlayer: () => void;
  playerRef: React.RefObject<YouTubePlayerRef | null>;
  /** Current playback time in seconds (polled at 1s interval when player is open). */
  currentTime: number;
}

const VideoPlayerContext = createContext<VideoPlayerContextType | null>(null);

const NOOP_CONTEXT: VideoPlayerContextType = {
  seekTo: () => {},
  isPlayerOpen: false,
  openPlayer: () => {},
  closePlayer: () => {},
  togglePlayer: () => {},
  playerRef: { current: null },
  currentTime: 0,
};

export function VideoPlayerProvider({ children }: { children: ReactNode }) {
  const playerRef = useRef<YouTubePlayerRef | null>(null);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const isPlayerOpenRef = useRef(false);
  isPlayerOpenRef.current = isPlayerOpen;

  // Poll currentTime from the YouTube player at 1s interval when player is open
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (isPlayerOpen) {
      intervalRef.current = setInterval(() => {
        const t = playerRef.current?.getCurrentTime?.();
        if (typeof t === 'number') setCurrentTime(t);
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlayerOpen]);

  const openPlayer = useCallback(() => setIsPlayerOpen(true), []);
  const closePlayer = useCallback(() => setIsPlayerOpen(false), []);
  const togglePlayer = useCallback(() => setIsPlayerOpen(prev => !prev), []);

  const seekTo = useCallback((seconds: number) => {
    setIsPlayerOpen(true);
    // Small delay to ensure player is mounted before seeking
    requestAnimationFrame(() => {
      setTimeout(() => {
        playerRef.current?.seekTo(seconds);
        playerRef.current?.playVideo();
      }, isPlayerOpenRef.current ? 0 : 350);
    });
  }, []);

  const value = useMemo<VideoPlayerContextType>(() => ({
    seekTo, isPlayerOpen, openPlayer, closePlayer, togglePlayer, playerRef, currentTime,
  }), [seekTo, isPlayerOpen, openPlayer, closePlayer, togglePlayer, currentTime]);

  return (
    <VideoPlayerContext.Provider value={value}>
      {children}
    </VideoPlayerContext.Provider>
  );
}

/**
 * Hook to access the video player context.
 * Returns no-op fallback when used outside VideoPlayerProvider (safety for shared components).
 */
export function useVideoPlayer(): VideoPlayerContextType {
  const ctx = useContext(VideoPlayerContext);
  if (!ctx) return NOOP_CONTEXT;
  return ctx;
}
