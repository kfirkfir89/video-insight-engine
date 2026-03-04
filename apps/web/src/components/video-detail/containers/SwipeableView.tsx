import { useState, useRef, useCallback, useEffect, type ReactNode } from "react";
import { cn } from "@/lib/utils";

// Ref-counted body select-none toggle to handle concurrent drag instances
let selectNoneCount = 0;
function addSelectNone() {
  if (selectNoneCount === 0) document.body.classList.add("select-none");
  selectNoneCount++;
}
function removeSelectNone() {
  selectNoneCount = Math.max(0, selectNoneCount - 1);
  if (selectNoneCount === 0) document.body.classList.remove("select-none");
}

interface SwipeableViewProps {
  sections: Array<{ id: string; label: string; content: ReactNode }>;
  className?: string;
}

export function SwipeableView({ sections, className }: SwipeableViewProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const touchStartX = useRef(0);
  const touchDeltaX = useRef(0);
  const dragCleanup = useRef<(() => void) | null>(null);

  // Cleanup dangling document listeners on unmount, window blur, or pointer lost
  useEffect(() => {
    const cleanup = () => dragCleanup.current?.();
    window.addEventListener("blur", cleanup);
    document.addEventListener("pointercancel", cleanup);
    return () => {
      dragCleanup.current?.();
      window.removeEventListener("blur", cleanup);
      document.removeEventListener("pointercancel", cleanup);
    };
  }, []);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, sections.length - 1));
      }
    },
    [sections.length]
  );

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchDeltaX.current = 0;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    touchDeltaX.current = e.touches[0].clientX - touchStartX.current;
  }, []);

  const handleTouchEnd = useCallback(() => {
    const threshold = 50;
    if (touchDeltaX.current < -threshold) {
      setActiveIndex((i) => Math.min(i + 1, sections.length - 1));
    } else if (touchDeltaX.current > threshold) {
      setActiveIndex((i) => Math.max(i - 1, 0));
    }
  }, [sections.length]);

  // Mouse drag support
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    touchStartX.current = e.clientX;
    touchDeltaX.current = 0;

    const handleMouseMove = (ev: MouseEvent) => {
      touchDeltaX.current = ev.clientX - touchStartX.current;
    };
    const handleMouseUp = () => {
      removeSelectNone();
      const threshold = 50;
      if (touchDeltaX.current < -threshold) {
        setActiveIndex((i) => Math.min(i + 1, sections.length - 1));
      } else if (touchDeltaX.current > threshold) {
        setActiveIndex((i) => Math.max(i - 1, 0));
      }
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      dragCleanup.current = null;
    };

    addSelectNone();
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    dragCleanup.current = () => {
      removeSelectNone();
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [sections.length]);

  return (
    <div
      className={cn("outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 rounded", className)}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      role="region"
      aria-roledescription="carousel"
      aria-label={`Section ${activeIndex + 1} of ${sections.length}: ${sections[activeIndex]?.label ?? ""}`}
    >
      {/* Position indicator */}
      <div className="flex items-center justify-center gap-1.5 mb-4" role="tablist">
        {sections.map((section, i) => (
          <button
            key={section.id}
            role="tab"
            aria-selected={i === activeIndex}
            className="group flex items-center justify-center p-3"
            onClick={() => setActiveIndex(i)}
            aria-label={`Go to ${section.label}`}
          >
            <span
              className={cn(
                "block rounded-full transition-all",
                i === activeIndex
                  ? "w-6 h-1.5 bg-primary"
                  : "w-1.5 h-1.5 bg-muted-foreground/30 group-hover:bg-muted-foreground/50"
              )}
            />
          </button>
        ))}
      </div>

      {/* Swipeable content */}
      <div
        className="overflow-hidden select-none"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
      >
        <div
          className="flex transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${activeIndex * 100}%)` }}
        >
          {sections.map((section) => (
            <div key={section.id} className="w-full shrink-0">
              {section.content}
            </div>
          ))}
        </div>
      </div>

      {/* Label + live region for screen readers */}
      <div className="text-center text-xs text-muted-foreground mt-3">
        {sections[activeIndex]?.label}
      </div>
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {sections[activeIndex]?.label && `Showing ${sections[activeIndex].label}`}
      </div>
    </div>
  );
}
