/**
 * Toast shown when the API returns `duplicate: true` from POST /api/videos.
 * Server returned the existing videoSummary instead of running a fresh
 * pipeline — surface the redirect rather than letting it feel silent.
 *
 * Lazy-imports sonner so the form bundle stays light on the cold path.
 */
export async function showDuplicateToast(): Promise<void> {
  const { toast } = await import('sonner');
  toast.success('Already processed — opening existing result');
}
