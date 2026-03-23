import type { VideoResponse, VideoOutput, VIEResponse, VIEResponseMeta, TriageResult } from '@vie/types';

/**
 * Build a VIEResponse from a v1 VideoOutput for legacy backward compatibility.
 * Returns null if insufficient data.
 */
export function buildVIEResponse(
  output: VideoOutput,
  video: VideoResponse,
  triage: TriageResult,
): VIEResponse {
  const rawOutput = output.output ?? {};

  // Detect wrapped { data: {...} } pattern and unwrap
  const domainData = isWrappedData(rawOutput)
    ? (rawOutput as { data: Record<string, unknown> }).data
    : rawOutput;

  const meta: VIEResponseMeta = {
    videoId: video.videoSummaryId,
    videoTitle: video.title,
    creator: video.channel ?? '',
    contentTags: triage.contentTags,
    modifiers: triage.modifiers,
    primaryTag: triage.primaryTag,
    userGoal: triage.userGoal,
  };

  // Only spread known domain keys to prevent overwriting meta/tabs
  const DOMAIN_KEYS = new Set([
    'learning', 'tech', 'food', 'travel', 'fitness', 'music', 'review', 'project', 'narrative',
  ]);
  const safeDomain: Record<string, unknown> = {};
  if (typeof domainData === 'object' && domainData !== null) {
    for (const [key, value] of Object.entries(domainData as Record<string, unknown>)) {
      if (DOMAIN_KEYS.has(key)) safeDomain[key] = value;
    }
  }

  return {
    ...safeDomain,
    meta,
    tabs: triage.tabs,
    ...(output.enrichment?.quiz ? { quizzes: output.enrichment.quiz } : {}),
    ...(output.enrichment?.flashcards ? { flashcards: output.enrichment.flashcards } : {}),
    ...(output.enrichment?.scenarios ? { scenarios: output.enrichment.scenarios } : {}),
  } as VIEResponse;
}

function isWrappedData(obj: unknown): obj is { data: Record<string, unknown> } {
  if (typeof obj !== 'object' || obj === null) return false;
  return 'data' in obj && typeof (obj as Record<string, unknown>).data === 'object';
}
