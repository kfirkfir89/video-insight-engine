import { type RefObject } from "react";
import { Play, StopCircle, FileText } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { YouTubePlayer, type YouTubePlayerRef } from "@/components/videos/YouTubePlayer";
import { cn } from "@/lib/utils";
import { ContentBlocks } from "./ContentBlocks";
import type { SummaryChapter } from "@vie/types";

interface ChapterCardProps {
  chapter: SummaryChapter;
  onPlay: () => void;
  onStop?: () => void;
  // Props for collapsing video under chapter
  isVideoActive?: boolean;
  playerRef?: RefObject<YouTubePlayerRef | null>;
  youtubeId?: string;
  startSeconds?: number;
}

export function ChapterCard({
  chapter,
  onPlay,
  onStop,
  isVideoActive,
  playerRef,
  youtubeId,
  startSeconds,
}: ChapterCardProps) {
  // Check if this is a creator chapter with dual titles
  const hasCreatorChapter = chapter.isCreatorChapter && chapter.originalTitle;

  // Animation is handled purely via CSS - just use isVideoActive directly
  // The CSS grid transition handles the smooth expand/collapse

  return (
    <Card
      id={`chapter-${chapter.id}`}
      data-slot="chapter-card"
      className="group transition-all hover:shadow-md overflow-hidden"
    >
      {/* Video at TOP - smooth collapse animation using CSS Grid */}
      {youtubeId && isVideoActive && (
        <div
          className={cn(
            "grid transition-[grid-template-rows,opacity] duration-500 ease-out",
            isVideoActive
              ? "grid-rows-[1fr] opacity-100"
              : "grid-rows-[0fr] opacity-0"
          )}
        >
          <div className="overflow-hidden min-h-0">
            <div className="px-6 pt-4 pb-2 flex justify-center">
              <YouTubePlayer
                ref={playerRef}
                youtubeId={youtubeId}
                startSeconds={startSeconds}
                autoplay={true}
                className="w-full md:w-[80%] lg:w-[70%] aspect-video rounded-lg overflow-hidden shadow-lg"
              />
            </div>
          </div>
        </div>
      )}

      <CardHeader className="flex flex-row items-center justify-between gap-4 pb-3">
        {hasCreatorChapter ? (
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg leading-tight">{chapter.originalTitle}</h3>
            {chapter.generatedTitle && (
              <p className="text-sm text-muted-foreground mt-1">{chapter.generatedTitle}</p>
            )}
          </div>
        ) : (
          <h3 className="font-semibold text-lg leading-tight">{chapter.title}</h3>
        )}
        {isVideoActive ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={onStop}
            className="gap-1.5 text-destructive hover:bg-destructive/10 shrink-0"
            aria-label="Stop video"
          >
            <StopCircle className="h-4 w-4" />
            <span className="font-mono text-xs">Stop</span>
          </Button>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            onClick={onPlay}
            className="gap-1.5 text-primary hover:bg-primary/10 shrink-0"
            aria-label={`Play from ${chapter.timestamp}`}
          >
            <Play className="h-4 w-4" />
            <span className="font-mono text-xs">{chapter.timestamp}</span>
          </Button>
        )}
      </CardHeader>

      <CardContent className="pt-0">
        {chapter.content && chapter.content.length > 0 ? (
          <ContentBlocks blocks={chapter.content} />
        ) : (
          <div className="flex items-center gap-2 text-muted-foreground py-4">
            <FileText className="h-4 w-4 shrink-0" />
            <p className="text-sm">Content not available for this chapter</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
