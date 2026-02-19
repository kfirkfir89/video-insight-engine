import { Fragment, type ReactNode } from "react";
import { MessageCircle, Copy, Download, Check, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useIsLargeDesktop } from "@/hooks/use-media-query";
import { useIsRightPanelMinimized } from "@/stores/ui-store";
import { RIGHT_PANEL_MINIMIZED_WIDTH } from "@/lib/layout-constants";
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
  streamingPhaseLabel,
}: VideoDetailDesktopProps) {
  const isLargeDesktop = useIsLargeDesktop();
  const isRightPanelMinimized = useIsRightPanelMinimized();
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
            streamingPhaseLabel={streamingPhaseLabel}
            primaryAction={
              summary?.masterSummary ? (
                <Button
                  variant="default"
                  size="sm"
                  onClick={onOpenMasterSummary}
                  className="gap-1.5 h-auto py-1 px-3 text-xs rounded-full font-semibold"
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
                      size="sm"
                      onClick={handleCopyMarkdown}
                      className="gap-1.5 h-7 py-0 px-2 text-xs"
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
                      className="gap-1.5 h-7 py-0 px-2 text-xs"
                      aria-label="Download as Markdown"
                    >
                      <Download className="h-3.5 w-3.5" aria-hidden="true" />
                      Export
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
        <div className={cn(
          "mx-auto space-y-6 pb-12 px-10 pt-4 transition-[max-width] duration-200",
          isRightPanelMinimized ? "max-w-[960px]" : "max-w-[820px]"
        )}>
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
              {(summary.chapters ?? []).map((chapter, chapterIdx) => (
                <Fragment key={chapter.id}>
                  {chapterIdx > 0 && <div className="chapter-divider my-8" aria-hidden="true" />}
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
          className={cn(
            "sticky top-0 self-start shrink-0 transition-[width] duration-200",
            isRightPanelMinimized ? RIGHT_PANEL_MINIMIZED_WIDTH : "w-[360px]"
          )}
          style={{ height: "calc(100vh - var(--app-header-height))" }}
        >
          {rightPanel}
        </div>
      )}
    </div>
  );
}
