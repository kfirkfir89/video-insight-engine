import { useState, useEffect, useCallback } from "react";

/** Scroll position threshold (px) from top to trigger first section selection */
const SCROLL_TOP_THRESHOLD = 100;

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

    // Find the scrollable main container - sections scroll within <main>
    const scrollContainer = document.querySelector("main");

    // Handle scroll events to detect when at top (select first section)
    const handleScroll = () => {
      if (scrollContainer && scrollContainer.scrollTop < SCROLL_TOP_THRESHOLD) {
        // When near top, always select first section
        setActiveId(sectionIds[0]);
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        // Skip if near top - scroll handler takes precedence
        if (scrollContainer && scrollContainer.scrollTop < SCROLL_TOP_THRESHOLD) {
          return;
        }
        // Find the first visible entry
        const visibleEntry = entries.find((entry) => entry.isIntersecting);
        if (visibleEntry) {
          const id = visibleEntry.target.id.replace("section-", "");
          setActiveId(id);
        }
      },
      {
        // Use the scroll container as root (null = viewport)
        root: scrollContainer,
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

    // Add scroll listener for top-of-page detection
    scrollContainer?.addEventListener("scroll", handleScroll, { passive: true });

    // Initial check for top-of-page
    handleScroll();

    return () => {
      observer.disconnect();
      scrollContainer?.removeEventListener("scroll", handleScroll);
    };
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
