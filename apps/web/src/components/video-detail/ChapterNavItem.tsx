import { useState, useEffect } from "react";
import { Play, StopCircle, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import type { Section, Concept } from "@vie/types";

interface ChapterNavItemProps {
  section: Section;
  concepts: Concept[];
  isActive: boolean;
  isPlaying?: boolean;
  onScrollTo: () => void;
  onPlay: () => void;
  onStop?: () => void;
  dataSectionId?: string;
}

export function ChapterNavItem({
  section,
  concepts,
  isActive,
  isPlaying,
  onScrollTo,
  onPlay,
  onStop,
  dataSectionId,
}: ChapterNavItemProps) {
  const hasConcepts = concepts.length > 0;

  // Track manual user toggle separately from auto-expand
  const [isManuallyOpen, setIsManuallyOpen] = useState(false);

  // Reset manual open state when section becomes active
  // This ensures active sections auto-expand and collapse when scrolling away
  /* eslint-disable react-hooks/set-state-in-effect -- Legitimate prop-to-state sync: reset local state when prop changes */
  useEffect(() => {
    if (isActive) {
      setIsManuallyOpen(false);
    }
  }, [isActive]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Active section is always open; non-active can be manually toggled
  const isOpen = isActive || isManuallyOpen;

  // Handle manual toggle - only affects non-active sections
  const handleOpenChange = (open: boolean) => {
    if (!isActive) {
      setIsManuallyOpen(open);
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={handleOpenChange}>
      <div
        data-slot="chapter-nav-item"
        data-active={isActive}
        data-section-id={dataSectionId}
        className={cn(
          "group relative px-3 py-2 rounded-lg transition-all",
          isActive
            ? "bg-primary/10 before:absolute before:left-0 before:top-1 before:bottom-1 before:w-0.5 before:bg-primary before:rounded-full"
            : "hover:bg-muted/50"
        )}
      >
        {/* Main row */}
        <div
          className="flex items-start gap-2 cursor-pointer"
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
          {/* Left: Timestamp + Play button stacked vertically */}
          <div className="flex flex-col items-center w-10 shrink-0">
            <span className="text-xs font-mono text-muted-foreground">
              {section.timestamp}
            </span>
            {/* Play/Stop button - always visible under timestamp */}
            {isPlaying ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onStop?.();
                }}
                className="p-0.5 mt-0.5 rounded hover:bg-destructive/20 text-destructive transition-colors focus:outline-none"
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
                className="p-0.5 mt-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-primary/20 text-primary transition-opacity focus:opacity-100 focus:outline-none"
                aria-label={`Play from ${section.timestamp}`}
              >
                <Play className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Title - NO TRUNCATE, allows wrapping */}
          <span
            className={cn(
              "flex-1 text-sm leading-snug",
              isActive && "font-medium text-foreground"
            )}
          >
            {section.title}
          </span>

          {/* Actions: concept count badge + expand chevron (no play button) */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Concept count badge - shows when has concepts */}
            {hasConcepts && (
              <Badge
                variant="secondary"
                className="h-5 min-w-5 px-1.5 text-xs font-medium"
              >
                {concepts.length}
              </Badge>
            )}

            {/* Expand trigger when has concepts */}
            {hasConcepts && (
              <CollapsibleTrigger asChild>
                <button
                  onClick={(e) => e.stopPropagation()}
                  className={cn(
                    "p-1 rounded hover:bg-muted text-muted-foreground transition-colors",
                    "focus:outline-none focus:ring-2 focus:ring-primary/20"
                  )}
                  aria-label="Show related concepts"
                >
                  <ChevronDown className="h-3.5 w-3.5 transition-transform duration-200 [[data-state=open]_&]:rotate-180" />
                </button>
              </CollapsibleTrigger>
            )}
          </div>
        </div>

        {/* Expandable concepts section */}
        {hasConcepts && (
          <CollapsibleContent className="pt-2 ml-10">
            <div className="space-y-2 border-l border-border/40 pl-2">
              {concepts.map((concept) => (
                <div
                  key={concept.id}
                  className="text-xs text-muted-foreground"
                >
                  <span className="font-medium text-foreground/90">
                    {concept.name}
                  </span>
                  {concept.definition && (
                    <p className="mt-0.5 leading-relaxed text-muted-foreground/80">
                      {concept.definition}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CollapsibleContent>
        )}
      </div>
    </Collapsible>
  );
}
