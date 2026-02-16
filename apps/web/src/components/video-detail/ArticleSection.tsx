import { type RefObject, useState, memo, useCallback, useMemo } from "react";
import { Play, StopCircle, Lightbulb, ChevronRight, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { YouTubePlayer, type YouTubePlayerRef } from "@/components/videos/YouTubePlayer";
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
}: ArticleSectionProps) {
  // Check if this is a creator chapter with dual titles
  const hasCreatorChapter = chapter.isCreatorChapter && chapter.originalTitle;
  const hasConcepts = concepts.length > 0;

  // Track expanded concepts
  const [expandedConcepts, setExpandedConcepts] = useState<Set<string>>(new Set());

  const toggleConcept = useCallback((conceptId: string) => {
    setExpandedConcepts((prev) => {
      const next = new Set(prev);
      if (next.has(conceptId)) {
        next.delete(conceptId);
      } else {
        next.add(conceptId);
      }
      return next;
    });
  }, []);

  // Memoized callback to avoid recreating on every render
  const handleBlockPlay = useCallback(
    (seconds: number) => onPlay(chapter.id, seconds),
    [onPlay, chapter.id]
  );

  // Stabilize concepts reference to prevent unnecessary regex rebuilds in ConceptHighlighter
  const stableConcepts = useMemo(() => concepts, [concepts]);

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
      data-slot="article-chapter"
      className="flex flex-col lg:flex-row gap-4 lg:gap-0"
    >
      {/* Title Column - Left side on desktop, top on mobile */}
      <div className="lg:w-40 xl:w-48 lg:shrink-0 lg:pr-4 xl:pr-6 flex flex-col gap-2">
        {hasCreatorChapter ? (
          <>
            <h3 className="font-medium text-sm leading-tight text-muted-foreground/70">
              {chapter.originalTitle}
            </h3>
            {chapter.generatedTitle && (
              <p className="text-xs text-muted-foreground/50 leading-tight">
                {chapter.generatedTitle}
              </p>
            )}
          </>
        ) : (
          <h3 className="font-medium text-sm leading-tight text-muted-foreground/70">
            {chapter.title}
          </h3>
        )}

        {/* Play/Stop button */}
        {isVideoActive ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={onStop}
            className="w-fit gap-1.5 text-destructive hover:bg-destructive/10 -ml-2"
            aria-label="Stop video"
          >
            <StopCircle className="h-4 w-4" aria-hidden="true" />
            <span className="font-mono text-xs">Stop</span>
          </Button>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onPlay(chapter.id, chapter.startSeconds)}
            className="w-fit gap-1.5 text-primary hover:bg-primary/10 -ml-2"
            aria-label={`Play from ${chapter.timestamp}`}
          >
            <Play className="h-4 w-4" aria-hidden="true" />
            <span className="font-mono text-xs">{chapter.timestamp}</span>
          </Button>
        )}

        {/* Concepts - always visible */}
        {hasConcepts && (
          <div className="pt-2 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60">
              <Lightbulb className="h-3 w-3" aria-hidden="true" />
              <span>Concepts</span>
            </div>
            <ul className="space-y-0.5">
              {concepts.map((concept) => {
                const isExpanded = expandedConcepts.has(concept.id);
                const hasDefinition = !!concept.definition;

                const definitionId = `concept-definition-${concept.id}`;

                return (
                  <li key={concept.id}>
                    <button
                      id={`concept-btn-${concept.id}`}
                      type="button"
                      onClick={() => hasDefinition && toggleConcept(concept.id)}
                      className={cn(
                        "flex items-start gap-1 text-xs text-muted-foreground/80 leading-tight text-left w-full rounded-sm",
                        "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1",
                        hasDefinition && "hover:text-muted-foreground cursor-pointer"
                      )}
                      disabled={!hasDefinition}
                      aria-expanded={hasDefinition ? isExpanded : undefined}
                      aria-controls={hasDefinition ? definitionId : undefined}
                    >
                      {hasDefinition && (
                        <ChevronRight
                          className={cn(
                            "h-3 w-3 shrink-0 mt-0.5 transition-transform duration-200",
                            isExpanded && "rotate-90"
                          )}
                          aria-hidden="true"
                        />
                      )}
                      <span className={!hasDefinition ? "ml-4" : ""}>
                        {concept.name}
                      </span>
                    </button>
                    {/* Expandable definition */}
                    {hasDefinition && (
                      <div
                        id={definitionId}
                        role="region"
                        aria-labelledby={`concept-btn-${concept.id}`}
                        className={cn(
                          "grid transition-[grid-template-rows,opacity] duration-200 ease-out ml-4",
                          isExpanded
                            ? "grid-rows-[1fr] opacity-100"
                            : "grid-rows-[0fr] opacity-0"
                        )}
                      >
                        <div className="overflow-hidden min-h-0">
                          <p className="text-xs text-muted-foreground/60 leading-relaxed pt-0.5 pb-1">
                            {concept.definition}
                          </p>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      {/* Content Column - Right side with vertical line on desktop */}
      <div className="flex-1 lg:border-l lg:border-border lg:pl-6 min-w-0">
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

        {/* Chapter content - uses specialized view based on category */}
        {chapter.content && chapter.content.length > 0 ? (
          <ConceptsProvider concepts={stableConcepts}>
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
