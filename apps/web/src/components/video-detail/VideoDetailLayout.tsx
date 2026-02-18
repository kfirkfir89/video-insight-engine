import { useRef, useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Layout } from "@/components/layout/Layout";
import type { YouTubePlayerRef } from "@/components/videos/YouTubePlayer";
import { useActiveChapter } from "@/hooks/use-active-chapter";
import { useIsDesktop, useIsLargeDesktop } from "@/hooks/use-media-query";
import { useRightSidebar } from "@/hooks/use-right-sidebar";
import { useUIStore } from "@/stores/ui-store";
import { matchConceptsToChapters } from "@/lib/timestamp-utils";
import { RightPanelStack } from "./RightPanelStack";
import { StickyChapterNav } from "./StickyChapterNav";
import { VideoChatPanel } from "./VideoChatPanel";
import { ChapterList } from "./ChapterList";
import { ResourcesPanel } from "./ResourcesPanel";
import { MasterSummaryModal } from "./MasterSummaryModal";
import { VideoHeaderSection } from "./VideoHeaderSection";
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
}: VideoDetailLayoutProps) {
  // Derived values from props or streaming state
  const effectiveChapters = (chapters?.length ?? 0) > 0 ? chapters : streamingState?.chapters || [];
  const effectiveIsCreatorChapters = (chapters?.length ?? 0) > 0 ? isCreatorChapters : streamingState?.isCreatorChapters || false;
  const effectiveDescriptionAnalysis = descriptionAnalysis || streamingState?.descriptionAnalysis || null;

  const playerRef = useRef<YouTubePlayerRef>(null);
  const isDesktop = useIsDesktop();
  const isLargeDesktop = useIsLargeDesktop();
  const activeRightPanel = useUIStore((s) => s.activeRightPanel);

  // Chapter play state
  const [activePlayChapter, setActivePlayChapter] = useState<string | null>(null);
  const [activeStartSeconds, setActiveStartSeconds] = useState<number>(0);

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

  // Handle play from chapter - collapses video under the chapter on desktop
  const handlePlayFromChapter = useCallback((chapterId: string, startSeconds: number) => {
    if (isDesktop) {
      setActivePlayChapter(chapterId);
      setActiveStartSeconds(startSeconds);
      requestAnimationFrame(() => {
        const chapterElement = document.getElementById(`chapter-${chapterId}`);
        if (chapterElement) {
          const scrollContainer = chapterElement.closest("main");
          if (scrollContainer) {
            const containerRect = scrollContainer.getBoundingClientRect();
            const elementRect = chapterElement.getBoundingClientRect();
            const relativeTop = elementRect.top - containerRect.top + scrollContainer.scrollTop;
            const offset = 80;
            scrollContainer.scrollTo({ top: relativeTop - offset, behavior: "smooth" });
          } else {
            chapterElement.scrollIntoView({ behavior: "smooth", block: "start" });
          }
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
  }, [isDesktop]);

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
  }, []);

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

  // Build right sidebar content for layout-level rendering
  const rightSidebarContent = useMemo(() => {
    if (!summary) return null;
    return (
      <RightPanelStack
        chaptersContent={
          <StickyChapterNav
            chapters={summary.chapters ?? []}
            activeChapter={activeId}
            activePlayChapter={activePlayChapter}
            onScrollToChapter={scrollToChapter}
            onPlayFromChapter={handlePlayFromChapter}
            onStopChapter={handleStopChapter}
            conceptsByChapter={conceptMatchResult.byChapter}
          />
        }
        chatContent={
          <VideoChatPanel
            videoSummaryId={videoSummaryId}
            videoTitle={video.title}
            className="h-full"
          />
        }
      />
    );
  }, [
    summary, activeId, activePlayChapter, scrollToChapter,
    handlePlayFromChapter, handleStopChapter, conceptMatchResult.byChapter,
    videoSummaryId, video.title,
  ]);

  // Large desktop: cubes in Layout aside. Smaller screens: floating cubes rendered inline.
  useRightSidebar(rightSidebarContent, isLargeDesktop && !!summary);
  const showFloatingCubes = !isLargeDesktop && !!summary;

  return (
    <Layout>
      {!summary ? (
        // No summary yet - show loading state
        <>
          <Link to="/">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
          </Link>
          <div className="space-y-6">
            <VideoHeaderSection
              video={video}
              summary={null}
              isStreaming={isStreaming}
              onStopSummarization={onStopSummarization}
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
        </>
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
            />
          )}
        </VideoSummaryIdProvider>
      )}

      {/* Floating cube panel for smaller screens (<1280px) */}
      {showFloatingCubes && rightSidebarContent && (
        <div
          className="fixed bottom-4 right-3 z-50 transition-[width,height] duration-[800ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
          style={{
            width: activeRightPanel !== "none" ? 320 : 56,
            height: activeRightPanel !== "none" ? "70vh" : "auto",
          }}
        >
          {rightSidebarContent}
        </div>
      )}

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
