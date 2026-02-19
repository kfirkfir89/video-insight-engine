import type { RefObject } from "react";
import type { YouTubePlayerRef } from "@/components/videos/YouTubePlayer";
import type { VideoResponse, VideoSummary, Concept, StreamingChapter, SummaryChapter } from "@vie/types";
import type { DescriptionAnalysis } from "@/hooks/use-summary-stream";

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
  effectiveChapters: StreamingChapter[] | SummaryChapter[];
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
  // Video chat state (used by mobile/tablet overlay, not large desktop right panel)
  isChatOpen?: boolean;
  onToggleChat?: (() => void) | undefined;
  // Explain auto handler (Go Deeper)
  onGoDeeper: (chapterId: string) => void;
  expandedChapterId: string | null;
  // Streaming phase label (pre-computed string, e.g. "Summarizing chapter 3 of 7...")
  streamingPhaseLabel?: string;
}
