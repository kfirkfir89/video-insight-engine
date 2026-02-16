import type { Concept, ContentBlock, SummaryChapter } from "@vie/types";
import { getNameVariants } from "./concept-utils";

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

  // Quiz blocks: extract question text and explanations
  if ("questions" in block && Array.isArray(block.questions)) {
    for (const q of block.questions) {
      if (q?.question) parts.push(q.question);
      if (q?.explanation) parts.push(q.explanation);
    }
  }

  // Itinerary blocks: extract activity names and notes
  if ("days" in block && Array.isArray(block.days)) {
    for (const day of block.days) {
      if (day?.title) parts.push(day.title);
      if (Array.isArray(day?.activities)) {
        for (const activity of day.activities) {
          if (activity?.activity) parts.push(activity.activity);
          if (activity?.notes) parts.push(activity.notes);
        }
      }
    }
  }

  // Terminal blocks: extract command and output
  if ("command" in block && typeof block.command === "string") {
    parts.push(block.command);
  }
  if ("output" in block && typeof block.output === "string") {
    parts.push(block.output);
  }

  // Comparison blocks: extract column labels and items
  if ("left" in block && typeof block.left === "object" && block.left != null) {
    const left = block.left as Record<string, unknown>;
    if (typeof left.label === "string") parts.push(left.label);
    if (Array.isArray(left.items)) {
      for (const item of left.items) {
        if (typeof item === "string") parts.push(item);
      }
    }
  }
  if ("right" in block && typeof block.right === "object" && block.right != null) {
    const right = block.right as Record<string, unknown>;
    if (typeof right.label === "string") parts.push(right.label);
    if (Array.isArray(right.items)) {
      for (const item of right.items) {
        if (typeof item === "string") parts.push(item);
      }
    }
  }

  return parts.join(" ");
}

/**
 * Match each concept to exactly ONE chapter (deduplication).
 *
 * Assignment priority:
 * 1. First content match — assign to the FIRST chapter (in array order) whose
 *    content mentions the concept name.
 * 2. Timestamp fallback — if no content match, assign to the chapter whose
 *    time range contains the concept's timestamp.
 * 3. Orphan — if neither signal matches, the concept is orphaned.
 *
 * Within each chapter, concepts are sorted by their first content-mention
 * position (character offset), so they appear in reading order.
 *
 * Each chapter highlights only its own per-chapter concepts (no global allConcepts).
 */
export function matchConceptsToChapters(
  concepts: Concept[],
  chapters: SummaryChapter[]
): ConceptMatchResult {
  const byChapter = new Map<string, { concept: Concept; contentOffset: number }[]>();
  const orphaned: Concept[] = [];

  if (chapters.length === 0) {
    return { byChapter: new Map(), orphaned: concepts };
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
    let assignedChapterId: string | null = null;
    let contentOffset = Infinity;

    // 0. chapterIndex fast path: if the backend provided a chapter index, use it directly
    if (concept.chapterIndex != null) {
      const targetChapter = normalizedChapters[concept.chapterIndex];
      if (targetChapter) {
        // Only assign to this chapter if the concept name actually appears in its content
        const needles = getNameVariants(concept.name, concept.aliases);
        const text = chapterTextMap.get(targetChapter.id) ?? "";
        for (const needle of needles) {
          const idx = text.indexOf(needle);
          if (idx !== -1) {
            assignedChapterId = targetChapter.id;
            contentOffset = idx;
            break;
          }
        }
      }
    }

    // 1. Content-based fallback: for old data without chapterIndex
    if (!assignedChapterId) {
      const needles = getNameVariants(concept.name, concept.aliases);
      //    Try each needle variant; use the first that matches any chapter.
      for (const needle of needles) {
        for (const ch of normalizedChapters) {
          const text = chapterTextMap.get(ch.id) ?? "";
          const idx = text.indexOf(needle);
          if (idx !== -1) {
            assignedChapterId = ch.id;
            contentOffset = idx;
            break;
          }
        }
        if (assignedChapterId) break;
      }
    }

    // 2. Timestamp fallback: if no content match, assign by time range
    if (!assignedChapterId && concept.timestamp) {
      const conceptSeconds = parseTimestamp(concept.timestamp);
      if (conceptSeconds > 0 || concept.timestamp === "0:00") {
        const timeChapter = normalizedChapters.find(
          (c) => conceptSeconds >= c.startSeconds && conceptSeconds < c.endSeconds
        );
        if (timeChapter) {
          assignedChapterId = timeChapter.id;
        }
      }
    }

    if (assignedChapterId) {
      byChapter.get(assignedChapterId)!.push({ concept, contentOffset });
    } else {
      orphaned.push(concept);
    }
  }

  // Sort each chapter's concepts by content position, then flatten
  const result = new Map<string, Concept[]>();
  for (const [chapterId, entries] of byChapter) {
    entries.sort((a, b) => a.contentOffset - b.contentOffset);
    result.set(chapterId, entries.map((e) => e.concept));
  }

  return { byChapter: result, orphaned };
}
