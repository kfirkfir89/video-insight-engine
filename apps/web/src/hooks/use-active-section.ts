import { useState, useEffect, useCallback } from "react";

/**
 * Tracks which section is currently visible in the viewport using IntersectionObserver.
 * Returns the active section ID and a function to manually set the active section.
 */
export function useActiveSection(sectionIds: string[]) {
  const [activeId, setActiveId] = useState<string | null>(
    sectionIds[0] ?? null
  );

  useEffect(() => {
    if (sectionIds.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Find the first visible entry
        const visibleEntry = entries.find((entry) => entry.isIntersecting);
        if (visibleEntry) {
          const id = visibleEntry.target.id.replace("section-", "");
          setActiveId(id);
        }
      },
      {
        // Trigger when section is 20% from top, 60% from bottom
        // This gives a good "active" zone in the middle of the viewport
        rootMargin: "-20% 0px -60% 0px",
        threshold: 0,
      }
    );

    // Observe all section elements
    sectionIds.forEach((id) => {
      const element = document.getElementById(`section-${id}`);
      if (element) {
        observer.observe(element);
      }
    });

    return () => observer.disconnect();
  }, [sectionIds]);

  const scrollToSection = useCallback((sectionId: string) => {
    const element = document.getElementById(`section-${sectionId}`);
    if (element) {
      element.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      // Set active immediately for better UX
      setActiveId(sectionId);
    }
  }, []);

  return { activeId, scrollToSection, setActiveId };
}
