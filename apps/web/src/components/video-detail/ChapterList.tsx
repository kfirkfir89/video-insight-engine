/**
 * ChapterList - Displays video chapters with timestamps.
 *
 * Shows creator-defined chapters immediately as they arrive from the stream.
 * Each chapter is clickable to seek to that timestamp.
 */

import { cn } from "@/lib/utils";
import type { Chapter } from "@/hooks/use-summary-stream";

interface ChapterListProps {
  chapters: Chapter[];
  isCreatorChapters: boolean;
  currentTime?: number;
  onSeek?: (seconds: number) => void;
  className?: string;
}

function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function ChapterList({
  chapters,
  isCreatorChapters,
  currentTime = 0,
  onSeek,
  className,
}: ChapterListProps) {
  if (chapters.length === 0) {
    return null;
  }

  // Find current chapter based on currentTime
  const currentChapterIndex = chapters.findIndex(
    (ch, idx) =>
      currentTime >= ch.startSeconds &&
      (idx === chapters.length - 1 || currentTime < chapters[idx + 1].startSeconds)
  );

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="font-medium">Chapters</span>
        {isCreatorChapters && (
          <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-1.5 py-0.5 rounded">
            Creator
          </span>
        )}
      </div>

      <div className="space-y-1">
        {chapters.map((chapter, index) => {
          const isActive = index === currentChapterIndex;
          const isPast = currentTime > chapter.endSeconds;

          return (
            <button
              key={`${chapter.startSeconds}-${chapter.title}`}
              onClick={() => onSeek?.(chapter.startSeconds)}
              className={cn(
                "w-full text-left px-3 py-2 rounded-md transition-colors",
                "hover:bg-accent hover:text-accent-foreground",
                "flex items-center gap-3 group",
                isActive && "bg-accent text-accent-foreground",
                isPast && !isActive && "text-muted-foreground"
              )}
            >
              <span
                className={cn(
                  "text-xs font-mono tabular-nums",
                  "text-muted-foreground group-hover:text-foreground",
                  isActive && "text-primary font-medium"
                )}
              >
                {formatTimestamp(chapter.startSeconds)}
              </span>
              <span className="flex-1 text-sm truncate">{chapter.title}</span>
              {isActive && (
                <span className="text-xs text-primary font-medium">Now</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default ChapterList;
