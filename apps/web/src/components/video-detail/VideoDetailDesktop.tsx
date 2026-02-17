import { Fragment } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, MessageCircle, Copy, Download, Check, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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

interface VideoDetailDesktopProps extends VideoDetailCommonProps { }

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

  const thumbnailUrl = video.thumbnailUrl?.startsWith("https://")
    ? video.thumbnailUrl
    : video.youtubeId
      ? `https://img.youtube.com/vi/${encodeURIComponent(video.youtubeId)}/maxresdefault.jpg`
      : null;

  return (
    <div className="pb-24">
      {/* Main content */}
      <div className="min-w-0">
        {/* Hero section — two-zone layout */}
        <div className="relative -mx-4 md:-mx-6 -mt-4 md:-mt-6 mb-3">

          {/* Zone 1: Header Bar */}
          <div className="relative z-10 bg-primary/[0.12] border-b border-primary/[0.10]">
            <div className={cn(
              "relative py-3",
              isLargeDesktop ? "px-4 md:px-8 lg:px-16 xl:px-24" : "px-4 md:px-6"
            )}>
              <div>
                <VideoHeaderSection
                  video={video}
                  summary={summary}
                  isStreaming={isStreaming}
                  onStopSummarization={onStopSummarization}
                  backButton={
                    <Link to="/" className="shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <ArrowLeft className="h-4 w-4" />
                      </Button>
                    </Link>
                  }
                  actions={
                    <>
                      {summary?.masterSummary && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={onOpenMasterSummary}
                          className="gap-1.5 h-auto py-1 px-3 text-xs rounded-full border-primary/40 bg-primary/[0.12] text-primary hover:bg-primary/[0.20] font-semibold"
                        >
                          <FileText className="h-3 w-3" aria-hidden="true" />
                          Quick Read
                        </Button>
                      )}
                      {(summary.chapters ?? []).length > 0 && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleCopyMarkdown}
                            className="gap-1.5 h-auto py-1 px-3 text-xs rounded-full border-primary/40 bg-primary/[0.12] text-primary hover:bg-primary/[0.20] font-semibold"
                            aria-label="Copy as Markdown"
                          >
                            {copiedState ? (
                              <Check className="h-3 w-3 text-green-500" aria-hidden="true" />
                            ) : (
                              <Copy className="h-3 w-3" aria-hidden="true" />
                            )}
                            {copiedState ? "Copied" : "Copy"}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleDownloadMarkdown}
                            className="gap-1.5 h-auto py-1 px-3 text-xs rounded-full border-primary/40 bg-primary/[0.12] text-primary hover:bg-primary/[0.20] font-semibold"
                            aria-label="Download as Markdown"
                          >
                            <Download className="h-3 w-3" aria-hidden="true" />
                            Export
                          </Button>
                        </>
                      )}
                      {!isLargeDesktop && (
                        <Button
                          variant={isChatOpen ? "secondary" : "outline"}
                          size="sm"
                          onClick={onToggleChat}
                          className={cn(
                            "gap-1.5 h-auto py-1 px-3 text-xs rounded-full font-semibold",
                            !isChatOpen && "border-primary/40 bg-primary/[0.12] text-primary hover:bg-primary/[0.20]"
                          )}
                          aria-label="Toggle video chat"
                        >
                          <MessageCircle className="h-3 w-3" aria-hidden="true" />
                          Chat
                        </Button>
                      )}
                    </>
                  }
                />
              </div>
            </div>
          </div>

          {/* Zone 2: TLDR Section */}
          <div className="relative z-10 px-60 bg-primary/[0.04]">
            <div className={cn(
              isLargeDesktop ? "py-8 px-4 md:px-8 lg:px-16 xl:px-24" : "py-6 px-4 md:px-6"
            )}>
              <TldrHero
                tldr={summary.tldr}
                keyTakeaways={summary.keyTakeaways}
                isStreaming={isStreaming}
                thumbnailUrl={thumbnailUrl}
              />
            </div>
            {/* Bottom edge gradient for smooth transition */}
            <div className="h-8 bg-gradient-to-b from-transparent to-background" />
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
