import type { ContentBlock } from '@vie/types';
import {
  // Existing blocks
  KeyValueRenderer,
  ComparisonRenderer,
  TimestampRenderer,
  QuoteRenderer,
  StatisticRenderer,
  BulletsBlock,
  NumberedBlock,
  ExampleBlock,
  CalloutBlock,
  // New universal blocks (V2.1)
  TranscriptBlock,
  DosDontsBlock,
  TimelineBlock,
  DefinitionBlock,
  ToolListBlock,
  // Cooking blocks (V2.1)
  IngredientBlock,
  StepBlock,
  NutritionBlock,
  // Coding blocks (V2.1)
  CodeBlock,
  TerminalBlock,
  FileTreeBlock,
  // Travel blocks (V2.1)
  LocationBlock,
  ItineraryBlock,
  CostBlock,
  // Review blocks (V2.1)
  ProConBlock,
  RatingBlock,
  VerdictBlock,
  // Fitness blocks (V2.1)
  ExerciseBlock,
  WorkoutTimerBlock,
  // Education blocks (V2.1)
  QuizBlock,
  FormulaBlock,
  // Podcast blocks (V2.1)
  GuestBlock,
} from './blocks';

interface ContentBlockRendererProps {
  block: ContentBlock;
  onSeek?: (seconds: number) => void;
  /** Triggers video collapse at timestamp - preferred over onSeek */
  onPlay?: (seconds: number) => void;
  /** Stop video playback */
  onStop?: () => void;
  /** Whether video is currently playing in this section */
  isVideoActive?: boolean;
  /** The timestamp (seconds) currently playing */
  activeStartSeconds?: number;
}

/**
 * Renders a single content block based on its type.
 * Pure presentational component - receives props, renders UI.
 * Delegates to specialized block components for each type.
 *
 * V2.1: Now supports 31 block types across all categories.
 */
export function ContentBlockRenderer({
  block,
  onSeek,
  onPlay,
  onStop,
  isVideoActive,
  activeStartSeconds,
}: ContentBlockRendererProps) {
  // Defensive check for null/undefined or malformed block
  if (!block || typeof block !== 'object' || !('type' in block)) {
    return null;
  }

  switch (block.type) {
    // ─────────────────────────────────────────────────────
    // Existing blocks
    // ─────────────────────────────────────────────────────
    case 'paragraph':
      return (
        <div className="relative pl-3 border-l-2 border-border/50">
          <p className="text-muted-foreground leading-[1.75]">{block.text}</p>
        </div>
      );

    case 'bullets':
      if (!Array.isArray(block.items)) return null;
      return <BulletsBlock items={block.items} variant={block.variant} />;

    case 'numbered':
      if (!Array.isArray(block.items)) return null;
      return <NumberedBlock items={block.items} variant={block.variant} />;

    case 'do_dont':
      return <DosDontsBlock block={block} />;

    case 'example':
      return (
        <ExampleBlock
          title={block.title}
          code={block.code}
          explanation={block.explanation}
          variant={block.variant}
        />
      );

    case 'callout':
      return <CalloutBlock style={block.style} variant={block.variant} text={block.text} />;

    case 'definition':
      return <DefinitionBlock block={block} />;

    case 'keyvalue':
      return <KeyValueRenderer block={block} />;

    case 'comparison':
      return <ComparisonRenderer block={block} />;

    case 'timestamp':
      return (
        <TimestampRenderer
          block={block}
          onSeek={onSeek}
          onPlay={onPlay}
          onStop={onStop}
          isActive={isVideoActive && activeStartSeconds === block.seconds}
        />
      );

    case 'quote':
      return <QuoteRenderer block={block} onSeek={onSeek} />;

    case 'statistic':
      return <StatisticRenderer block={block} />;

    // ─────────────────────────────────────────────────────
    // New universal blocks (V2.1)
    // ─────────────────────────────────────────────────────
    case 'transcript':
      return (
        <TranscriptBlock
          block={block}
          onSeek={onSeek}
          onPlay={onPlay}
          activeSeconds={activeStartSeconds}
        />
      );

    case 'timeline':
      return <TimelineBlock block={block} />;

    case 'tool_list':
      return <ToolListBlock block={block} />;

    // ─────────────────────────────────────────────────────
    // Cooking blocks (V2.1)
    // ─────────────────────────────────────────────────────
    case 'ingredient':
      return <IngredientBlock block={block} />;

    case 'step':
      return <StepBlock block={block} />;

    case 'nutrition':
      return <NutritionBlock block={block} />;

    // ─────────────────────────────────────────────────────
    // Coding blocks (V2.1)
    // ─────────────────────────────────────────────────────
    case 'code':
      return <CodeBlock block={block} />;

    case 'terminal':
      return <TerminalBlock block={block} />;

    case 'file_tree':
      return <FileTreeBlock block={block} />;

    // ─────────────────────────────────────────────────────
    // Travel blocks (V2.1)
    // ─────────────────────────────────────────────────────
    case 'location':
      return <LocationBlock block={block} />;

    case 'itinerary':
      return <ItineraryBlock block={block} />;

    case 'cost':
      return <CostBlock block={block} />;

    // ─────────────────────────────────────────────────────
    // Review blocks (V2.1)
    // ─────────────────────────────────────────────────────
    case 'pro_con':
      return <ProConBlock block={block} />;

    case 'rating':
      return <RatingBlock block={block} />;

    case 'verdict':
      return <VerdictBlock block={block} />;

    // ─────────────────────────────────────────────────────
    // Fitness blocks (V2.1)
    // ─────────────────────────────────────────────────────
    case 'exercise':
      return <ExerciseBlock block={block} onPlay={onPlay} />;

    case 'workout_timer':
      return <WorkoutTimerBlock block={block} />;

    // ─────────────────────────────────────────────────────
    // Education blocks (V2.1)
    // ─────────────────────────────────────────────────────
    case 'quiz':
      return <QuizBlock block={block} />;

    case 'formula':
      return <FormulaBlock block={block} />;

    // ─────────────────────────────────────────────────────
    // Podcast blocks (V2.1)
    // ─────────────────────────────────────────────────────
    case 'guest':
      return <GuestBlock block={block} />;

    default: {
      // Handle unknown block types gracefully
      const unknownBlock = block as { type: string; text?: string };

      // Log warning in development for debugging
      if (import.meta.env.DEV) {
        console.warn(`Unknown content block type: ${unknownBlock.type}`, block);
      }

      // Attempt graceful fallback for text-like blocks
      if ('text' in unknownBlock && typeof unknownBlock.text === 'string') {
        return (
          <div className="relative pl-3 border-l-2 border-border/50">
            <p className="text-muted-foreground leading-[1.75]">{unknownBlock.text}</p>
          </div>
        );
      }

      return null;
    }
  }
}
