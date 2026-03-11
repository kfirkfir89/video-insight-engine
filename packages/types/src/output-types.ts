// ═══════════════════════════════════════════════════
// Output Types — Triage Pipeline
// ═══════════════════════════════════════════════════

import type { ContentTag, TabDefinition } from './vie-response.js';

// OutputType is an alias for ContentTag — kept for backward compatibility.
export type OutputType = ContentTag;

export const OUTPUT_TYPE_VALUES: readonly OutputType[] = [
  'travel', 'food', 'tech', 'fitness',
  'music', 'learning', 'review', 'project',
] as const;

export function isValidOutputType(value: string): value is OutputType {
  return OUTPUT_TYPE_VALUES.includes(value as OutputType);
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

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface Flashcard {
  front: string;
  back: string;
}

export interface CodeCheatSheetItem {
  title: string;
  code: string;
  description: string;
}

export interface ScenarioOption {
  text: string;
  correct: boolean;
  explanation: string;
}

export interface ScenarioItem {
  question: string;
  emoji?: string;
  options: ScenarioOption[];
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
  triage: {
    contentTags: ContentTag[];
    modifiers: string[];
    primaryTag: ContentTag;
    userGoal: string;
    tabs: TabDefinition[];
    confidence: number;
  };
  output: Record<string, unknown> | null;
  synthesis: SynthesisResult | null;
  enrichment: EnrichmentData | null;
}
