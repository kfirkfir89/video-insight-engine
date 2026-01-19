import { useEffect, useRef } from "react";
import { ChapterNavItem } from "./ChapterNavItem";
import type { Section } from "@vie/types";

interface StickyChapterNavProps {
  sections: Section[];
  activeSection: string | null;
  activePlaySection: string | null;
  onScrollToSection: (sectionId: string) => void;
  onPlayFromSection: (sectionId: string, startSeconds: number) => void;
  onStopSection: () => void;
}

export function StickyChapterNav({
  sections,
  activeSection,
  activePlaySection,
  onScrollToSection,
  onPlayFromSection,
  onStopSection,
}: StickyChapterNavProps) {
  const navRef = useRef<HTMLElement>(null);

  // Auto-scroll the chapters list to keep active chapter visible
  useEffect(() => {
    if (!activeSection || !navRef.current) return;

    // Check if this is the first section
    const isFirstSection = sections.length > 0 && sections[0].id === activeSection;

    if (isFirstSection) {
      // For first section, scroll nav to top to show "Chapters" heading
      navRef.current.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      const activeElement = navRef.current.querySelector(
        `[data-section-id="${activeSection}"]`
      );
      if (activeElement) {
        // Scroll the active chapter into view within the nav container
        activeElement.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      }
    }
  }, [activeSection, sections]);

  return (
    <aside
      data-slot="sticky-chapter-nav"
      className="h-[calc(100vh-4rem)] w-full"
    >
      {/* Chapter List */}
      <nav
        ref={navRef}
        className="h-full overflow-y-auto scrollbar-hide"
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
              isPlaying={activePlaySection === section.id}
              onScrollTo={() => onScrollToSection(section.id)}
              onPlay={() => onPlayFromSection(section.id, section.startSeconds)}
              onStop={onStopSection}
              dataSectionId={section.id}
            />
          ))}
        </div>
      </nav>
    </aside>
  );
}
