import { useEffect, useState } from "react";

const SESSION_KEY_PREFIX = "vie:confetti-shown:";

/**
 * Centralizes the "confetti fires once per video per session" rule.
 *
 * The streaming pipeline emits completion via two SSE events (`complete`
 * and `done`); earlier fixes layered sessionStorage flags at each call
 * site. This hook owns the gating atomically per videoSummaryId so new
 * completion sources can't regress into a double-celebration.
 *
 * Behavior: returns a trigger integer that the Confetti component
 * watches. Increments exactly once per (videoSummaryId × tab session),
 * the first time confettiCount rises above 0 for that id. A fresh tab
 * or browser restart resets the gate — intentional, because the user
 * coming back to the same video in a new session has re-earned the
 * reward.
 */
export function useCelebrationTrigger(
  videoSummaryId: string,
  confettiCount: number,
): number {
  const [trigger, setTrigger] = useState(0);

  useEffect(() => {
    if (!videoSummaryId) return;
    if (confettiCount <= 0) return;

    const key = `${SESSION_KEY_PREFIX}${videoSummaryId}`;
    try {
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, "1");
    } catch {
      // sessionStorage unavailable (private mode, sandbox) —
      // fall through and fire once for this component lifetime.
    }

    setTrigger((t) => t + 1);
  }, [videoSummaryId, confettiCount]);

  return trigger;
}
