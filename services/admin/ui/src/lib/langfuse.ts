/**
 * Langfuse deep-link helpers.
 *
 * Trace tag contract (set by the summarizer):
 *   - Summarizer trace name: `pipeline:{videoSummaryId}`
 *   - Tags: `requestId:<requestId>`, `videoSummaryId:<videoSummaryId>`
 *   - Assistant trace name: `chat:{videoId}` (keyed by userId/sessionId)
 *
 * The URL format targets Langfuse's trace-list view with a tag filter so the
 * admin lands on the run's trace(s) directly. Format:
 *   {baseUrl}/project/{projectId}/traces?filter=tag%3A<tagValue>
 *
 * Configuration via Vite env vars (non-secret; safe to expose to browser):
 *   VITE_LANGFUSE_BASE_URL   - e.g. "https://cloud.langfuse.com"
 *   VITE_LANGFUSE_PROJECT_ID - e.g. "proj-abc123"
 *
 * When either env var is absent/empty, all helpers return null and callers
 * must NOT render any link (prevents broken URLs in unconfigured environments).
 */

interface BuildLangfuseUrlOptions {
  /** The run's request_id. Preferred filter anchor. */
  requestId: string | null | undefined;
  /** Fallback when requestId is absent; becomes the videoSummaryId tag filter. */
  videoSummaryId?: string | null | undefined;
}

/**
 * Build a Langfuse trace-filter URL for a given run.
 *
 * Returns null when:
 *  - VITE_LANGFUSE_BASE_URL or VITE_LANGFUSE_PROJECT_ID are unset/empty, OR
 *  - both requestId and videoSummaryId are null/undefined.
 *
 * Never returns a partial/broken URL.
 */
export function buildLangfuseTraceUrl({
  requestId,
  videoSummaryId,
}: BuildLangfuseUrlOptions): string | null {
  const base = import.meta.env.VITE_LANGFUSE_BASE_URL as string | undefined;
  const project = import.meta.env.VITE_LANGFUSE_PROJECT_ID as string | undefined;

  if (!base || !project) return null;

  // Prefer requestId; fall back to videoSummaryId.
  const tagValue = requestId ?? videoSummaryId ?? null;
  if (!tagValue) return null;

  // Build a tag filter query: `requestId:<value>` or `videoSummaryId:<value>`.
  const tagKey = requestId != null ? 'requestId' : 'videoSummaryId';
  const filter = encodeURIComponent(`${tagKey}:${tagValue}`);

  return `${base}/project/${project}/traces?filter=${filter}`;
}
