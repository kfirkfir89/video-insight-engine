// ═══════════════════════════════════════════════════
// Output Types — Triage Pipeline
// ═══════════════════════════════════════════════════

import type { ContentTag, ScenarioItem, TriageResult, VIEResponseMeta, TabEntry } from './vie-response.js';
import { CONTENT_TAG_VALUES } from '@vie/shared/config';

// OutputType is an alias for ContentTag — kept for backward compatibility.
export type OutputType = ContentTag;

export const OUTPUT_TYPE_VALUES: readonly OutputType[] = CONTENT_TAG_VALUES;

export function isValidOutputType(value: string): value is OutputType {
  return CONTENT_TAG_VALUES.includes(value as OutputType);
}

// ─────────────────────────────────────────────────────
// Synthesis
// ─────────────────────────────────────────────────────

export interface SynthesisResult {
  tldr: string;
  keyTakeaways: string[];
  masterSummary: string;
  seoDescription: string;
}

// ─────────────────────────────────────────────────────
// Enrichment Data
// ─────────────────────────────────────────────────────

// Import shared primitives from vie-response (canonical location)
import type { QuizQuestion, Flashcard } from './vie-response.js';
export type { QuizQuestion, Flashcard };

export interface CodeCheatSheetItem {
  title: string;
  code: string;
  description: string;
}

export interface EnrichmentData {
  quiz?: QuizQuestion[];
  flashcards?: Flashcard[];
  cheatSheet?: CodeCheatSheetItem[];
  scenarios?: ScenarioItem[];
}

// ─────────────────────────────────────────────────────
// Video Output (triage-based)
// ─────────────────────────────────────────────────────

export interface VideoOutput {
  triage: TriageResult;
  output: Record<string, unknown> | null;
  synthesis: SynthesisResult | null;
  enrichment: EnrichmentData | null;
  // v2: Assembled output (component-addressed tabs)
  assembledMeta?: VIEResponseMeta | null;
  assembledTabs?: TabEntry[] | null;
}
