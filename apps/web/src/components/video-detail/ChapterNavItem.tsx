import { Play } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Section } from "@vie/types";

interface ChapterNavItemProps {
  section: Section;
  isActive: boolean;
  onScrollTo: () => void;
  onPlay: () => void;
}

export function ChapterNavItem({
  section,
  isActive,
  onScrollTo,
  onPlay,
}: ChapterNavItemProps) {
  return (
    <div
      data-slot="chapter-nav-item"
      data-active={isActive}
      className={cn(
        "group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all",
        isActive
          ? "bg-primary/10 border-l-2 border-primary -ml-[2px]"
          : "hover:bg-muted/50"
      )}
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
      <span className="text-xs font-mono text-muted-foreground w-10 shrink-0">
        {section.timestamp}
      </span>
      <span
        className={cn(
          "flex-1 text-sm truncate",
          isActive && "font-medium text-foreground"
        )}
      >
        {section.title}
      </span>

      {/* Hover play button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onPlay();
        }}
        className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-primary/20 text-primary transition-opacity focus:opacity-100"
        aria-label={`Play from ${section.timestamp}`}
      >
        <Play className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
