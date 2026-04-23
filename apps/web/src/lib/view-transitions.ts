/**
 * View Transitions API helper.
 *
 * Wraps `document.startViewTransition` with feature detection, reduced-motion
 * gating, and "transition type" tagging via a data attribute on <html> so CSS
 * can target a specific transition (e.g. `html[data-vt-type="navigate"]`).
 *
 * Why a data attribute instead of the typed VT API: the second-arg form
 * (`startViewTransition({ update, types })`) is Chrome 125+ only. A data
 * attribute is universal across all View-Transitions-supporting browsers.
 */

export interface ViewTransitionLike {
  skipTransition(): void;
  finished: Promise<void>;
  ready: Promise<void>;
}

type StartViewTransitionFn = (
  cb: () => void | Promise<void>,
) => ViewTransitionLike;

function getStartViewTransition(): StartViewTransitionFn | null {
  if (typeof document === "undefined") return null;
  const fn = (
    document as unknown as { startViewTransition?: StartViewTransitionFn }
  ).startViewTransition;
  return typeof fn === "function" ? fn.bind(document) : null;
}

export type ViewTransitionType =
  | "theme"
  | "navigate-to-detail"
  | "navigate-to-board"
  | "tab-switch"
  | "stream-input-spine"
  | "sidebar-collapse";

export interface WithViewTransitionOptions {
  /** Tagged on <html> as data-vt-type for CSS targeting. */
  type?: ViewTransitionType;
  /** Allow motion even when prefers-reduced-motion is set. Default: false. */
  ignoreReducedMotion?: boolean;
}

let activeTransition: ViewTransitionLike | null = null;

/** Safety cap for a stalled transition. If `finished` never settles
 *  (user rapid-navigates, browser hitch, etc.) we force-clear so the next
 *  call isn't blocked forever by a leaked module-level reference. */
const ACTIVE_TRANSITION_MAX_MS = 3000;

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Run a DOM mutation inside a View Transition when supported, falling back
 * to direct invocation. Skips transition under reduced motion unless
 * `ignoreReducedMotion: true`.
 */
export function withViewTransition(
  apply: () => void | Promise<void>,
  options: WithViewTransitionOptions = {},
): ViewTransitionLike | null {
  const start = getStartViewTransition();
  const reduced = prefersReducedMotion() && !options.ignoreReducedMotion;
  if (!start || reduced) {
    void apply();
    return null;
  }

  const root = document.documentElement;

  // Clear the previous type tag before replacing it so a skipped in-flight
  // transition can't style its final frame with the incoming type's CSS.
  if (activeTransition) {
    activeTransition.skipTransition();
    delete root.dataset.vtType;
  }

  if (options.type) root.dataset.vtType = options.type;

  const transition = start(apply);
  activeTransition = transition;

  const clearOnce = (): void => {
    if (activeTransition === transition) activeTransition = null;
    if (options.type && root.dataset.vtType === options.type) {
      delete root.dataset.vtType;
    }
  };

  // Race the real `finished` promise against a hard timeout so a stalled
  // transition can never hold the module-level reference indefinitely.
  const timeout = new Promise<void>((resolve) => {
    setTimeout(resolve, ACTIVE_TRANSITION_MAX_MS);
  });
  Promise.race([
    transition.finished.catch((err: unknown) => {
      const name = (err as { name?: string } | null)?.name;
      if (name !== "AbortError") {
        console.warn("View transition failed:", err);
      }
    }),
    timeout,
  ]).finally(clearOnce);

  return transition;
}

/**
 * Apply a `view-transition-name` to an element for the duration of one
 * transition, then remove it. Useful for "tag → navigate → untag" flows
 * where the name should not persist on the element afterward.
 */
export function withTransitionName<T extends HTMLElement>(
  el: T | null,
  name: string,
  callback: () => void,
  options?: WithViewTransitionOptions,
): void {
  if (!el) {
    callback();
    return;
  }
  el.style.viewTransitionName = name;
  const transition = withViewTransition(callback, options);
  if (!transition) {
    el.style.viewTransitionName = "";
    return;
  }
  transition.finished.finally(() => {
    el.style.viewTransitionName = "";
  });
}
