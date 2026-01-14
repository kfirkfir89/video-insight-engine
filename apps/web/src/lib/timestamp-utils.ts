import type { Concept, Section } from "@vie/types";

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
 * Result of matching concepts to sections
 */
export interface ConceptMatchResult {
  /** Map of section ID to matched concepts */
  bySection: Map<string, Concept[]>;
  /** Concepts that couldn't be matched to any section (no timestamp or out of range) */
  orphaned: Concept[];
}

/**
 * Normalize sections to ensure endSeconds is properly set.
 * If endSeconds is 0 or missing, calculate it from the next section's startSeconds.
 */
function normalizeSectionRanges(sections: Section[]): Section[] {
  if (sections.length === 0) return [];

  // Sort by startSeconds to calculate end times
  const sorted = [...sections].sort((a, b) => a.startSeconds - b.startSeconds);

  // Create a map of section ID to calculated endSeconds
  const endSecondsMap = new Map<string, number>();
  sorted.forEach((section, index) => {
    if (section.endSeconds > section.startSeconds) {
      // endSeconds is valid, use it
      endSecondsMap.set(section.id, section.endSeconds);
    } else {
      // Calculate from next section or use Infinity for last section
      const nextSection = sorted[index + 1];
      endSecondsMap.set(section.id, nextSection ? nextSection.startSeconds : Infinity);
    }
  });

  // Return sections in ORIGINAL order with fixed endSeconds
  return sections.map((section) => ({
    ...section,
    endSeconds: endSecondsMap.get(section.id) ?? section.endSeconds,
  }));
}

/**
 * Match concepts to sections based on timestamp overlap.
 * A concept matches a section if its timestamp falls within [startSeconds, endSeconds).
 *
 * Fixes endSeconds=0 issues by calculating from next section's startSeconds.
 */
export function matchConceptsToSections(
  concepts: Concept[],
  sections: Section[]
): ConceptMatchResult {
  const bySection = new Map<string, Concept[]>();
  const orphaned: Concept[] = [];

  if (sections.length === 0) {
    return { bySection, orphaned: concepts };
  }

  // Normalize sections to fix missing endSeconds values
  const normalizedSections = normalizeSectionRanges(sections);

  // Initialize all sections with empty arrays
  normalizedSections.forEach((s) => bySection.set(s.id, []));

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

    // Find matching section by time range
    const matchingSection = normalizedSections.find(
      (s) => conceptSeconds >= s.startSeconds && conceptSeconds < s.endSeconds
    );

    if (matchingSection) {
      bySection.get(matchingSection.id)?.push(concept);
    } else {
      orphaned.push(concept);
    }
  }

  return { bySection, orphaned };
}
