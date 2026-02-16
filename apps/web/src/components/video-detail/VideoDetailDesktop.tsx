import { Fragment } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, MessageCircle, Copy, Download, Check, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsLargeDesktop } from "@/hooks/use-media-query";
import { useMarkdownExport } from "@/hooks/use-markdown-export";
import { TldrHero } from "./TldrHero";
import { ArticleSection } from "./ArticleSection";
import { OrphanedConcepts } from "./OrphanedConcepts";
import { MobileChapterNav } from "./MobileChapterNav";
import { ChapterList } from "./ChapterList";
import { ResourcesPanel } from "./ResourcesPanel";
import { VideoHeaderSection } from "./VideoHeaderSection";
import { GoDeepDrawer } from "./GoDeepDrawer";
import type { VideoDetailCommonProps } from "./video-detail-types";
import type { Concept } from "@vie/types";

const EMPTY_CONCEPTS: Concept[] = [];

interface VideoDetailDesktopProps extends VideoDetailCommonProps {}

/**
 * Desktop layout for video detail page.
 * Right sidebar (chapters + chat) is now rendered at the Layout level.
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
  isChatOpen,
  onToggleChat,
  onGoDeeper,
  expandedChapterId,
}: VideoDetailDesktopProps) {
  const isLargeDesktop = useIsLargeDesktop();
  const { copiedState, handleCopyMarkdown, handleDownloadMarkdown } =
    useMarkdownExport(video.title, summary.chapters);

  const videoSummaryId = video.videoSummaryId ?? "";

  return (
    <div className="pb-24">
      {/* Main content */}
      <div className="min-w-0">
        {/* Hero section */}
        <div className="relative -mx-4 md:-mx-6 -mt-4 md:-mt-6 px-4 md:px-6 pt-4 mb-3">
          {/* Background image layer */}
          {(video.thumbnailUrl || video.youtubeId) && (() => {
            const url = video.thumbnailUrl?.startsWith("https://")
              ? video.thumbnailUrl
              : video.youtubeId
                ? `https://img.youtube.com/vi/${encodeURIComponent(video.youtubeId)}/maxresdefault.jpg`
                : null;
            return url ? (
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: `url(${url})`, opacity: 0.6 }}
              />
            ) : null;
          })()}
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />

          {/* Content on top of background */}
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <Link to="/">
                <Button variant="ghost">
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </Button>
              </Link>

              {/* Action buttons */}
              <div className="flex items-center gap-2">
                {/* Quick Read — near the copy/export actions */}
                {summary?.masterSummary && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onOpenMasterSummary}
                    className="gap-1.5 text-xs"
                  >
                    <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                    Quick Read
                  </Button>
                )}
                {(summary.chapters ?? []).length > 0 && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCopyMarkdown}
                      className="gap-1.5 text-xs"
                      aria-label="Copy as Markdown"
                    >
                      {copiedState ? (
                        <Check className="h-3.5 w-3.5 text-green-500" aria-hidden="true" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      {copiedState ? "Copied" : "Copy"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleDownloadMarkdown}
                      className="gap-1.5 text-xs"
                      aria-label="Download as Markdown"
                    >
                      <Download className="h-3.5 w-3.5" aria-hidden="true" />
                      Export
                    </Button>
                  </>
                )}
                {/* Chat toggle only shown on non-large-desktop */}
                {!isLargeDesktop && (
                  <Button
                    variant={isChatOpen ? "secondary" : "ghost"}
                    size="sm"
                    onClick={onToggleChat}
                    className="gap-1.5 text-xs"
                    aria-label="Toggle video chat"
                  >
                    <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
                    Chat
                  </Button>
                )}
              </div>
            </div>

            <VideoHeaderSection
              video={video}
              summary={summary}
              isStreaming={isStreaming}
              onStopSummarization={onStopSummarization}
            />

            {/* TLDR with Key Takeaways */}
            <div className={isLargeDesktop ? "px-4 md:px-8 lg:px-16 xl:px-24 pb-4" : "pb-6"}>
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
          {/* Show chapters while sections are loading during streaming */}
          {isStreaming && effectiveChapters.length > 0 && (summary.chapters ?? []).length === 0 && (
            <ChapterList
              chapters={effectiveChapters}
              isCreatorChapters={effectiveIsCreatorChapters}
              onSeek={handleSeekToChapter}
            />
          )}

          {/* Article chapters */}
          {(summary.chapters ?? []).length > 0 && (
            <div>
              {(summary.chapters ?? []).map((chapter) => (
                <Fragment key={chapter.id}>
                  <ArticleSection
                    chapter={chapter}
                    onPlay={handlePlayFromChapter}
                    onStop={handleStopChapter}
                    isVideoActive={activePlayChapter === chapter.id}
                    concepts={conceptMatchResult.byChapter.get(chapter.id) ?? EMPTY_CONCEPTS}
                    playerRef={playerRef}
                    youtubeId={video.youtubeId}
                    startSeconds={activePlayChapter === chapter.id ? activeStartSeconds : chapter.startSeconds}
                    category={video.context?.category}
                    onGoDeeper={() => onGoDeeper(chapter.id)}
                    isGoDeepExpanded={expandedChapterId === chapter.id}
                  />
                  {/* Go Deeper expanded drawer */}
                  {expandedChapterId === chapter.id && videoSummaryId && (
                    <GoDeepDrawer
                      videoSummaryId={videoSummaryId}
                      chapterId={chapter.id}
                    />
                  )}
                </Fragment>
              ))}
            </div>
          )}

          {/* Orphaned concepts */}
          <OrphanedConcepts concepts={conceptMatchResult.orphaned} />

          {/* Resources from description analysis */}
          {effectiveDescriptionAnalysis && (
            <ResourcesPanel analysis={effectiveDescriptionAnalysis} />
          )}
        </div>
      </div>

      {/* Bottom Navigation for smaller desktops (1024-1280px) */}
      {!isLargeDesktop && (
        <MobileChapterNav
          chapters={(summary.chapters ?? [])}
          activeChapter={activeId}
          onScrollToChapter={scrollToChapter}
        />
      )}
    </div>
  );
}
