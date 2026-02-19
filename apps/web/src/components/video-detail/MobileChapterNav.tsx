import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { SummaryChapter } from "@vie/types";

interface MobileChapterNavProps {
  chapters: SummaryChapter[];
  activeChapter: string | null;
  onScrollToChapter: (chapterId: string) => void;
}

export function MobileChapterNav({
  chapters,
  activeChapter,
  onScrollToChapter,
}: MobileChapterNavProps) {
  if (chapters.length === 0) return null;

  return (
    <div
      data-slot="mobile-chapter-nav"
      className="fixed bottom-0 inset-x-0 z-50 bg-card/95 backdrop-blur-lg border-t safe-area-inset-bottom"
    >
      <div className="flex gap-2 px-4 py-3 overflow-x-auto scrollbar-hide">
        {chapters.map((chapter) => (
          <Button
            key={chapter.id}
            variant="ghost"
            size="bare"
            className={cn(
              "shrink-0 px-4 py-2 rounded-full text-sm font-medium",
              activeChapter === chapter.id
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/90"
            )}
            onClick={() => onScrollToChapter(chapter.id)}
            aria-current={activeChapter === chapter.id ? "true" : undefined}
          >
            {chapter.title}
          </Button>
        ))}
      </div>
    </div>
  );
}
