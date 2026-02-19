import { Fragment, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, MessageCircle, Copy, Download, Check, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsLargeDesktop } from "@/hooks/use-media-query";
import { useMarkdownExport } from "@/hooks/use-markdown-export";
import { ArticleSection } from "./ArticleSection";
import { OrphanedConcepts } from "./OrphanedConcepts";
import { ChapterList } from "./ChapterList";
import { ResourcesPanel } from "./ResourcesPanel";
import { VideoHero } from "./VideoHero";
import { GoDeepDrawer } from "./GoDeepDrawer";
import { GlobalConceptScanner } from "./ConceptsContext";
import type { VideoDetailCommonProps } from "./video-detail-types";
import type { Concept } from "@vie/types";

const EMPTY_CONCEPTS: Concept[] = [];

interface VideoDetailDesktopProps extends VideoDetailCommonProps {
  /** Right panel tabs (sticky sidebar), rendered at full height. */
  rightPanel?: ReactNode;
}

/**
 * Desktop layout for video detail page.
 * Right panel fills the full viewport height (below AppHeader).
 * Hero card is centered inside the content column.
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
  conceptMatchResult,
  playerRef,
  isChatOpen,
  onToggleChat,
  onGoDeeper,
  expandedChapterId,
  rightPanel,
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

  const hasChapters = (summary.chapters ?? []).length > 0;
  const showChatButton = !isLargeDesktop;

  return (
    <div className="flex min-h-full">
      {/* Main content column */}
      <div className="flex-1 min-w-0 pb-24">
        {/* Hero card — centered with max width */}
        <div className="max-w-3xl mx-auto px-6 pt-6 pb-2">
          <VideoHero
            video={video}
            summary={summary}
            isStreaming={isStreaming}
            onStopSummarization={onStopSummarization}
            thumbnailUrl={thumbnailUrl}
            backButton={
              <Link to="/" className="shrink-0">
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
            }
            primaryAction={
              summary?.masterSummary ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onOpenMasterSummary}
                  className="gap-1.5 h-auto py-1 px-3 text-xs rounded-full"
                >
                  <FileText className="h-3 w-3" aria-hidden="true" />
                  Quick Read
                </Button>
              ) : undefined
            }
            actions={
              <div className="flex items-center gap-1">
                {hasChapters && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleCopyMarkdown}
                      className="h-7 w-7"
                      aria-label="Copy as Markdown"
                    >
                      {copiedState ? (
                        <Check className="h-3.5 w-3.5 text-green-500" aria-hidden="true" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleDownloadMarkdown}
                      className="h-7 w-7"
                      aria-label="Download as Markdown"
                    >
                      <Download className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                  </>
                )}
                {showChatButton && (
                  <Button
                    variant={isChatOpen ? "secondary" : "ghost"}
                    size="icon"
                    onClick={onToggleChat}
                    className="h-7 w-7"
                    aria-label="Toggle video chat"
                  >
                    <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                )}
              </div>
            }
          />
        </div>

        {/* Chapters */}
        <div className="space-y-6 pb-12 px-10 pt-4">
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
            <GlobalConceptScanner>
              {(summary.chapters ?? []).map((chapter) => (
                <Fragment key={chapter.id}>
                  <ArticleSection
                    chapter={chapter}
                    onPlay={handlePlayFromChapter}
                    onStop={handleStopChapter}
                    isVideoActive={activePlayChapter === chapter.id}
                    concepts={summary.concepts ?? EMPTY_CONCEPTS}
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
            </GlobalConceptScanner>
          )}

          {/* Orphaned concepts */}
          <OrphanedConcepts concepts={conceptMatchResult.orphaned} />

          {/* Resources from description analysis */}
          {effectiveDescriptionAnalysis && (
            <ResourcesPanel analysis={effectiveDescriptionAnalysis} />
          )}
        </div>
      </div>

      {/* Right panel — full height sticky sidebar, flush to top */}
      {rightPanel && (
        <div
          className="sticky top-0 self-start shrink-0 w-[360px]"
          style={{ height: "calc(100vh - var(--app-header-height))" }}
        >
          {rightPanel}
        </div>
      )}
    </div>
  );
}
