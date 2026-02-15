import type { Concept, ContentBlock, SummaryChapter } from "@vie/types";

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
 * Extract searchable text from a content block.
 * Uses `in` checks to safely access common text fields across block types.
 */
export function extractBlockText(block: ContentBlock): string {
  const parts: string[] = [];

  if ("text" in block && typeof block.text === "string") parts.push(block.text);
  if ("term" in block && typeof block.term === "string") parts.push(block.term);
  if ("meaning" in block && typeof block.meaning === "string") parts.push(block.meaning);
  if ("label" in block && typeof block.label === "string") parts.push(block.label);

  if ("steps" in block && Array.isArray(block.steps)) {
    for (const step of block.steps) {
      if (step?.instruction) parts.push(step.instruction);
      if (step?.tips) parts.push(step.tips);
    }
  }
  if ("items" in block && Array.isArray(block.items)) {
    for (const item of block.items) {
      if (typeof item === "string") {
        parts.push(item);
      } else if (item != null) {
        // Items union is too heterogeneous for `in` narrowing — safe cast
        const obj = item as Record<string, unknown>;
        if (typeof obj.name === "string") parts.push(obj.name);
        if (typeof obj.notes === "string") parts.push(obj.notes);
        if (typeof obj.text === "string") parts.push(obj.text);
      }
    }
  }

  return parts.join(" ");
}

/**
 * Match concepts to chapters using both content and timestamp signals.
 *
 * Both signals run independently so we can compare how synced they are.
 * A concept appears in a chapter if:
 * - Its name is mentioned in the chapter's content blocks (content match)
 * - OR its timestamp falls within the chapter's time range (timestamp match)
 *
 * Future: remove timestamp matching entirely — concepts belong where you read them.
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

  // Pre-compute lowercased chapter text to avoid re-extracting per concept
  const chapterTextMap = new Map<string, string>(
    normalizedChapters.map((ch) => [
      ch.id,
      (ch.content ?? []).map(extractBlockText).join(" ").toLowerCase(),
    ])
  );

  for (const concept of concepts) {
    let matched = false;
    const needle = concept.name.toLowerCase();

    // 1. Content-based: add to every chapter where concept name appears in blocks
    for (const ch of normalizedChapters) {
      if (chapterTextMap.get(ch.id)?.includes(needle)) {
        byChapter.get(ch.id)?.push(concept);
        matched = true;
      }
    }

    // 2. Timestamp-based: also add to the chapter matching by time range
    if (concept.timestamp) {
      const conceptSeconds = parseTimestamp(concept.timestamp);
      if (conceptSeconds > 0 || concept.timestamp === "0:00") {
        const timeChapter = normalizedChapters.find(
          (c) => conceptSeconds >= c.startSeconds && conceptSeconds < c.endSeconds
        );
        if (timeChapter) {
          // Avoid duplicate if content already matched this same chapter
          const existing = byChapter.get(timeChapter.id);
          if (existing && !existing.includes(concept)) {
            existing.push(concept);
          }
          matched = true;
        }
      }
    }

    if (!matched) {
      orphaned.push(concept);
    }
  }

  return { byChapter, orphaned };
}
