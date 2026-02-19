import { useRef, useCallback, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Layout } from "@/components/layout/Layout";
import type { YouTubePlayerRef } from "@/components/videos/YouTubePlayer";
import { useActiveChapter } from "@/hooks/use-active-chapter";
import { useChapterPlayback } from "@/hooks/use-chapter-playback";
import { useIsDesktop, useIsLargeDesktop } from "@/hooks/use-media-query";
import { matchConceptsToChapters } from "@/lib/timestamp-utils";
import { RightPanelTabs } from "./RightPanelTabs";
import { StickyChapterNav } from "./StickyChapterNav";
import { VideoChatPanel } from "./VideoChatPanel";
import { ChapterList } from "./ChapterList";
import { ResourcesPanel } from "./ResourcesPanel";
import { MasterSummaryModal } from "./MasterSummaryModal";
import { VideoHero } from "./VideoHero";
import { VideoDetailDesktop } from "./VideoDetailDesktop";
import { VideoDetailMobile } from "./VideoDetailMobile";
import { VideoSummaryIdProvider } from "./VideoSummaryIdContext";
import type { VideoResponse, VideoSummary, StreamingChapter, SummaryChapter } from "@vie/types";
import type { StreamState, DescriptionAnalysis } from "@/hooks/use-summary-stream";

interface VideoDetailLayoutProps {
  video: VideoResponse;
  summary: VideoSummary | null;
  isStreaming?: boolean;
  streamingState?: StreamState;
  chapters?: StreamingChapter[] | SummaryChapter[];
  isCreatorChapters?: boolean;
  descriptionAnalysis?: DescriptionAnalysis | null;
  onStopSummarization?: () => void;
  streamingPhaseLabel?: string;
}

/**
 * Orchestrator component for video detail page.
 * Manages shared state and delegates rendering to Desktop or Mobile layouts.
 */
export function VideoDetailLayout({
  video,
  summary,
  isStreaming = false,
  streamingState,
  chapters = [],
  isCreatorChapters = false,
  descriptionAnalysis = null,
  onStopSummarization,
  streamingPhaseLabel,
}: VideoDetailLayoutProps) {
  // Derived values from props or streaming state
  const effectiveChapters = (chapters?.length ?? 0) > 0 ? chapters : streamingState?.chapters || [];
  const effectiveIsCreatorChapters = (chapters?.length ?? 0) > 0 ? isCreatorChapters : streamingState?.isCreatorChapters || false;
  const effectiveDescriptionAnalysis = descriptionAnalysis || streamingState?.descriptionAnalysis || null;

  const playerRef = useRef<YouTubePlayerRef>(null);
  const isDesktop = useIsDesktop();
  const isLargeDesktop = useIsLargeDesktop();

  // Chapter playback state (play, stop, seek)
  const {
    activePlayChapter,
    activeStartSeconds,
    handlePlayFromChapter,
    handleStopChapter,
    handleSeekToChapter,
  } = useChapterPlayback(playerRef, isDesktop);

  // Master summary modal state
  const [showMasterSummary, setShowMasterSummary] = useState(false);

  // Video chat state
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Go Deeper expanded chapter state
  const [expandedChapterId, setExpandedChapterId] = useState<string | null>(null);

  // Stable dependency for chapter tracking
  const chapterIdsString = (summary?.chapters ?? []).map((s) => s.id).join(",");
  const chapterIds = useMemo(
    () => (summary?.chapters ?? []).map((s) => s.id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chapterIdsString]
  );

  const { activeId, scrollToChapter } = useActiveChapter(chapterIds);

  // Match concepts to chapters
  const conceptMatchResult = useMemo(() => {
    if (!summary?.concepts || !summary?.chapters) {
      return { byChapter: new Map(), orphaned: [] };
    }
    return matchConceptsToChapters(summary.concepts, (summary.chapters ?? []));
  }, [summary?.concepts, summary?.chapters]);

  const handleOpenMasterSummary = useCallback(() => {
    setShowMasterSummary(true);
  }, []);

  const handleToggleChat = useCallback(() => {
    setIsChatOpen((prev) => !prev);
  }, []);

  const handleGoDeeper = useCallback((chapterId: string) => {
    setExpandedChapterId((prev) => (prev === chapterId ? null : chapterId));
  }, []);

  const videoSummaryId = video.videoSummaryId ?? "";

  // Shared panel content — used by both inline (large desktop) and floating (medium) variants
  const panelContent = useMemo(() => {
    if (!summary) return null;
    return {
      chapters: (
        <StickyChapterNav
          chapters={summary.chapters ?? []}
          activeChapter={activeId}
          activePlayChapter={activePlayChapter}
          onScrollToChapter={scrollToChapter}
          onPlayFromChapter={handlePlayFromChapter}
          onStopChapter={handleStopChapter}
          conceptsByChapter={conceptMatchResult.byChapter}
        />
      ),
      chat: (
        <VideoChatPanel
          videoSummaryId={videoSummaryId}
          videoTitle={video.title}
          className="h-full"
        />
      ),
    };
  }, [
    summary, activeId, activePlayChapter, scrollToChapter,
    handlePlayFromChapter, handleStopChapter, conceptMatchResult.byChapter,
    videoSummaryId, video.title,
  ]);

  // Inline right panel for large desktop (≥1280px)
  const rightPanelElement = useMemo(() => {
    if (!panelContent || !isLargeDesktop) return undefined;
    return (
      <RightPanelTabs
        chaptersContent={panelContent.chapters}
        chatContent={panelContent.chat}
        variant="inline"
      />
    );
  }, [panelContent, isLargeDesktop]);

  // Floating panel for medium screens (<1280px)
  const floatingPanel = useMemo(() => {
    if (!panelContent || !isDesktop || isLargeDesktop) return null;
    return (
      <div className="fixed bottom-4 right-3 z-50 w-80 h-[70vh]">
        <RightPanelTabs
          chaptersContent={panelContent.chapters}
          chatContent={panelContent.chat}
          variant="floating"
        />
      </div>
    );
  }, [panelContent, isDesktop, isLargeDesktop]);

  return (
    <Layout>
      {!summary ? (
        // No summary yet - show loading state
        <div className="p-4 md:p-6">
          <div className="space-y-6 max-w-3xl mx-auto">
            <VideoHero
              video={video}
              summary={null}
              isStreaming={isStreaming}
              onStopSummarization={onStopSummarization}
              streamingPhaseLabel={streamingPhaseLabel}
            />

            {effectiveChapters.length > 0 && (
              <ChapterList
                chapters={effectiveChapters}
                isCreatorChapters={effectiveIsCreatorChapters}
                onSeek={handleSeekToChapter}
              />
            )}

            {effectiveDescriptionAnalysis && (
              <ResourcesPanel analysis={effectiveDescriptionAnalysis} />
            )}

            {effectiveChapters.length === 0 && !effectiveDescriptionAnalysis && (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Summary not available yet. Video may still be processing.
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      ) : (
        <VideoSummaryIdProvider videoSummaryId={video.videoSummaryId ?? ""}>
          {isDesktop ? (
            <VideoDetailDesktop
              video={video}
              summary={summary}
              isStreaming={isStreaming}
              onStopSummarization={onStopSummarization}
              onOpenMasterSummary={handleOpenMasterSummary}
              effectiveChapters={effectiveChapters}
              effectiveIsCreatorChapters={effectiveIsCreatorChapters}
              effectiveDescriptionAnalysis={effectiveDescriptionAnalysis}
              activePlayChapter={activePlayChapter}
              activeStartSeconds={activeStartSeconds}
              handlePlayFromChapter={handlePlayFromChapter}
              handleStopChapter={handleStopChapter}
              handleSeekToChapter={handleSeekToChapter}
              activeId={activeId}
              scrollToChapter={scrollToChapter}
              conceptMatchResult={conceptMatchResult}
              playerRef={playerRef}
              isChatOpen={isChatOpen}
              onToggleChat={handleToggleChat}
              onGoDeeper={handleGoDeeper}
              expandedChapterId={expandedChapterId}
              rightPanel={rightPanelElement}
              streamingPhaseLabel={streamingPhaseLabel}
            />
          ) : (
            <VideoDetailMobile
              video={video}
              summary={summary}
              isStreaming={isStreaming}
              onStopSummarization={onStopSummarization}
              onOpenMasterSummary={handleOpenMasterSummary}
              effectiveChapters={effectiveChapters}
              effectiveIsCreatorChapters={effectiveIsCreatorChapters}
              effectiveDescriptionAnalysis={effectiveDescriptionAnalysis}
              activePlayChapter={activePlayChapter}
              activeStartSeconds={activeStartSeconds}
              handlePlayFromChapter={handlePlayFromChapter}
              handleStopChapter={handleStopChapter}
              handleSeekToChapter={handleSeekToChapter}
              activeId={activeId}
              scrollToChapter={scrollToChapter}
              conceptMatchResult={conceptMatchResult}
              playerRef={playerRef}
              isChatOpen={isChatOpen}
              onToggleChat={handleToggleChat}
              onGoDeeper={handleGoDeeper}
              expandedChapterId={expandedChapterId}
              streamingPhaseLabel={streamingPhaseLabel}
            />
          )}
        </VideoSummaryIdProvider>
      )}

      {/* Floating panel for medium desktop (<1280px) — portalled to body for reliable fixed positioning */}
      {floatingPanel && createPortal(floatingPanel, document.body)}

      {/* Master Summary Modal */}
      {summary?.masterSummary && (
        <MasterSummaryModal
          open={showMasterSummary}
          onOpenChange={setShowMasterSummary}
          title={video.title}
          content={summary.masterSummary}
        />
      )}
    </Layout>
  );
}
