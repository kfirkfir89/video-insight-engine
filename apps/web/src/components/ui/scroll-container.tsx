import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ScrollContainerProps {
  children: ReactNode;
  /** Classes for the scrollable area (padding, gap, etc.) */
  className?: string;
  /** Classes for the outer relative wrapper */
  wrapperClassName?: string;
}

/**
 * Scrollable container with hidden native scrollbar and a custom
 * right-edge indicator that appears only while scrolling.
 */
export const ScrollContainer = forwardRef<HTMLDivElement, ScrollContainerProps>(
  function ScrollContainer({ children, className, wrapperClassName }, ref) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout>>(null);
    const rafRef = useRef<number | null>(null);
    const [thumb, setThumb] = useState({ scrolling: false, top: 0, height: 0, hasScroll: false });

    useImperativeHandle(ref, () => scrollRef.current!);

    useEffect(() => {
      const el = scrollRef.current;
      if (!el) return;

      const compute = () => {
        const { scrollTop, scrollHeight, clientHeight } = el;
        if (scrollHeight <= clientHeight) return { top: 0, height: 0, hasScroll: false };
        const h = Math.max(clientHeight * (clientHeight / scrollHeight), 24);
        const maxTop = clientHeight - h;
        const ratio = scrollTop / (scrollHeight - clientHeight);
        return { top: ratio * maxTop, height: h, hasScroll: true };
      };

      const initial = compute();
      setThumb((prev) => ({ ...prev, ...initial }));

      const onScroll = () => {
        if (rafRef.current) return;
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null;
          const t = compute();
          setThumb({ scrolling: true, ...t });
          if (timerRef.current) clearTimeout(timerRef.current);
          timerRef.current = setTimeout(() => {
            setThumb((prev) => ({ ...prev, scrolling: false }));
          }, 800);
        });
      };

      const ro = new ResizeObserver(() => {
        const t = compute();
        setThumb((prev) => ({ ...prev, ...t }));
      });
      ro.observe(el);
      el.addEventListener("scroll", onScroll, { passive: true });

      return () => {
        el.removeEventListener("scroll", onScroll);
        ro.disconnect();
        if (timerRef.current) clearTimeout(timerRef.current);
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      };
    }, []);

    return (
      <div className={cn("relative flex flex-col", wrapperClassName)}>
        <div
          ref={scrollRef}
          className={cn("flex-1 min-h-0 overflow-auto scrollbar-thin", className)}
        >
          {children}
        </div>
        {thumb.hasScroll && (
          <div
            aria-hidden="true"
            className="absolute top-0 right-0 w-[5px] h-full pointer-events-none z-50"
          >
            <div
              className="absolute right-0.5 w-[3px] rounded-full transition-opacity duration-300"
              style={{
                top: thumb.top,
                height: thumb.height,
                opacity: thumb.scrolling ? 0.2 : 0,
                backgroundColor: "var(--foreground)",
              }}
            />
          </div>
        )}
      </div>
    );
  }
);
