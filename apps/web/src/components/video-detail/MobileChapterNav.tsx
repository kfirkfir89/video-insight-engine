import { cn } from "@/lib/utils";
import type { Section } from "@vie/types";

interface MobileChapterNavProps {
  sections: Section[];
  activeSection: string | null;
  onScrollToSection: (sectionId: string) => void;
}

export function MobileChapterNav({
  sections,
  activeSection,
  onScrollToSection,
}: MobileChapterNavProps) {
  if (sections.length === 0) return null;

  return (
    <div
      data-slot="mobile-chapter-nav"
      className="fixed bottom-0 inset-x-0 z-50 bg-card/95 backdrop-blur-lg border-t safe-area-inset-bottom"
    >
      <div className="flex gap-2 px-4 py-3 overflow-x-auto scrollbar-hide">
        {sections.map((section) => (
          <button
            key={section.id}
            className={cn(
              "shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors",
              activeSection === section.id
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
            onClick={() => onScrollToSection(section.id)}
            aria-current={activeSection === section.id ? "true" : undefined}
          >
            {section.title}
          </button>
        ))}
      </div>
    </div>
  );
}
