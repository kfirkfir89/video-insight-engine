import { useRef, useState, useCallback, useEffect } from "react";

interface DragState {
  startY: number;
  startScrollTop: number;
}

interface UseDragScrollbarOptions {
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

interface UseDragScrollbarReturn {
  dragging: boolean;
  handleThumbMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
}

/**
 * Manages thumb-drag scrollbar interaction.
 * Attaches document-level mousemove/mouseup listeners while dragging
 * and translates mouse delta into scrollTop changes.
 */
export function useDragScrollbar({
  scrollRef,
  onDragStart,
  onDragEnd,
}: UseDragScrollbarOptions): UseDragScrollbarReturn {
  const dragRef = useRef<DragState | null>(null);
  const [dragging, setDragging] = useState(false);

  const handleThumbMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const el = scrollRef.current;
      if (!el) return;
      dragRef.current = { startY: e.clientY, startScrollTop: el.scrollTop };
      setDragging(true);
      onDragStart?.();
    },
    [scrollRef, onDragStart],
  );

  useEffect(() => {
    if (!dragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const el = scrollRef.current;
      const drag = dragRef.current;
      if (!el || !drag) return;
      const { scrollHeight, clientHeight } = el;
      const thumbRatio = clientHeight / scrollHeight;
      const thumbHeight = Math.max(thumbRatio * clientHeight, 24);
      const maxTop = clientHeight - thumbHeight;
      const maxScroll = scrollHeight - clientHeight;
      const deltaY = e.clientY - drag.startY;
      const scrollDelta = (deltaY / maxTop) * maxScroll;
      el.scrollTop = drag.startScrollTop + scrollDelta;
    };

    const handleMouseUp = () => {
      dragRef.current = null;
      setDragging(false);
      onDragEnd?.();
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragging, scrollRef, onDragEnd]);

  return { dragging, handleThumbMouseDown };
}
