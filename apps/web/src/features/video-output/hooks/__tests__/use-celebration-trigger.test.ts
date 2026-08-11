import { describe, it, expect, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useCelebrationTrigger } from "../use-celebration-trigger";

describe("useCelebrationTrigger", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("should return 0 when confettiCount is 0", () => {
    const { result } = renderHook(() => useCelebrationTrigger("vid-1", 0));
    expect(result.current).toBe(0);
  });

  it("should return 0 when videoSummaryId is empty", () => {
    const { result } = renderHook(() => useCelebrationTrigger("", 1));
    expect(result.current).toBe(0);
  });

  it("should fire exactly once when confettiCount transitions above 0", () => {
    const { result, rerender } = renderHook(
      ({ id, count }) => useCelebrationTrigger(id, count),
      { initialProps: { id: "vid-1", count: 0 } },
    );
    expect(result.current).toBe(0);

    rerender({ id: "vid-1", count: 1 });
    expect(result.current).toBe(1);

    // Subsequent renders with the same id + count MUST NOT re-fire
    rerender({ id: "vid-1", count: 1 });
    expect(result.current).toBe(1);
  });

  it("should not re-fire for the same id across remounts in the same session", () => {
    const first = renderHook(() => useCelebrationTrigger("vid-1", 1));
    expect(first.result.current).toBe(1);
    first.unmount();

    const second = renderHook(() => useCelebrationTrigger("vid-1", 1));
    expect(second.result.current).toBe(0);
  });

  it("should fire once per distinct videoSummaryId in the same session", () => {
    const a = renderHook(() => useCelebrationTrigger("vid-a", 1));
    expect(a.result.current).toBe(1);

    const b = renderHook(() => useCelebrationTrigger("vid-b", 1));
    expect(b.result.current).toBe(1);

    const aAgain = renderHook(() => useCelebrationTrigger("vid-a", 1));
    expect(aAgain.result.current).toBe(0);
  });

  it("should persist the gate across remounts via sessionStorage", () => {
    renderHook(() => useCelebrationTrigger("vid-1", 1)).unmount();
    expect(window.sessionStorage.getItem("vie:confetti-shown:vid-1")).toBe("1");
  });
});
