// ═══════════════════════════════════════════════════
// Content Block Exports — 19 Core Blocks + Wrapper
// ═══════════════════════════════════════════════════

// Accessibility wrapper
export { BlockWrapper } from './BlockWrapper';

// Pure display blocks
export { CalloutBlock } from './CalloutBlock';
export { ChecklistBlock } from './ChecklistBlock';
export { CodeBlock } from './CodeBlock';
export { ComparisonCard } from './ComparisonCard';
export { DefinitionBlock } from './DefinitionBlock';
export { ExerciseCard } from './ExerciseCard';
export { FlashCard } from './FlashCard';
export { KeyValueRow } from './KeyValueRow';
export { ListBlock } from './ListBlock';
export { QuizBlock } from './QuizBlock';
export { QuoteBlock } from './QuoteBlock';
export { ScenarioCard } from './ScenarioCard';
export { ScoreRing } from './ScoreRing';
export { SpotCard } from './SpotCard';
export { StatBlock } from './StatBlock';
export { StepBlock } from './StepBlock';
export { TableBlock } from './TableBlock';
export { TimelineEntry } from './TimelineEntry';
export { VerdictBlock } from './VerdictBlock';

// Backward-compatible aliases for imports using old names
export { ComparisonCard as ComparisonRenderer } from './ComparisonCard';
export { KeyValueRow as KeyValueRenderer } from './KeyValueRow';
export { StatBlock as StatisticRenderer } from './StatBlock';
export { QuoteBlock as QuoteRenderer } from './QuoteBlock';
export { ExerciseCard as FitnessBlock } from './ExerciseCard';
export { TimelineEntry as TimelineBlock } from './TimelineEntry';
export { TimelineEntry as TimestampRenderer } from './TimelineEntry';
