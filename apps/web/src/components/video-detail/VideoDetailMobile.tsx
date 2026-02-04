import { Fragment } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { TldrHero } from "./TldrHero";
import { ArticleSection } from "./ArticleSection";
import { MobileChapterNav } from "./MobileChapterNav";
import { ChapterList } from "./ChapterList";
import { ResourcesPanel } from "./ResourcesPanel";
import { ConceptsGrid } from "./ConceptsGrid";
import { VideoHeaderSection } from "./VideoHeaderSection";
import type { VideoDetailCommonProps } from "./video-detail-types";

interface VideoDetailMobileProps extends VideoDetailCommonProps {}

/**
 * Mobile layout for video detail page.
 * Features single column layout with bottom navigation.
 */
export function VideoDetailMobile({
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
}: VideoDetailMobileProps) {
  return (
    <div className="pb-24">
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
      <TldrHero
        tldr={summary.tldr}
        keyTakeaways={summary.keyTakeaways}
        isStreaming={isStreaming}
      />

      <div className="space-y-6 mt-6">
        {/* Show chapters while sections are loading during streaming */}
        {isStreaming && effectiveChapters.length > 0 && (summary.sections ?? []).length === 0 && (
          <ChapterList
            chapters={effectiveChapters}
            isCreatorChapters={effectiveIsCreatorChapters}
            onSeek={handleSeekToChapter}
          />
        )}

        {/* Article sections */}
        {(summary.sections ?? []).length > 0 && (
          <div>
            {(summary.sections ?? []).map((section, index) => (
              <Fragment key={section.id}>
                {index > 0 && <Separator className="my-3 opacity-40" />}
                <ArticleSection
                  chapter={chapter}
                  onPlay={handlePlayFromChapter}
                  onStop={handleStopChapter}
                  isVideoActive={activePlayChapter === chapter.id}
                  concepts={conceptMatchResult.byChapter.get(chapter.id) || []}
                  playerRef={playerRef}
                  youtubeId={video.youtubeId}
                  startSeconds={activePlaySection === section.id ? activeStartSeconds : section.startSeconds}
                  category={video.context?.category}
                />
              </Fragment>
            ))}
          </div>
        )}

        {/* Resources from description analysis */}
        {effectiveDescriptionAnalysis && (
          <ResourcesPanel analysis={effectiveDescriptionAnalysis} />
        )}

        {/* All concepts on mobile (no sidebar) */}
        <ConceptsGrid concepts={summary.concepts} />
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileChapterNav
        sections={(summary.sections ?? [])}
        activeSection={activeId}
        onScrollToSection={scrollToSection}
      />
    </div>
  );
}
