import { useRef, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Clock, CheckCircle, ChevronDown, Play } from "lucide-react";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { VideoResponse, VideoSummary } from "@vie/types";

interface VideoDetailLayoutProps {
  video: VideoResponse;
  summary: VideoSummary | null;
}

export function VideoDetailLayout({ video, summary }: VideoDetailLayoutProps) {
  const playerRef = useRef<YouTubePlayerRef>(null);
  const isDesktop = useIsDesktop();

  const sectionIds = useMemo(
    () => summary?.sections.map((s) => s.id) ?? [],
    [summary?.sections]
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
        </div>
      </div>

      {!summary ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Summary not available yet. Video may still be processing.
          </CardContent>
        </Card>
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
            <TldrHero tldr={summary.tldr} />
            <KeyTakeawaysList takeaways={summary.keyTakeaways} />
            {renderSections()}
            <ConceptsGrid concepts={summary.concepts} />
          </main>
        </div>
      ) : (
        /* Mobile Layout: Single Column + Bottom Navigation */
        <div className="pb-24">
          <TldrHero tldr={summary.tldr} />

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
            {renderSections()}
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
