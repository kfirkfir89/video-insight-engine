import { useCallback, useEffect, useState } from "react";
import { Play, StopCircle, ChevronRight } from "lucide-react";
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
      <div
        className="flex items-center gap-1.5 cursor-pointer"
        onClick={onScrollTo}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onScrollTo();
          }
        }}
        role="button"
        tabIndex={0}
        aria-current={isActive ? "true" : undefined}
      >
        {/* Timestamp */}
        <span className="text-[10px] font-mono text-muted-foreground shrink-0 w-8">
          {chapter.timestamp}
        </span>

        {/* Title - truncate to single line */}
        <span
          className={cn(
            "flex-1 text-xs truncate",
            isActive ? "font-medium text-foreground" : "text-muted-foreground"
          )}
        >
          {chapter.title}
        </span>

        {/* Play/Stop button - inline */}
        {isPlaying ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onStop?.();
            }}
            className="p-0.5 rounded hover:bg-destructive/20 text-destructive transition-colors focus:outline-none shrink-0"
            aria-label="Stop video"
          >
            <StopCircle className="h-3 w-3" />
          </button>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPlay();
            }}
            className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-primary/20 text-primary transition-opacity focus:opacity-100 focus:outline-none shrink-0"
            aria-label={`Play from ${chapter.timestamp}`}
          >
            <Play className="h-3 w-3" />
          </button>
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
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (hasDefinition) toggleConcept(concept.id);
                      }}
                      className={cn(
                        "flex items-start gap-1 text-[11px] text-muted-foreground/80 leading-tight text-left w-full rounded-sm",
                        "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1",
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
                    </button>
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
                          <p className="text-[10px] text-muted-foreground/60 leading-relaxed pt-0.5 pb-1">
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
