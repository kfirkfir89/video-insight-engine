import type { Concept, SummaryChapter } from "@vie/types";

/**
 * Parse timestamp string to seconds
 * Supports: "MM:SS", "HH:MM:SS", "H:MM:SS", "M:SS"
 */
export function parseTimestamp(timestamp: string): number {
  const parts = timestamp.split(":").map(Number);
  if (parts.some(isNaN)) return 0;

  if (parts.length === 2) {
    // MM:SS or M:SS
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 3) {
    // HH:MM:SS or H:MM:SS
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return 0;
}

/**
 * Result of matching concepts to chapters
 */
export interface ConceptMatchResult {
  /** Map of chapter ID to matched concepts */
  byChapter: Map<string, Concept[]>;
  /** Concepts that couldn't be matched to any chapter (no timestamp or out of range) */
  orphaned: Concept[];
}

/**
 * Normalize chapters to ensure endSeconds is properly set.
 * If endSeconds is 0 or missing, calculate it from the next chapter's startSeconds.
 */
function normalizeChapterRanges(chapters: SummaryChapter[]): SummaryChapter[] {
  if (chapters.length === 0) return [];

  // Sort by startSeconds to calculate end times
  const sorted = [...chapters].sort((a, b) => a.startSeconds - b.startSeconds);

  // Create a map of chapter ID to calculated endSeconds
  const endSecondsMap = new Map<string, number>();
  sorted.forEach((chapter, index) => {
    if (chapter.endSeconds > chapter.startSeconds) {
      // endSeconds is valid, use it
      endSecondsMap.set(chapter.id, chapter.endSeconds);
    } else {
      // Calculate from next chapter or use Infinity for last chapter
      const nextChapter = sorted[index + 1];
      endSecondsMap.set(chapter.id, nextChapter ? nextChapter.startSeconds : Infinity);
    }
  });

  // Return chapters in ORIGINAL order with fixed endSeconds
  return chapters.map((chapter) => ({
    ...chapter,
    endSeconds: endSecondsMap.get(chapter.id) ?? chapter.endSeconds,
  }));
}

/**
 * Match concepts to chapters based on timestamp overlap.
 * A concept matches a chapter if its timestamp falls within [startSeconds, endSeconds).
 *
 * Fixes endSeconds=0 issues by calculating from next chapter's startSeconds.
 */
export function matchConceptsToChapters(
  concepts: Concept[],
  chapters: SummaryChapter[]
): ConceptMatchResult {
  const byChapter = new Map<string, Concept[]>();
  const orphaned: Concept[] = [];

  if (chapters.length === 0) {
    return { byChapter, orphaned: concepts };
  }

  // Normalize chapters to fix missing endSeconds values
  const normalizedChapters = normalizeChapterRanges(chapters);

  // Initialize all chapters with empty arrays
  normalizedChapters.forEach((c) => byChapter.set(c.id, []));

  for (const concept of concepts) {
    if (!concept.timestamp) {
      orphaned.push(concept);
      continue;
    }

    const conceptSeconds = parseTimestamp(concept.timestamp);
    if (conceptSeconds === 0 && concept.timestamp !== "0:00") {
      // Failed to parse timestamp
      orphaned.push(concept);
      continue;
    }

    // Find matching chapter by time range
    const matchingChapter = normalizedChapters.find(
      (c) => conceptSeconds >= c.startSeconds && conceptSeconds < c.endSeconds
    );

    if (matchingChapter) {
      byChapter.get(matchingChapter.id)?.push(concept);
    } else {
      orphaned.push(concept);
    }
  }

  return { byChapter, orphaned };
}
