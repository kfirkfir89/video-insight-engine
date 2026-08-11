/**
 * Minimal prod-visible telemetry counters.
 *
 * Counters increment in every build (NOT gated on import.meta.env.DEV) and are
 * mirrored onto `window.__vieTelemetry` so drift is inspectable in production
 * consoles and E2E runs. Used by the tab-boundary prop validation (4.4) and
 * available for SSE parse / unknown-component fallbacks (6.4).
 */

declare global {
  interface Window {
    /** Live counter map — same object reference as the module-level store. */
    __vieTelemetry?: Record<string, number>;
  }
}

const counters: Record<string, number> = {};

// Expose the live map for prod inspection. Guarded for SSR/worker contexts.
if (typeof window !== 'undefined') {
  window.__vieTelemetry = counters;
}

/** Increment a named counter (creates it at 1 when absent). */
export function incrementTelemetryCounter(name: string): void {
  counters[name] = (counters[name] ?? 0) + 1;
}

/** Read a single counter (0 when never incremented). */
export function getTelemetryCounter(name: string): number {
  return counters[name] ?? 0;
}

/** Snapshot of all counters — for tests and debug overlays. */
export function getTelemetryCounters(): Readonly<Record<string, number>> {
  return { ...counters };
}

/** Reset all counters — test hygiene only. */
export function resetTelemetryCounters(): void {
  for (const key of Object.keys(counters)) {
    delete counters[key];
  }
}
