import { useEffect, useRef } from "react";
import { ChapterNavItem } from "./ChapterNavItem";
import { ScrollContainer } from "@/components/ui/scroll-container";
import type { SummaryChapter, Concept } from "@vie/types";

const EMPTY_CONCEPTS: Concept[] = [];

interface StickyChapterNavProps {
  chapters: SummaryChapter[];
  activeChapter: string | null;
  activePlayChapter: string | null;
  onScrollToChapter: (chapterId: string) => void;
  onPlayFromChapter: (chapterId: string, startSeconds: number) => void;
  onStopChapter: () => void;
  conceptsByChapter?: Map<string, Concept[]>;
}

export function StickyChapterNav({
  chapters,
  activeChapter,
  activePlayChapter,
  onScrollToChapter,
  onPlayFromChapter,
  onStopChapter,
  conceptsByChapter,
}: StickyChapterNavProps) {
  const navRef = useRef<HTMLDivElement>(null);
  // Store chapters ref to avoid dependency in effect
  const chaptersRef = useRef(chapters);

  // Update ref in effect, not during render (React rules)
  useEffect(() => {
    chaptersRef.current = chapters;
  }, [chapters]);

  // Auto-scroll the chapters list to keep active chapter visible
  // Debounced to reduce layout thrashing during streaming
  useEffect(() => {
    if (!activeChapter || !navRef.current) return;

    const timeout = setTimeout(() => {
      if (!navRef.current) return;

      // Check if this is the first chapter using ref to avoid deps
      const currentChapters = chaptersRef.current;
      const isFirstChapter = currentChapters.length > 0 && currentChapters[0].id === activeChapter;

      if (isFirstChapter) {
        // For first chapter, scroll nav to top to show "Chapters" heading
        navRef.current.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        const activeElement = navRef.current.querySelector(
          `[data-chapter-id="${CSS.escape(activeChapter)}"]`
        );
        if (activeElement) {
          // Scroll the active chapter into view within the nav container
          activeElement.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
          });
        }
      }
    }, 100); // Debounce scroll to reduce layout thrashing

    return () => clearTimeout(timeout);
  }, [activeChapter]); // Removed chapters from deps - use ref instead

  return (
    <aside
      data-slot="sticky-chapter-nav"
      className="h-full w-full"
    >
      {/* Chapter List */}
      <ScrollContainer ref={navRef} wrapperClassName="h-full">
        <nav aria-label="Chapters">
          <div className="space-y-1">
            {chapters.map((chapter) => (
              <ChapterNavItem
                key={chapter.id}
                chapter={chapter}
                isActive={activeChapter === chapter.id}
                isPlaying={activePlayChapter === chapter.id}
                onScrollTo={() => onScrollToChapter(chapter.id)}
                onPlay={() => onPlayFromChapter(chapter.id, chapter.startSeconds)}
                onStop={onStopChapter}
                dataChapterId={chapter.id}
                concepts={conceptsByChapter?.get(chapter.id) ?? EMPTY_CONCEPTS}
              />
            ))}
          </div>
        </nav>
      </ScrollContainer>
    </aside>
  );
}
