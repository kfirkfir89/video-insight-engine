import { Fragment } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, MessageCircle, Copy, Download, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMarkdownExport } from "@/hooks/use-markdown-export";
import { ArticleSection } from "./ArticleSection";
import { OrphanedConcepts } from "./OrphanedConcepts";
import { ChapterList } from "./ChapterList";
import { ResourcesPanel } from "./ResourcesPanel";
import { ConceptsGrid } from "./ConceptsGrid";
import { VideoHero } from "./VideoHero";
import { VideoChatPanel } from "./VideoChatPanel";
import { GoDeepDrawer } from "./GoDeepDrawer";
import { GlobalConceptScanner } from "./ConceptsContext";
import type { VideoDetailCommonProps } from "./video-detail-types";
import type { Concept } from "@vie/types";

const EMPTY_CONCEPTS: Concept[] = [];

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
}: VideoDetailMobileProps) {
  const { copiedState, handleCopyMarkdown, handleDownloadMarkdown } =
    useMarkdownExport(video.title, summary.chapters);
  const videoSummaryId = video.videoSummaryId ?? "";

  return (
    <div className="pb-24">
      {/* Chat drawer (slides in on mobile) */}
      {isChatOpen && (
        <div className="fixed inset-0 z-50 bg-background flex flex-col">
          <div className="flex items-center justify-between px-4 py-2 border-b">
            <span className="text-sm font-medium">Video Chat</span>
            <Button variant="ghost" size="icon" onClick={onToggleChat} className="h-8 w-8">
              <X className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">Close chat</span>
            </Button>
          </div>
          <VideoChatPanel
            videoSummaryId={videoSummaryId}
            videoTitle={video.title}
            className="flex-1"
          />
        </div>
      )}

      {/* Hero card */}
      <div className="px-3 pt-3">
        <VideoHero
          video={video}
          summary={summary}
          isStreaming={isStreaming}
          onStopSummarization={onStopSummarization}
          backButton={
            <Link to="/">
              <Button variant="ghost" size="sm" className="gap-1">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            </Link>
          }
          actions={
            <div className="flex items-center gap-1">
              {(summary.chapters ?? []).length > 0 && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleCopyMarkdown}
                    className="h-8 w-8"
                    aria-label="Copy as Markdown"
                  >
                    {copiedState ? (
                      <Check className="h-4 w-4 text-green-500" aria-hidden="true" />
                    ) : (
                      <Copy className="h-4 w-4" aria-hidden="true" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleDownloadMarkdown}
                    className="h-8 w-8"
                    aria-label="Download as Markdown"
                  >
                    <Download className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </>
              )}
              <Button
                variant={isChatOpen ? "secondary" : "ghost"}
                size="icon"
                onClick={onToggleChat}
                className="h-8 w-8"
                aria-label="Toggle video chat"
              >
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          }
        />
      </div>

      <div className="space-y-6 mt-4">
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

        {/* Orphaned concepts — not matched to any chapter */}
        <OrphanedConcepts concepts={conceptMatchResult.orphaned} />

        {/* Resources from description analysis */}
        {effectiveDescriptionAnalysis && (
          <ResourcesPanel analysis={effectiveDescriptionAnalysis} />
        )}

        {/* All concepts on mobile (no sidebar) */}
        <ConceptsGrid concepts={summary.concepts} />
      </div>
    </div>
  );
}
