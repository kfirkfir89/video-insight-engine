import { Play, StopCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Section } from "@vie/types";

interface ChapterNavItemProps {
  section: Section;
  isActive: boolean;
  isPlaying?: boolean;
  onScrollTo: () => void;
  onPlay: () => void;
  onStop?: () => void;
  dataSectionId?: string;
}

export function ChapterNavItem({
  section,
  isActive,
  isPlaying,
  onScrollTo,
  onPlay,
  onStop,
  dataSectionId,
}: ChapterNavItemProps) {
  return (
    <div
      data-slot="chapter-nav-item"
      data-active={isActive}
      data-section-id={dataSectionId}
      className={cn(
        "group relative px-2 py-1 rounded transition-all",
        isActive
          ? "bg-primary/10 before:absolute before:left-0 before:top-0.5 before:bottom-0.5 before:w-0.5 before:bg-primary before:rounded-full"
          : "hover:bg-muted/50"
      )}
    >
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
          {section.timestamp}
        </span>

        {/* Title - truncate to single line */}
        <span
          className={cn(
            "flex-1 text-xs truncate",
            isActive ? "font-medium text-foreground" : "text-muted-foreground"
          )}
        >
          {section.title}
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
            aria-label={`Play from ${section.timestamp}`}
          >
            <Play className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}
