/**
 * Frontend stream dedup: decides whether to open `/stream` for a given
 * video status.
 *
 * The backend already deduplicates concurrent pipeline runs via the Redis
 * lock at `vie:pipeline:lock:{videoSummaryId}`. This function adds a
 * symmetric client-side guard so a `/video/:id` mount on a finished video
 * does not even attempt the SSE connection — saving the round-trip and
 * the `Attaching as additional consumer` log line.
 *
 * Contract:
 *   - "pending"    → open (will trigger fresh pipeline)
 *   - "processing" → open (will attach as consumer)
 *   - "completed"  → do NOT open (cached output is the source of truth)
 *   - "failed"     → do NOT open (user must explicitly retry; the page
 *                    renders an error UI with a Retry button)
 *   - unknown / undefined → do NOT open (fail-safe; status hasn't loaded yet)
 */

export type VideoStatus = "pending" | "processing" | "completed" | "failed";

const STREAMING_STATUSES = new Set<string>(["pending", "processing"]);

export function shouldOpenStreamForStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  return STREAMING_STATUSES.has(status);
}
