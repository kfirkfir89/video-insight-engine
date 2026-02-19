import { useState, useCallback, type RefObject } from "react";
import { findScrollParent } from "@/lib/dom-utils";
import type { YouTubePlayerRef } from "@/components/videos/YouTubePlayer";

/**
 * Manages chapter play/seek state for the video detail page.
 * Encapsulates which chapter is playing, scroll-to-chapter logic,
 * and YouTube player seek commands.
 */
export function useChapterPlayback(
  playerRef: RefObject<YouTubePlayerRef | null>,
  isDesktop: boolean
) {
  const [activePlayChapter, setActivePlayChapter] = useState<string | null>(null);
  const [activeStartSeconds, setActiveStartSeconds] = useState<number>(0);

  const handlePlayFromChapter = useCallback((chapterId: string, startSeconds: number) => {
    if (isDesktop) {
      setActivePlayChapter(chapterId);
      setActiveStartSeconds(startSeconds);
      requestAnimationFrame(() => {
        const chapterElement = document.getElementById(`chapter-${chapterId}`);
        if (chapterElement) {
          const scrollContainer = findScrollParent(chapterElement);
          const containerRect = scrollContainer.getBoundingClientRect();
          const elementRect = chapterElement.getBoundingClientRect();
          const relativeTop = elementRect.top - containerRect.top + scrollContainer.scrollTop;
          const offset = 80;
          scrollContainer.scrollTo({ top: relativeTop - offset, behavior: "smooth" });
        }
      });
    } else {
      const videoElement = document.getElementById("video-header") || document.getElementById("video-player");
      if (videoElement) {
        videoElement.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      requestAnimationFrame(() => {
        playerRef.current?.seekTo(startSeconds);
        playerRef.current?.playVideo();
      });
    }
  }, [isDesktop, playerRef]);

  const handleStopChapter = useCallback(() => {
    setActivePlayChapter(null);
  }, []);

  const handleSeekToChapter = useCallback((startSeconds: number) => {
    const videoElement = document.getElementById("video-header") || document.getElementById("video-player");
    if (videoElement) {
      videoElement.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    requestAnimationFrame(() => {
      playerRef.current?.seekTo(startSeconds);
      playerRef.current?.playVideo();
    });
  }, [playerRef]);

  return {
    activePlayChapter,
    activeStartSeconds,
    handlePlayFromChapter,
    handleStopChapter,
    handleSeekToChapter,
  };
}
