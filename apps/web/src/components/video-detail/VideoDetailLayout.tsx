import { useRef, useCallback, useMemo, useState, Fragment } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Clock, CheckCircle, StopCircle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Layout } from "@/components/layout/Layout";
import type { YouTubePlayerRef } from "@/components/videos/YouTubePlayer";
import { useActiveSection } from "@/hooks/use-active-section";
import { useIsDesktop } from "@/hooks/use-media-query";
import { matchConceptsToSections } from "@/lib/timestamp-utils";
import { TldrHero } from "./TldrHero";
import { ArticleSection } from "./ArticleSection";
import { StickyChapterNav } from "./StickyChapterNav";
import { MobileChapterNav } from "./MobileChapterNav";
import { ConceptsGrid } from "./ConceptsGrid";
import { ChapterList } from "./ChapterList";
import { ResourcesPanel } from "./ResourcesPanel";
import { VideoTags } from "./VideoTags";
import type { VideoResponse, VideoSummary } from "@vie/types";
import type { StreamState, Chapter, DescriptionAnalysis } from "@/hooks/use-summary-stream";

interface VideoDetailLayoutProps {
  video: VideoResponse;
  summary: VideoSummary | null;
  isStreaming?: boolean;
  streamingState?: StreamState;
  // Progressive summarization fields
  chapters?: Chapter[];
  isCreatorChapters?: boolean;
  descriptionAnalysis?: DescriptionAnalysis | null;
  // Stop summarization callback
  onStopSummarization?: () => void;
}

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
  // Use chapters from props or from streaming state
  const effectiveChapters = (chapters?.length ?? 0) > 0 ? chapters : streamingState?.chapters || [];
  const effectiveIsCreatorChapters = (chapters?.length ?? 0) > 0 ? isCreatorChapters : streamingState?.isCreatorChapters || false;
  const effectiveDescriptionAnalysis = descriptionAnalysis || streamingState?.descriptionAnalysis || null;
  const playerRef = useRef<YouTubePlayerRef>(null);
  const isDesktop = useIsDesktop();

  // Track which section has the video player collapsed under it, and the start time
  const [activePlaySection, setActivePlaySection] = useState<string | null>(null);
  const [activeStartSeconds, setActiveStartSeconds] = useState<number>(0);

  // Use a stable dependency based on section IDs to prevent unnecessary re-renders during streaming
  const sectionIdsString = summary?.sections.map((s) => s.id).join(",") ?? "";
  const sectionIds = useMemo(
    () => summary?.sections.map((s) => s.id) ?? [],
    // Issue #21: Using sectionIdsString (serialized IDs) instead of summary?.sections
    // to prevent re-renders during streaming while sections array reference changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sectionIdsString]
  );

  const { activeId, scrollToSection } = useActiveSection(sectionIds);

  // Match concepts to sections for the chapter nav
  const conceptMatchResult = useMemo(() => {
    if (!summary?.concepts || !summary?.sections) {
      return { bySection: new Map(), orphaned: [] };
    }
    return matchConceptsToSections(summary.concepts, summary.sections);
  }, [summary?.concepts, summary?.sections]);

  // Handle play from section - collapses video under the section on desktop
  const handlePlayFromSection = useCallback((sectionId: string, startSeconds: number) => {
    if (isDesktop) {
      // Desktop: collapse video under the section
      setActivePlaySection(sectionId);
      setActiveStartSeconds(startSeconds);

      // Scroll to section after delay to let React render the player
      // Using 150ms to ensure iframe is rendered before calculating scroll position
      setTimeout(() => {
        const sectionElement = document.getElementById(`section-${sectionId}`);
        if (sectionElement) {
          // Find the scrollable container (main element in Layout)
          const scrollContainer = sectionElement.closest("main");
          if (scrollContainer) {
            // Calculate position relative to scroll container
            const containerRect = scrollContainer.getBoundingClientRect();
            const elementRect = sectionElement.getBoundingClientRect();
            const relativeTop = elementRect.top - containerRect.top + scrollContainer.scrollTop;
            const offset = 80; // px from top of container
            scrollContainer.scrollTo({ top: relativeTop - offset, behavior: "smooth" });
          } else {
            // Fallback to window scroll
            sectionElement.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        }
      }, 150);
      // Player auto-starts via startSeconds + autoplay props
    } else {
      // Mobile: scroll to header video and play
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

  // Handle stop - collapses the video back
  const handleStopSection = useCallback(() => {
    setActivePlaySection(null);
  }, []);

  // Simple adapter for ChapterList that just seeks (used before sections are ready)
  const handleSeekToChapter = useCallback((startSeconds: number) => {
    // Scroll to video container
    const videoElement = document.getElementById("video-header") || document.getElementById("video-player");
    if (videoElement) {
      videoElement.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    setTimeout(() => {
      playerRef.current?.seekTo(startSeconds);
      playerRef.current?.playVideo();
    }, 300);
  }, []);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // YouTube video URL
  const youtubeUrl = video.youtubeId
    ? `https://youtube.com/watch?v=${video.youtubeId}`
    : null;

  // Shared content sections - article-style layout with horizontal dividers
  // Pass stable callbacks to allow ArticleSection memoization to work
  const renderSections = () => (
    <>
      {summary && summary.sections.length > 0 && (
        <div>
          {summary.sections.map((section, index) => (
            <Fragment key={section.id}>
              {index > 0 && <Separator className="my-3 opacity-40" />}
              <ArticleSection
                section={section}
                onPlay={handlePlayFromSection}
                onStop={handleStopSection}
                isVideoActive={activePlaySection === section.id}
                concepts={conceptMatchResult.bySection.get(section.id) || []}
                playerRef={playerRef}
                youtubeId={video.youtubeId}
                startSeconds={activePlaySection === section.id ? activeStartSeconds : section.startSeconds}
                persona={video.context?.persona}
              />
            </Fragment>
          ))}
        </div>
      )}
    </>
  );

  // Shared header component (no video player - video only shows when playing a section)
  const renderHeader = () => (
    <header id="video-header" className="mb-6">
      {/* Title and metadata */}
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

  return (
    <Layout>
      {!summary ? (
        // No summary yet - show loading state
        <>
          {/* Back button */}
          <Link to="/">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
          </Link>
          <div className="space-y-6">
            {renderHeader()}

            {/* Show chapters immediately even before summary is ready */}
            {effectiveChapters.length > 0 && (
              <ChapterList
                chapters={effectiveChapters}
                isCreatorChapters={effectiveIsCreatorChapters}
                onSeek={handleSeekToChapter}
              />
            )}

            {/* Show description analysis if available */}
            {effectiveDescriptionAnalysis && (
              <ResourcesPanel analysis={effectiveDescriptionAnalysis} />
            )}

            {/* Placeholder when nothing is available yet */}
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
        /* Desktop Layout: Two-column with sticky sidebar */
        <div className="flex gap-6">
          {/* Left column: Hero + Sections */}
          <div className="flex-1 min-w-0">
            {/* Hero section with background extending behind sidebar */}
            <div className="relative -mx-6 -mt-6 px-6 pt-8 mb-6">
              {/* Background image layer - extends to cover sidebar area */}
              {(video.thumbnailUrl || video.youtubeId) && (
                <div
                  className="absolute inset-0 bg-cover bg-center"
                  style={{
                    backgroundImage: `url(${video.thumbnailUrl || `https://img.youtube.com/vi/${video.youtubeId}/maxresdefault.jpg`})`,
                    opacity: 0.6,
                    right: "-304px", // Extend to cover sidebar (280px + 24px gap)
                  }}
                />
              )}
              {/* Gradient overlay - also extends to cover sidebar */}
              <div
                className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent"
                style={{ right: "-304px" }}
              />

              {/* Content on top of background */}
              <div className="relative z-10">
                {/* Back button */}
                <Link to="/">
                  <Button variant="ghost" className="mb-4">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back
                  </Button>
                </Link>

                {renderHeader()}

                {/* TLDR with Key Takeaways */}
                <div className="px-25 pb-10">
                  <TldrHero
                    tldr={summary.tldr}
                    keyTakeaways={summary.keyTakeaways}
                    isStreaming={isStreaming}
                  />
                </div>
              </div>
            </div>

            {/* Sections */}
            <div className="space-y-6 pb-12 px-25">
              {/* Show chapters while sections are loading during streaming */}
              {isStreaming && effectiveChapters.length > 0 && summary.sections.length === 0 && (
                <ChapterList
                  chapters={effectiveChapters}
                  isCreatorChapters={effectiveIsCreatorChapters}
                  onSeek={handleSeekToChapter}
                />
              )}

              {renderSections()}

              {/* Resources from description analysis */}
              {effectiveDescriptionAnalysis && (
                <ResourcesPanel analysis={effectiveDescriptionAnalysis} />
              )}
            </div>
          </div>

          {/* Right column: Sticky Chapter Nav - outside hero so it stays sticky */}
          <aside className="w-[280px] shrink-0">
            <div className="sticky top-6">
              <StickyChapterNav
                sections={summary.sections}
                activeSection={activeId}
                activePlaySection={activePlaySection}
                onScrollToSection={scrollToSection}
                onPlayFromSection={handlePlayFromSection}
                onStopSection={handleStopSection}
              />
            </div>
          </aside>
        </div>
      ) : (
        /* Mobile Layout: Single Column + Bottom Navigation */
        <div className="pb-24">
          {/* Back button */}
          <Link to="/">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
          </Link>
          {renderHeader()}

          {/* TLDR with Key Takeaways */}
          <TldrHero
            tldr={summary.tldr}
            keyTakeaways={summary.keyTakeaways}
            isStreaming={isStreaming}
          />

          <div className="space-y-6 mt-6">
            {/* Show chapters while sections are loading during streaming */}
            {isStreaming && effectiveChapters.length > 0 && summary.sections.length === 0 && (
              <ChapterList
                chapters={effectiveChapters}
                isCreatorChapters={effectiveIsCreatorChapters}
                onSeek={handleSeekToChapter}
              />
            )}

            {renderSections()}

            {/* Resources from description analysis */}
            {effectiveDescriptionAnalysis && (
              <ResourcesPanel analysis={effectiveDescriptionAnalysis} />
            )}

            {/* All concepts on mobile (no sidebar) */}
            <ConceptsGrid concepts={summary.concepts} />
          </div>

          {/* Mobile Bottom Navigation */}
          <MobileChapterNav
            sections={summary.sections}
            activeSection={activeId}
            onScrollToSection={scrollToSection}
          />
        </div>
      )}
    </Layout>
  );
}
