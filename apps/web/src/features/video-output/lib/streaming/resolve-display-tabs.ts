import type { TabEntry } from "@vie/types";

interface ResolveDisplayTabsInput {
  streamTabs: TabEntry[];
  dbTabs: TabEntry[] | null;
  videoStatus: string | undefined;
}

/**
 * Decide whether the page renders the streamed tab set or the DB record.
 *
 * While the video is processing, streaming keeps priority (progressive
 * rendering). Once the video is completed, the DB doc is authoritative: a
 * dropped SSE connection must not pin a partial streamed subset over the full
 * persisted tab set. The stream only wins on a completed video in the
 * defensive case where it somehow holds MORE tabs than the doc.
 */
export function resolveDisplayTabs({
  streamTabs,
  dbTabs,
  videoStatus,
}: ResolveDisplayTabsInput): TabEntry[] | null {
  const dbComplete = videoStatus === "completed" && !!dbTabs && dbTabs.length > 0;
  if (dbComplete && dbTabs.length >= streamTabs.length) return dbTabs;
  if (streamTabs.length > 0) return streamTabs;
  return dbTabs && dbTabs.length > 0 ? dbTabs : null;
}
