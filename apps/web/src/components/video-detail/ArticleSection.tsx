import { type RefObject, memo, useCallback, useMemo } from "react";
import { Play, StopCircle, FileText, BookOpen } from "lucide-react";
import { YouTubePlayer, type YouTubePlayerRef } from "@/components/videos/YouTubePlayer";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  CodeView,
  RecipeView,
  StandardView,
  TravelView,
  ReviewView,
  FitnessView,
  EducationView,
  PodcastView,
  DIYView,
  GamingView,
} from "./views";
import { ConceptsProvider } from "./ConceptsContext";
import type { SummaryChapter, Concept, VideoCategory } from "@vie/types";


interface ArticleSectionProps {
  chapter: SummaryChapter;
  /** Stable callback - receives chapterId and startSeconds to avoid closure recreation */
  onPlay: (chapterId: string, startSeconds: number) => void;
  onStop?: () => void;
  isVideoActive?: boolean;
  /** Per-chapter concepts for sidebar display and inline text highlighting */
  concepts?: Concept[];
  playerRef?: RefObject<YouTubePlayerRef | null>;
  youtubeId?: string;
  startSeconds?: number;
  /** Content category for specialized view rendering (V2.1) */
  category?: VideoCategory;
  /** Go Deeper callback */
  onGoDeeper?: () => void;
  /** Whether Go Deeper is expanded for this chapter */
  isGoDeepExpanded?: boolean;
}

// Memoized to prevent re-renders when parent re-renders with same props
export const ArticleSection = memo(function ArticleSection({
  chapter,
  onPlay,
  onStop,
  isVideoActive,
  concepts = [],
  playerRef,
  youtubeId,
  startSeconds,
  category = 'standard',
  onGoDeeper,
  isGoDeepExpanded = false,
}: ArticleSectionProps) {
  // Check if this is a creator chapter with dual titles
  const hasCreatorChapter = chapter.isCreatorChapter && chapter.originalTitle;

  // Memoized callback to avoid recreating on every render
  const handleBlockPlay = useCallback(
    (seconds: number) => onPlay(chapter.id, seconds),
    [onPlay, chapter.id]
  );

  // Per-chapter view: use chapter.view if present, fall back to global category
  const effectiveCategory = chapter.view ?? category ?? 'standard';

  // Memoized category view with stable dependencies (V2.1)
  const categoryView = useMemo(() => {
    const viewProps = {
      chapter,
      onPlay: handleBlockPlay,
      onStop,
      isVideoActive,
      activeStartSeconds: startSeconds,
    };

    switch (effectiveCategory) {
      case 'coding':
        return <CodeView {...viewProps} />;
      case 'cooking':
        return <RecipeView {...viewProps} />;
      case 'travel':
        return <TravelView {...viewProps} />;
      case 'reviews':
        return <ReviewView {...viewProps} />;
      case 'fitness':
        return <FitnessView {...viewProps} />;
      case 'education':
        return <EducationView {...viewProps} />;
      case 'podcast':
        return <PodcastView {...viewProps} />;
      case 'diy':
        return <DIYView {...viewProps} />;
      case 'gaming':
        return <GamingView {...viewProps} />;
      case 'standard':
      default:
        return <StandardView {...viewProps} />;
    }
  }, [effectiveCategory, chapter, handleBlockPlay, onStop, isVideoActive, startSeconds]);

  return (
    <article
      id={`chapter-${chapter.id}`}
      data-slot="article-section"
      className="relative group"
    >
      {/* Buttons — absolute positioned outside right edge */}
      <div className="absolute -right-7 top-0 flex flex-col items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {isVideoActive ? (
          <Button
            variant="ghost"
            size="icon-bare"
            onClick={onStop}
            className="h-7 w-7 rounded-md text-destructive hover:bg-destructive/10 opacity-100"
            aria-label="Stop video"
          >
            <StopCircle className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon-bare"
            onClick={() => onPlay(chapter.id, chapter.startSeconds)}
            className="h-7 w-7 rounded-md text-primary hover:bg-primary/10"
            aria-label={`Play from ${chapter.timestamp}`}
          >
            <Play className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        )}
        {onGoDeeper && (
          <Button
            variant="ghost"
            size="icon-bare"
            onClick={onGoDeeper}
            className={cn(
              "h-7 w-7 rounded-md",
              isGoDeepExpanded
                ? "text-primary opacity-100"
                : "text-muted-foreground hover:text-primary"
            )}
            aria-label={isGoDeepExpanded ? "Close deeper view" : "Go deeper"}
          >
            <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        )}
      </div>

      {/* Always-visible active state indicator */}
      {(isVideoActive || isGoDeepExpanded) && (
        <div className="absolute -right-10 top-0 flex flex-col items-center gap-1">
          {isVideoActive && (
            <Button
              variant="ghost"
              size="icon-bare"
              onClick={onStop}
              className="h-7 w-7 rounded-md text-destructive hover:bg-destructive/10"
              aria-label="Stop video"
            >
              <StopCircle className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          )}
          {isGoDeepExpanded && onGoDeeper && (
            <Button
              variant="ghost"
              size="icon-bare"
              onClick={onGoDeeper}
              className="h-7 w-7 rounded-md text-primary"
              aria-label="Close deeper view"
              style={{ marginTop: isVideoActive ? 0 : undefined }}
            >
              <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          )}
        </div>
      )}

      {/* Chapter title with decorative line */}
      <div className="mb-2 flex items-center gap-3">
        <h3 className="font-normal text-xs leading-tight text-muted-foreground/40 shrink-0 whitespace-nowrap">
          {hasCreatorChapter ? chapter.originalTitle : chapter.title}
        </h3>
        {hasCreatorChapter && chapter.generatedTitle && (
          <span className="text-[11px] text-muted-foreground/30 leading-tight shrink-0">
            {chapter.generatedTitle}
          </span>
        )}
        <div className="flex-1 h-px fade-divider" />
      </div>

      {/* Full-width content */}
      <div className="min-w-0">
        {/* Video player at top of content when active */}
        {youtubeId && isVideoActive && (
          <div className="grid grid-rows-[1fr] opacity-100 transition-[grid-template-rows,opacity] duration-500 ease-out mb-4">
            <div className="overflow-hidden min-h-0">
              <YouTubePlayer
                ref={playerRef}
                youtubeId={youtubeId}
                startSeconds={startSeconds}
                autoplay={true}
                className="w-full max-w-2xl aspect-video rounded-lg overflow-hidden shadow-lg"
              />
            </div>
          </div>
        )}

        {/* Chapter content */}
        {chapter.content && chapter.content.length > 0 ? (
          <ConceptsProvider concepts={concepts}>
            {categoryView}
          </ConceptsProvider>
        ) : (
          <div className="flex items-center gap-2 text-muted-foreground pl-2 pr-8 py-4">
            <FileText className="h-4 w-4 shrink-0" />
            <p className="text-sm">Content not available for this chapter</p>
          </div>
        )}
      </div>
    </article>
  );
});
