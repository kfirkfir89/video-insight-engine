import { Fragment, useRef, useEffect, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, MessageCircle, Copy, Download, Check, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { findScrollParent } from "@/lib/dom-utils";
import { useIsLargeDesktop } from "@/hooks/use-media-query";
import { useMarkdownExport } from "@/hooks/use-markdown-export";
import { TldrHero } from "./TldrHero";
import { ArticleSection } from "./ArticleSection";
import { OrphanedConcepts } from "./OrphanedConcepts";
import { ChapterList } from "./ChapterList";
import { ResourcesPanel } from "./ResourcesPanel";
import { VideoHeaderSection } from "./VideoHeaderSection";
import { GoDeepDrawer } from "./GoDeepDrawer";
import { GlobalConceptScanner } from "./ConceptsContext";
import type { VideoDetailCommonProps } from "./video-detail-types";
import type { Concept } from "@vie/types";

const EMPTY_CONCEPTS: Concept[] = [];

interface VideoDetailDesktopProps extends VideoDetailCommonProps {
  /** Right panel tabs (sticky sidebar), rendered below the hero section. */
  rightPanel?: ReactNode;
}

/**
 * Desktop layout for video detail page.
 * Right panel is rendered as a sticky sidebar next to chapters, below the hero.
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

  // Dynamic panel height via CSS custom property.
  // Updates --panel-offset on scroll so the panel fills from below the header to the viewport bottom.
  const headerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const header = headerRef.current;
    const panel = panelRef.current;
    if (!header || !panel) return;
    const scrollContainer = findScrollParent(panel);
    if (!scrollContainer) return;

    const updateOffset = () => {
      const containerTop = scrollContainer.getBoundingClientRect().top;
      const headerBottom = header.getBoundingClientRect().bottom;
      const visibleOffset = Math.max(0, headerBottom - containerTop);
      panel.style.setProperty("--panel-offset", `${visibleOffset}px`);
    };

    const onScroll = () => {
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        updateOffset();
      });
    };

    scrollContainer.addEventListener("scroll", onScroll, { passive: true });
    updateOffset();

    return () => {
      scrollContainer.removeEventListener("scroll", onScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [!!rightPanel]);

  return (
    <div className="pb-24">
      {/* Header bar — full width above content */}
      <div ref={headerRef} className="pb-2 bg-primary/[0.12] border-b border-primary/[0.10]">
        <div className="relative py-3 px-4 md:px-6">
          <VideoHeaderSection
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

      {/* Below header: flex row with content + sticky right panel */}
      <div className="flex">
        {/* Main content column */}
        <div className="flex-1 min-w-0">
          {/* TLDR Section */}
          <div className="relative mb-3 bg-primary/[0.04]">
            <div className="py-6 px-6">
              <TldrHero
                tldr={summary.tldr}
                keyTakeaways={summary.keyTakeaways}
                isStreaming={isStreaming}
              />
            </div>
            {/* Bottom edge gradient for smooth transition */}
            <div className="h-8 bg-gradient-to-b from-transparent to-background" />
          </div>

          {/* Chapters */}
          <div className="space-y-6 pb-12 px-10">
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

        {/* Right panel — sticky sidebar below header, dynamic height */}
        {rightPanel && (
          <div
            ref={panelRef}
            className="sticky top-0 self-start shrink-0 w-[360px]"
            style={{ height: "calc(100vh - var(--panel-offset, 0px))" }}
          >
            {rightPanel}
          </div>
        )}
      </div>
    </div>
  );
}
