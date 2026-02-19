import { useCallback, useEffect, useState } from "react";
import { Play, StopCircle, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SummaryChapter, Concept } from "@vie/types";

interface ChapterNavItemProps {
  chapter: SummaryChapter;
  isActive: boolean;
  isPlaying?: boolean;
  onScrollTo: () => void;
  onPlay: () => void;
  onStop?: () => void;
  dataChapterId?: string;
  concepts?: Concept[];
}

export function ChapterNavItem({
  chapter,
  isActive,
  isPlaying,
  onScrollTo,
  onPlay,
  onStop,
  dataChapterId,
  concepts = [],
}: ChapterNavItemProps) {
  const [expandedConcepts, setExpandedConcepts] = useState<Set<string>>(new Set());
  const [isConceptsOpen, setIsConceptsOpen] = useState(false);
  const hasConcepts = concepts.length > 0;

  // Auto-expand concepts section when chapter becomes active, collapse when inactive
  useEffect(() => {
    setIsConceptsOpen(isActive && hasConcepts);
  }, [isActive, hasConcepts]);

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

  return (
    <div
      data-slot="chapter-nav-item"
      data-active={isActive}
      data-chapter-id={dataChapterId}
      className={cn(
        "group relative px-2 py-1 rounded transition-all",
        isActive
          ? "bg-primary/10 before:absolute before:left-0 before:top-0.5 before:bottom-0.5 before:w-0.5 before:bg-primary before:rounded-full"
          : "hover:bg-muted/50"
      )}
    >
      {/* Chapter row */}
      <div className="flex items-center gap-1.5">
        {/* Timestamp + Title — clickable as a single button */}
        <Button
          variant="ghost"
          size="bare"
          className="flex-1 min-w-0 text-left justify-start gap-1.5"
          onClick={onScrollTo}
          aria-current={isActive ? "true" : undefined}
        >
          <span className="text-[10px] font-mono text-muted-foreground shrink-0 w-8">
            {chapter.timestamp}
          </span>
          <span
            className={cn(
              "flex-1 text-xs truncate",
              isActive ? "font-medium text-foreground" : "text-muted-foreground"
            )}
          >
            {chapter.title}
          </span>
        </Button>

        {/* Play/Stop button - sibling, not nested */}
        {isPlaying ? (
          <Button
            variant="ghost"
            size="icon-bare"
            onClick={() => onStop?.()}
            className="hover:bg-destructive/20 text-destructive shrink-0"
            aria-label="Stop video"
          >
            <StopCircle className="h-3 w-3" />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon-bare"
            onClick={() => onPlay()}
            className="opacity-0 group-hover:opacity-100 hover:bg-primary/20 text-primary transition-opacity focus:opacity-100 shrink-0"
            aria-label={`Play from ${chapter.timestamp}`}
          >
            <Play className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Collapsible concepts section */}
      {hasConcepts && (
        <div
          className={cn(
            "grid transition-[grid-template-rows,opacity] duration-200 ease-out",
            isConceptsOpen
              ? "grid-rows-[1fr] opacity-100"
              : "grid-rows-[0fr] opacity-0"
          )}
        >
          <div className="overflow-hidden min-h-0">
            <ul className="pl-[38px] pt-1 pb-0.5 space-y-0.5">
              {concepts.map((concept) => {
                const isExpanded = expandedConcepts.has(concept.id);
                const hasDefinition = !!concept.definition;

                return (
                  <li key={concept.id}>
                    <Button
                      variant="ghost"
                      size="bare"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (hasDefinition) toggleConcept(concept.id);
                      }}
                      className={cn(
                        "items-start text-[11px] text-muted-foreground/90 leading-tight text-left w-full whitespace-normal justify-start",
                        hasDefinition && "hover:text-muted-foreground cursor-pointer"
                      )}
                      disabled={!hasDefinition}
                      aria-expanded={hasDefinition ? isExpanded : undefined}
                    >
                      {hasDefinition && (
                        <ChevronRight
                          className={cn(
                            "h-2.5 w-2.5 shrink-0 mt-[2px] transition-transform duration-200",
                            isExpanded && "rotate-90"
                          )}
                          aria-hidden="true"
                        />
                      )}
                      <span className={!hasDefinition ? "ml-3.5" : ""}>
                        {concept.name}
                      </span>
                    </Button>
                    {/* Expandable definition */}
                    {hasDefinition && (
                      <div
                        className={cn(
                          "grid transition-[grid-template-rows,opacity] duration-200 ease-out ml-3.5",
                          isExpanded
                            ? "grid-rows-[1fr] opacity-100"
                            : "grid-rows-[0fr] opacity-0"
                        )}
                      >
                        <div className="overflow-hidden min-h-0">
                          <p className="text-[10px] text-muted-foreground/70 leading-relaxed pt-0.5 pb-1">
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
        </div>
      )}
    </div>
  );
}
