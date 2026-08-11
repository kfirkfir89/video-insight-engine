import {
  forwardRef,
  useId,
  useRef,
  useImperativeHandle,
  useState,
  useCallback,
  useEffect,
} from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useDragScrollbar } from "@/hooks/use-drag-scrollbar";

interface ScrollContainerProps {
  children: ReactNode;
  /** Classes for the scrollable area (padding, gap, etc.) */
  className?: string;
  /** Classes for the outer relative wrapper */
  wrapperClassName?: string;
}

interface ThumbState {
  top: number;
  height: number;
  hasScroll: boolean;
  scrollPercent: number;
}

/**
 * Scrollable container with an auto-hiding, interactive overlay scrollbar.
 * - Auto-hides when idle (visible on scroll, hover, drag)
 * - No layout push (absolutely positioned, native scrollbar hidden)
 * - Fully interactive (click track → jump, drag thumb → scroll)
 */
export const ScrollContainer = forwardRef<HTMLDivElement, ScrollContainerProps>(
  function ScrollContainer({ children, className, wrapperClassName }, ref) {
    const scrollId = useId();
    const scrollRef = useRef<HTMLDivElement>(null);
    const hideTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

    const [thumb, setThumb] = useState<ThumbState>({
      top: 0,
      height: 0,
      hasScroll: false,
      scrollPercent: 0,
    });
    const [visible, setVisible] = useState(false);
    const [hovering, setHovering] = useState(false);

    const scheduleHide = useCallback(() => {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = setTimeout(() => setVisible(false), 800);
    }, []);

    const showThumb = useCallback(() => {
      clearTimeout(hideTimerRef.current);
      setVisible(true);
    }, []);

    const { dragging, handleThumbMouseDown } = useDragScrollbar({
      scrollRef,
      onDragStart: showThumb,
      onDragEnd: scheduleHide,
    });

    // Ref avoids stale closure in scroll handler when dragging state changes
    const draggingRef = useRef(false);
    useEffect(() => {
      draggingRef.current = dragging;
    }, [dragging]);

    const updateThumb = useCallback(() => {
      const el = scrollRef.current;
      if (!el) return;
      const { scrollTop, scrollHeight, clientHeight } = el;
      const hasScroll = scrollHeight > clientHeight;
      if (!hasScroll) {
        setThumb({ top: 0, height: 0, hasScroll: false, scrollPercent: 0 });
        return;
      }
      const ratio = clientHeight / scrollHeight;
      const thumbHeight = Math.max(ratio * clientHeight, 24);
      const maxTop = clientHeight - thumbHeight;
      const scrollRatio = scrollTop / (scrollHeight - clientHeight);
      const thumbTop = scrollRatio * maxTop;
      setThumb({ top: thumbTop, height: thumbHeight, hasScroll: true, scrollPercent: Math.round(scrollRatio * 100) });
    }, []);

    // Scroll handler — uses draggingRef to avoid stale closure flicker
    const handleScroll = useCallback(() => {
      updateThumb();
      showThumb();
      if (!draggingRef.current) scheduleHide();
    }, [updateThumb, showThumb, scheduleHide]);

    // ResizeObserver for content changes
    useEffect(() => {
      const el = scrollRef.current;
      if (!el) return;
      const ro = new ResizeObserver(() => updateThumb());
      ro.observe(el);
      if (el.firstElementChild) ro.observe(el.firstElementChild);
      updateThumb();
      return () => ro.disconnect();
    }, [updateThumb]);

    // Track click → jump to position
    const handleTrackMouseDown = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        const el = scrollRef.current;
        if (!el) return;
        const trackRect = e.currentTarget.getBoundingClientRect();
        const clickRatio =
          (e.clientY - trackRect.top) / trackRect.height;
        const { scrollHeight, clientHeight } = el;
        el.scrollTop = clickRatio * (scrollHeight - clientHeight);
      },
      [],
    );

    // Keep visible while hovering or dragging
    useEffect(() => {
      if (hovering || dragging) {
        showThumb();
      } else {
        scheduleHide();
      }
    }, [hovering, dragging, showThumb, scheduleHide]);

    // Cleanup timer on unmount
    useEffect(() => {
      return () => clearTimeout(hideTimerRef.current);
    }, []);

    useImperativeHandle(ref, () => scrollRef.current as HTMLDivElement);

    return (
      <div className={cn("relative flex flex-col", wrapperClassName)}>
        <div
          id={scrollId}
          ref={scrollRef}
          onScroll={handleScroll}
          className={cn(
            "flex-1 min-h-0 overflow-auto scrollbar-thin",
            className,
          )}
        >
          {children}
        </div>

        {thumb.hasScroll && (
          <div
            className="absolute top-0 right-0 w-[10px] h-full z-50"
            onMouseEnter={() => setHovering(true)}
            onMouseLeave={() => setHovering(false)}
            onMouseDown={handleTrackMouseDown}
          >
            <div
              role="scrollbar"
              aria-controls={scrollId}
              aria-valuenow={thumb.scrollPercent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-orientation="vertical"
              tabIndex={-1}
              className="absolute right-0.5 w-[5px] rounded-full transition-opacity duration-300 cursor-pointer"
              style={{
                top: thumb.top,
                height: thumb.height,
                opacity: visible ? 0.35 : 0,
                backgroundColor: "var(--foreground)",
              }}
              onMouseDown={handleThumbMouseDown}
            />
          </div>
        )}
      </div>
    );
  },
);
