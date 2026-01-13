import { useRef, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Clock, CheckCircle, ChevronDown, Play, StopCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Layout } from "@/components/layout/Layout";
import { YouTubePlayer, type YouTubePlayerRef } from "@/components/videos/YouTubePlayer";
import { useActiveSection } from "@/hooks/use-active-section";
import { useIsDesktop } from "@/hooks/use-media-query";
import { TldrHero } from "./TldrHero";
import { KeyTakeawaysList } from "./KeyTakeawaysList";
import { SectionCard } from "./SectionCard";
import { StickyChapterNav } from "./StickyChapterNav";
import { MobileChapterNav } from "./MobileChapterNav";
import { ConceptsGrid } from "./ConceptsGrid";
import { ChapterList } from "./ChapterList";
import { ResourcesPanel } from "./ResourcesPanel";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
  const effectiveChapters = chapters.length > 0 ? chapters : streamingState?.chapters || [];
  const effectiveIsCreatorChapters = chapters.length > 0 ? isCreatorChapters : streamingState?.isCreatorChapters || false;
  const effectiveDescriptionAnalysis = descriptionAnalysis || streamingState?.descriptionAnalysis || null;
  const playerRef = useRef<YouTubePlayerRef>(null);
  const isDesktop = useIsDesktop();

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

  const handlePlayFromSection = useCallback((startSeconds: number) => {
    playerRef.current?.seekTo(startSeconds);
    playerRef.current?.playVideo();
  }, []);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Shared content sections
  const renderSections = () => (
    <>
      {summary && summary.sections.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Sections</h2>
          {summary.sections.map((section) => (
            <SectionCard
              key={section.id}
              section={section}
              onPlay={() => handlePlayFromSection(section.startSeconds)}
            />
          ))}
        </div>
      )}
    </>
  );

  return (
    <Layout>
      {/* Back button */}
      <Link to="/">
        <Button variant="ghost" className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
      </Link>

      {/* Video Title Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">{video.title}</h1>
        {video.channel && (
          <p className="text-muted-foreground mb-2">{video.channel}</p>
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

      {!summary ? (
        <div className="space-y-6">
          {/* Show chapters immediately even before summary is ready */}
          {effectiveChapters.length > 0 && (
            <ChapterList
              chapters={effectiveChapters}
              isCreatorChapters={effectiveIsCreatorChapters}
              onSeek={handlePlayFromSection}
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
      ) : isDesktop ? (
        /* Desktop Layout: Two-Column with Sticky Sidebar */
        <div className="flex gap-8">
          {/* Sticky Sidebar */}
          <StickyChapterNav
            ref={playerRef}
            youtubeId={video.youtubeId}
            sections={summary.sections}
            activeSection={activeId}
            onScrollToSection={scrollToSection}
            onPlayFromSection={handlePlayFromSection}
          />

          {/* Main Content */}
          <main className="flex-1 max-w-3xl space-y-6 pb-12">
            <TldrHero tldr={summary.tldr} isStreaming={isStreaming} />
            <KeyTakeawaysList takeaways={summary.keyTakeaways} />

            {/* Show chapters while sections are loading during streaming */}
            {isStreaming && effectiveChapters.length > 0 && summary.sections.length === 0 && (
              <ChapterList
                chapters={effectiveChapters}
                isCreatorChapters={effectiveIsCreatorChapters}
                onSeek={handlePlayFromSection}
              />
            )}

            {renderSections()}

            {/* Resources from description analysis */}
            {effectiveDescriptionAnalysis && (
              <ResourcesPanel analysis={effectiveDescriptionAnalysis} />
            )}

            <ConceptsGrid concepts={summary.concepts} />
          </main>
        </div>
      ) : (
        /* Mobile Layout: Single Column + Bottom Navigation */
        <div className="pb-24">
          <TldrHero tldr={summary.tldr} isStreaming={isStreaming} />

          {/* Collapsible Video Section */}
          {video.youtubeId && (
            <Collapsible className="my-6">
              <CollapsibleTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-between"
                >
                  <span className="flex items-center gap-2">
                    <Play className="h-4 w-4" />
                    Watch Video
                  </span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-4">
                <div id="video-player">
                  <YouTubePlayer
                    ref={playerRef}
                    youtubeId={video.youtubeId}
                    className="w-full"
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          <div className="space-y-6 mt-6">
            <KeyTakeawaysList takeaways={summary.keyTakeaways} />

            {/* Show chapters while sections are loading during streaming */}
            {isStreaming && effectiveChapters.length > 0 && summary.sections.length === 0 && (
              <ChapterList
                chapters={effectiveChapters}
                isCreatorChapters={effectiveIsCreatorChapters}
                onSeek={handlePlayFromSection}
              />
            )}

            {renderSections()}

            {/* Resources from description analysis */}
            {effectiveDescriptionAnalysis && (
              <ResourcesPanel analysis={effectiveDescriptionAnalysis} />
            )}

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
