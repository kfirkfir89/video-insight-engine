import { type RefObject } from "react";
import { Play, StopCircle } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { YouTubePlayer, type YouTubePlayerRef } from "@/components/videos/YouTubePlayer";
import { cn } from "@/lib/utils";
import { ContentBlocks } from "./ContentBlocks";
import type { Section } from "@vie/types";

interface SectionCardProps {
  section: Section;
  onPlay: () => void;
  onStop?: () => void;
  // Props for collapsing video under section
  isVideoActive?: boolean;
  playerRef?: RefObject<YouTubePlayerRef | null>;
  youtubeId?: string;
  startSeconds?: number;
}

export function SectionCard({
  section,
  onPlay,
  onStop,
  isVideoActive,
  playerRef,
  youtubeId,
  startSeconds,
}: SectionCardProps) {
  // Check if this is a creator chapter with dual titles
  const hasCreatorChapter = section.isCreatorChapter && section.originalTitle;

  // Animation is handled purely via CSS - just use isVideoActive directly
  // The CSS grid transition handles the smooth expand/collapse

  return (
    <Card
      id={`section-${section.id}`}
      data-slot="section-card"
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
            <h3 className="font-semibold text-lg leading-tight">{section.originalTitle}</h3>
            {section.generatedTitle && (
              <p className="text-sm text-muted-foreground mt-1">{section.generatedTitle}</p>
            )}
          </div>
        ) : (
          <h3 className="font-semibold text-lg leading-tight">{section.title}</h3>
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
            aria-label={`Play from ${section.timestamp}`}
          >
            <Play className="h-4 w-4" />
            <span className="font-mono text-xs">{section.timestamp}</span>
          </Button>
        )}
      </CardHeader>

      <CardContent className="pt-0">
        {section.content && section.content.length > 0 ? (
          <ContentBlocks blocks={section.content} />
        ) : (
          <>
            <p className="text-muted-foreground mb-4 leading-relaxed">
              {section.summary}
            </p>
            {section.bullets && section.bullets.length > 0 && (
              <ul className="space-y-2">
                {section.bullets.map((bullet, index) => (
                  <li key={index} className="flex gap-2.5 text-sm">
                    <span className="text-primary mt-0.5 shrink-0">&#8226;</span>
                    <span className="text-muted-foreground">{bullet}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
