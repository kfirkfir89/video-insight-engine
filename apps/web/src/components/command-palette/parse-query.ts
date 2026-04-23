import type { ProcessingStatus } from "@vie/types";

/**
 * Status operators recognized in the command palette.
 *   is:processing  matches videos still in the pipeline (pending + processing)
 *   is:done        matches completed videos
 *   is:failed      matches failed videos
 *
 * Operators compose with free-text: `is:failed meditation` filters to failed
 * videos whose title/channel contains "meditation". Multiple operators in one
 * query are unioned (`is:done is:failed` = completed OR failed), matching how
 * users read them aloud.
 */
const STATUS_MAP: Record<string, ProcessingStatus[]> = {
  processing: ["pending", "processing"],
  done: ["completed"],
  complete: ["completed"],
  completed: ["completed"],
  failed: ["failed"],
  error: ["failed"],
};

export interface ParsedPaletteQuery {
  /** Free-text portion with is:* operators stripped and whitespace collapsed. */
  textQuery: string;
  /** Allowed statuses, or null when no status operator was used. */
  statusFilter: ProcessingStatus[] | null;
}

export function parsePaletteQuery(raw: string): ParsedPaletteQuery {
  const tokens = raw.trim().split(/\s+/).filter(Boolean);
  const statuses = new Set<ProcessingStatus>();
  const textTokens: string[] = [];

  for (const token of tokens) {
    const lower = token.toLowerCase();
    if (lower.startsWith("is:")) {
      const key = lower.slice(3);
      const mapped = STATUS_MAP[key];
      if (mapped) {
        mapped.forEach((s) => statuses.add(s));
        continue;
      }
    }
    textTokens.push(token);
  }

  return {
    textQuery: textTokens.join(" "),
    statusFilter: statuses.size > 0 ? Array.from(statuses) : null,
  };
}
