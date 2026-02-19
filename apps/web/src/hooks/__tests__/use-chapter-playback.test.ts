import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useChapterPlayback } from "../use-chapter-playback";
import type { RefObject } from "react";
import type { YouTubePlayerRef } from "@/components/videos/YouTubePlayer";

function createMockPlayerRef(): RefObject<YouTubePlayerRef | null> {
  return {
    current: {
      seekTo: vi.fn(),
      playVideo: vi.fn(),
      pauseVideo: vi.fn(),
      getCurrentTime: vi.fn().mockReturnValue(0),
      getDuration: vi.fn().mockReturnValue(100),
      getPlayerState: vi.fn().mockReturnValue(-1),
    },
  };
}

describe("useChapterPlayback", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("initial state", () => {
    it("should have no active play chapter", () => {
      const playerRef = createMockPlayerRef();
      const { result } = renderHook(() => useChapterPlayback(playerRef, true));

      expect(result.current.activePlayChapter).toBeNull();
      expect(result.current.activeStartSeconds).toBe(0);
    });
  });

  describe("handleStopChapter", () => {
    it("should clear active play chapter", () => {
      const playerRef = createMockPlayerRef();
      const { result } = renderHook(() => useChapterPlayback(playerRef, true));

      act(() => {
        result.current.handleStopChapter();
      });

      expect(result.current.activePlayChapter).toBeNull();
    });
  });

  describe("handlePlayFromChapter (mobile)", () => {
    it("should seek player on mobile", async () => {
      const playerRef = createMockPlayerRef();
      const { result } = renderHook(() => useChapterPlayback(playerRef, false));

      act(() => {
        result.current.handlePlayFromChapter("ch-1", 120);
      });

      // requestAnimationFrame fires asynchronously
      await vi.waitFor(() => {
        expect(playerRef.current?.seekTo).toHaveBeenCalledWith(120);
        expect(playerRef.current?.playVideo).toHaveBeenCalled();
      });
    });
  });

  describe("handlePlayFromChapter (desktop)", () => {
    it("should set active chapter and start seconds", () => {
      const playerRef = createMockPlayerRef();
      const { result } = renderHook(() => useChapterPlayback(playerRef, true));

      act(() => {
        result.current.handlePlayFromChapter("ch-2", 300);
      });

      expect(result.current.activePlayChapter).toBe("ch-2");
      expect(result.current.activeStartSeconds).toBe(300);
    });
  });

  describe("handleSeekToChapter", () => {
    it("should seek player to start seconds", async () => {
      const playerRef = createMockPlayerRef();
      const { result } = renderHook(() => useChapterPlayback(playerRef, true));

      act(() => {
        result.current.handleSeekToChapter(60);
      });

      await vi.waitFor(() => {
        expect(playerRef.current?.seekTo).toHaveBeenCalledWith(60);
        expect(playerRef.current?.playVideo).toHaveBeenCalled();
      });
    });
  });

  describe("return stability", () => {
    it("should return stable callback references between renders", () => {
      const playerRef = createMockPlayerRef();
      const { result, rerender } = renderHook(() => useChapterPlayback(playerRef, true));

      const first = result.current;
      rerender();
      const second = result.current;

      expect(first.handlePlayFromChapter).toBe(second.handlePlayFromChapter);
      expect(first.handleStopChapter).toBe(second.handleStopChapter);
      expect(first.handleSeekToChapter).toBe(second.handleSeekToChapter);
    });
  });
});
