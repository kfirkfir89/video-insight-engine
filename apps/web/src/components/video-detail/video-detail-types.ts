import type { RefObject } from "react";
import type { YouTubePlayerRef } from "@/components/videos/YouTubePlayer";
import type { VideoResponse, VideoSummary, Concept, StreamingChapter } from "@vie/types";
import type { Chapter, DescriptionAnalysis } from "@/hooks/use-summary-stream";

/**
 * Common props shared between Desktop and Mobile video detail layouts.
 */
export interface VideoDetailCommonProps {
  video: VideoResponse;
  summary: VideoSummary;
  isStreaming: boolean;
  onStopSummarization?: () => void;
  onOpenMasterSummary: () => void;
  // Chapters from progressive summarization
  effectiveChapters: Chapter[] | StreamingChapter[];
  effectiveIsCreatorChapters: boolean;
  effectiveDescriptionAnalysis: DescriptionAnalysis | null;
  // Chapter play state
  activePlayChapter: string | null;
  activeStartSeconds: number;
  // Handlers
  handlePlayFromChapter: (chapterId: string, startSeconds: number) => void;
  handleStopChapter: () => void;
  handleSeekToChapter: (startSeconds: number) => void;
  // Active chapter tracking
  activeId: string | null;
  scrollToChapter: (id: string) => void;
  // Concept matching result
  conceptMatchResult: {
    byChapter: Map<string, Concept[]>;
    orphaned: Concept[];
  };
  // Player ref for mobile scroll-to-play
  playerRef: RefObject<YouTubePlayerRef | null>;
}
