import { Fragment } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useIsLargeDesktop } from "@/hooks/use-media-query";
import { TldrHero } from "./TldrHero";
import { ArticleSection } from "./ArticleSection";
import { StickyChapterNav } from "./StickyChapterNav";
import { MobileChapterNav } from "./MobileChapterNav";
import { ChapterList } from "./ChapterList";
import { ResourcesPanel } from "./ResourcesPanel";
import { VideoHeaderSection } from "./VideoHeaderSection";
import type { VideoDetailCommonProps } from "./video-detail-types";

interface VideoDetailDesktopProps extends VideoDetailCommonProps {}

/**
 * Desktop layout for video detail page.
 * Features two-column layout with hero section and sticky sidebar on large screens.
 */
export function VideoDetailDesktop({
  video,
  summary,
  isStreaming,
  onStopSummarization,
  onOpenMasterSummary,
  effectiveChapters,
  effectiveIsCreatorChapters,
  effectiveDescriptionAnalysis,
  activePlayChapter,
  activeStartSeconds,
  handlePlayFromChapter,
  handleStopChapter,
  handleSeekToChapter,
  activeId,
  scrollToChapter,
  conceptMatchResult,
  playerRef,
}: VideoDetailDesktopProps) {
  const isLargeDesktop = useIsLargeDesktop();

  return (
    <div className={isLargeDesktop ? "flex gap-6" : "pb-24"}>
      {/* Main content column */}
      <div className="flex-1 min-w-0">
        {/* Hero section with background extending behind sidebar */}
        <div className={`relative -mx-4 md:-mx-6 -mt-4 md:-mt-6 px-4 md:px-6 pt-8 mb-6 ${isLargeDesktop ? "" : "pb-6"}`}>
          {/* Background image layer */}
          {(video.thumbnailUrl || video.youtubeId) && (
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{
                backgroundImage: `url(${video.thumbnailUrl || `https://img.youtube.com/vi/${video.youtubeId}/maxresdefault.jpg`})`,
                opacity: 0.6,
                right: isLargeDesktop ? "-264px" : "0",
              }}
            />
          )}
          {/* Gradient overlay */}
          <div
            className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent"
            style={{ right: isLargeDesktop ? "-264px" : "0" }}
          />

          {/* Content on top of background */}
          <div className="relative z-10">
            <Link to="/">
              <Button variant="ghost" className="mb-4">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
            </Link>

            <VideoHeaderSection
              video={video}
              summary={summary}
              isStreaming={isStreaming}
              onStopSummarization={onStopSummarization}
              onOpenMasterSummary={onOpenMasterSummary}
            />

            {/* TLDR with Key Takeaways */}
            <div className={isLargeDesktop ? "px-4 md:px-8 lg:px-16 xl:px-24 pb-10" : "pb-6"}>
              <TldrHero
                tldr={summary.tldr}
                keyTakeaways={summary.keyTakeaways}
                isStreaming={isStreaming}
              />
            </div>
          </div>
        </div>

        {/* Chapters */}
        <div className={`space-y-6 ${isLargeDesktop ? "pb-12 px-4 md:px-8 lg:px-16 xl:px-24" : "pb-12"}`}>
          {/* Show chapters while summary chapters are loading during streaming */}
          {isStreaming && effectiveChapters.length > 0 && summary.chapters.length === 0 && (
            <ChapterList
              chapters={effectiveChapters}
              isCreatorChapters={effectiveIsCreatorChapters}
              onSeek={handleSeekToChapter}
            />
          )}

          {/* Article chapters */}
          {summary.chapters.length > 0 && (
            <div>
              {summary.chapters.map((chapter, index) => (
                <Fragment key={chapter.id}>
                  {index > 0 && <Separator className="my-3 opacity-40" />}
                  <ArticleSection
                    chapter={chapter}
                    onPlay={handlePlayFromChapter}
                    onStop={handleStopChapter}
                    isVideoActive={activePlayChapter === chapter.id}
                    concepts={conceptMatchResult.byChapter.get(chapter.id) || []}
                    playerRef={playerRef}
                    youtubeId={video.youtubeId}
                    startSeconds={activePlayChapter === chapter.id ? activeStartSeconds : chapter.startSeconds}
                    persona={video.context?.category as 'code' | 'recipe' | 'interview' | 'review' | 'standard'}
                  />
                </Fragment>
              ))}
            </div>
          )}

          {/* Resources from description analysis */}
          {effectiveDescriptionAnalysis && (
            <ResourcesPanel analysis={effectiveDescriptionAnalysis} />
          )}
        </div>
      </div>

      {/* Right column: Sticky Chapter Nav - only on large desktop */}
      {isLargeDesktop && (
        <aside className="w-[240px] xl:w-[280px] shrink-0">
          <div className="sticky top-6">
            <StickyChapterNav
              chapters={summary.chapters}
              activeChapter={activeId}
              activePlayChapter={activePlayChapter}
              onScrollToChapter={scrollToChapter}
              onPlayFromChapter={handlePlayFromChapter}
              onStopChapter={handleStopChapter}
            />
          </div>
        </aside>
      )}

      {/* Bottom Navigation for smaller desktops (1024-1280px) */}
      {!isLargeDesktop && (
        <MobileChapterNav
          chapters={summary.chapters}
          activeChapter={activeId}
          onScrollToChapter={scrollToChapter}
        />
      )}
    </div>
  );
}
