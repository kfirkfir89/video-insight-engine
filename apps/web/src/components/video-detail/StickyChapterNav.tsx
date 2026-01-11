import { forwardRef } from "react";
import { ChapterNavItem } from "./ChapterNavItem";
import { CollapsibleVideoPlayer } from "./CollapsibleVideoPlayer";
import type { YouTubePlayerRef } from "@/components/videos/YouTubePlayer";
import type { Section } from "@vie/types";

interface StickyChapterNavProps {
  youtubeId: string;
  sections: Section[];
  activeSection: string | null;
  onScrollToSection: (sectionId: string) => void;
  onPlayFromSection: (startSeconds: number) => void;
}

export const StickyChapterNav = forwardRef<
  YouTubePlayerRef,
  StickyChapterNavProps
>(function StickyChapterNav(
  { youtubeId, sections, activeSection, onScrollToSection, onPlayFromSection },
  ref
) {
  return (
    <aside
      data-slot="sticky-chapter-nav"
      className="sticky top-6 h-[calc(100vh-6rem)] flex flex-col gap-4 w-[260px] shrink-0"
    >
      {/* Collapsible Video Player */}
      <CollapsibleVideoPlayer ref={ref} youtubeId={youtubeId} />

      {/* Chapter List */}
      <nav
        className="flex-1 overflow-y-auto scrollbar-hide"
        aria-label="Chapters"
      >
        <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 px-3">
          Chapters
        </h2>
        <div className="space-y-1">
          {sections.map((section) => (
            <ChapterNavItem
              key={section.id}
              section={section}
              isActive={activeSection === section.id}
              onScrollTo={() => onScrollToSection(section.id)}
              onPlay={() => onPlayFromSection(section.startSeconds)}
            />
          ))}
        </div>
      </nav>
    </aside>
  );
});
