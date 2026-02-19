import { useState, useEffect, useRef, type RefObject } from "react";

export function useIsTruncated(ref: RefObject<HTMLElement | null>): boolean {
  const [isTruncated, setIsTruncated] = useState(false);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const check = () => {
      setIsTruncated(el.scrollWidth > el.clientWidth);
    };

    check();

    const observer = new ResizeObserver(() => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        check();
      });
    });
    observer.observe(el);

    return () => {
      observer.disconnect();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []); // ref is a stable RefObject — no need to include

  return isTruncated;
}
