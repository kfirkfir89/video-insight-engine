import { useState, useEffect, useCallback } from "react";

/** Scroll position threshold (px) from top to trigger first chapter selection */
const SCROLL_TOP_THRESHOLD = 100;

/** Scroll position threshold (px) from bottom to trigger last chapter selection */
const SCROLL_BOTTOM_THRESHOLD = 100;

/**
 * Tracks which chapter is currently visible in the viewport using IntersectionObserver.
 * Returns the active chapter ID and a function to manually set the active chapter.
 */
export function useActiveChapter(chapterIds: string[]) {
  const [activeId, setActiveId] = useState<string | null>(
    chapterIds[0] ?? null
  );

  useEffect(() => {
    if (chapterIds.length === 0) return;

    // Find the scrollable main container - chapters scroll within <main>
    const scrollContainer = document.querySelector("main");

    // Handle scroll events to detect when at top or bottom
    const handleScroll = () => {
      if (!scrollContainer) return;

      // When near top, always select first chapter
      if (scrollContainer.scrollTop < SCROLL_TOP_THRESHOLD) {
        setActiveId(chapterIds[0]);
        return;
      }

      // When near bottom, always select last chapter
      const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      if (distanceFromBottom < SCROLL_BOTTOM_THRESHOLD) {
        setActiveId(chapterIds[chapterIds.length - 1]);
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (!scrollContainer) return;

        // Skip if near top - scroll handler takes precedence
        if (scrollContainer.scrollTop < SCROLL_TOP_THRESHOLD) {
          return;
        }

        // Skip if near bottom - scroll handler takes precedence
        const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
        const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
        if (distanceFromBottom < SCROLL_BOTTOM_THRESHOLD) {
          return;
        }

        // Find the first visible entry
        const visibleEntry = entries.find((entry) => entry.isIntersecting);
        if (visibleEntry) {
          const id = visibleEntry.target.id.replace("chapter-", "");
          setActiveId(id);
        }
      },
      {
        // Use the scroll container as root (null = viewport)
        root: scrollContainer,
        // Trigger when chapter is 20% from top, 60% from bottom
        // This gives a good "active" zone in the middle of the viewport
        rootMargin: "-20% 0px -60% 0px",
        threshold: 0,
      }
    );

    // Observe all chapter elements
    chapterIds.forEach((id) => {
      const element = document.getElementById(`chapter-${id}`);
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
  }, [chapterIds]);

  const scrollToChapter = useCallback((chapterId: string) => {
    const element = document.getElementById(`chapter-${chapterId}`);
    if (element) {
      // Find the scrollable main container - don't use scrollIntoView as it scrolls window
      const scrollContainer = document.querySelector("main");
      if (scrollContainer) {
        const containerRect = scrollContainer.getBoundingClientRect();
        const elementRect = element.getBoundingClientRect();
        const relativeTop = elementRect.top - containerRect.top + scrollContainer.scrollTop;
        const offset = 80; // px from top of container
        scrollContainer.scrollTo({ top: relativeTop - offset, behavior: "smooth" });
      } else {
        // Fallback to scrollIntoView
        element.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      // Set active immediately for better UX
      setActiveId(chapterId);
    }
  }, []);

  return { activeId, scrollToChapter, setActiveId };
}
