import { useRef, useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Layout } from "@/components/layout/Layout";
import type { YouTubePlayerRef } from "@/components/videos/YouTubePlayer";
import { useActiveSection } from "@/hooks/use-active-section";
import { useIsDesktop } from "@/hooks/use-media-query";
import { matchConceptsToSections } from "@/lib/timestamp-utils";
import { ChapterList } from "./ChapterList";
import { ResourcesPanel } from "./ResourcesPanel";
import { MasterSummaryModal } from "./MasterSummaryModal";
import { VideoHeaderSection } from "./VideoHeaderSection";
import { VideoDetailDesktop } from "./VideoDetailDesktop";
import { VideoDetailMobile } from "./VideoDetailMobile";
import type { VideoResponse, VideoSummary, StreamingChapter } from "@vie/types";
import type { StreamState, Chapter, DescriptionAnalysis } from "@/hooks/use-summary-stream";

interface VideoDetailLayoutProps {
  video: VideoResponse;
  summary: VideoSummary | null;
  isStreaming?: boolean;
  streamingState?: StreamState;
  chapters?: Chapter[] | StreamingChapter[];
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

  // Section play state
  const [activePlaySection, setActivePlaySection] = useState<string | null>(null);
  const [activeStartSeconds, setActiveStartSeconds] = useState<number>(0);

  // Master summary modal state
  const [showMasterSummary, setShowMasterSummary] = useState(false);

  // Stable dependency for section tracking
  const sectionIdsString = (summary?.sections ?? []).map((s) => s.id).join(",") ?? "";
  const sectionIds = useMemo(
    () => (summary?.sections ?? []).map((s) => s.id) ?? [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sectionIdsString]
  );

  const { activeId, scrollToSection } = useActiveSection(sectionIds);

  // Match concepts to sections
  const conceptMatchResult = useMemo(() => {
    if (!summary?.concepts || !summary?.sections) {
      return { bySection: new Map(), orphaned: [] };
    }
    return matchConceptsToSections(summary.concepts, (summary.sections ?? []));
  }, [summary?.concepts, summary?.sections]);

  // Handle play from section - collapses video under the section on desktop
  const handlePlayFromSection = useCallback((sectionId: string, startSeconds: number) => {
    if (isDesktop) {
      setActivePlaySection(sectionId);
      setActiveStartSeconds(startSeconds);
      setTimeout(() => {
        const sectionElement = document.getElementById(`section-${sectionId}`);
        if (sectionElement) {
          const scrollContainer = sectionElement.closest("main");
          if (scrollContainer) {
            const containerRect = scrollContainer.getBoundingClientRect();
            const elementRect = sectionElement.getBoundingClientRect();
            const relativeTop = elementRect.top - containerRect.top + scrollContainer.scrollTop;
            const offset = 80;
            scrollContainer.scrollTo({ top: relativeTop - offset, behavior: "smooth" });
          } else {
            sectionElement.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        }
      }, 150);
    } else {
      const videoElement = document.getElementById("video-header") || document.getElementById("video-player");
      if (videoElement) {
        videoElement.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      setTimeout(() => {
        playerRef.current?.seekTo(startSeconds);
        playerRef.current?.playVideo();
      }, 300);
    }
  }, [isDesktop]);

  const handleStopSection = useCallback(() => {
    setActivePlaySection(null);
  }, []);

  const handleSeekToChapter = useCallback((startSeconds: number) => {
    const videoElement = document.getElementById("video-header") || document.getElementById("video-player");
    if (videoElement) {
      videoElement.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    setTimeout(() => {
      playerRef.current?.seekTo(startSeconds);
      playerRef.current?.playVideo();
    }, 300);
  }, []);

  const handleOpenMasterSummary = useCallback(() => {
    setShowMasterSummary(true);
  }, []);

  // Shared props for Desktop/Mobile layouts
  // Note: summary! is safe here because commonProps is only used in branches
  // where summary is truthy (lines 190-193 guard with `!summary ? ... : ...`)
  const commonProps = {
    video,
    summary: summary!,
    isStreaming,
    onStopSummarization,
    onOpenMasterSummary: handleOpenMasterSummary,
    effectiveChapters,
    effectiveIsCreatorChapters,
    effectiveDescriptionAnalysis,
    activePlaySection,
    activeStartSeconds,
    handlePlayFromSection,
    handleStopSection,
    handleSeekToChapter,
    activeId,
    scrollToSection,
    conceptMatchResult,
    playerRef,
  };

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
              onOpenMasterSummary={handleOpenMasterSummary}
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
      ) : isDesktop ? (
        <VideoDetailDesktop {...commonProps} />
      ) : (
        <VideoDetailMobile {...commonProps} />
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
