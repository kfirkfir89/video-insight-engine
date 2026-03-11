import { Component, type ReactNode } from 'react';
import type { ContentBlock } from '@vie/types';
import { InlineEditor } from './InlineEditor';
import {
  // Lists
  ListBlock,
  // Data display
  KeyValueRenderer,
  ComparisonRenderer,
  TimestampRenderer,
  QuoteRenderer,
  StatisticRenderer,
  CalloutBlock,
  // Universal blocks
  TimelineBlock,
  DefinitionBlock,
  // Cooking blocks
  StepBlock,
  // Coding blocks (CodeBlock handles code, example, terminal)
  CodeBlock,
  // Review blocks
  VerdictBlock,
  // Unified blocks
  FitnessBlock,
  ChecklistBlock,
  // Education blocks
  QuizBlock,
  // Generic blocks
  TableBlock,
} from './blocks';

/** Error boundary that catches crashes in individual block renderers */
class BlockErrorBoundary extends Component<
  { type: string; children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="text-xs text-muted-foreground/50 py-1">
          Failed to render {this.props.type} block
        </div>
      );
    }
    return this.props.children;
  }
}

/** Fallback type for unrecognized block types */
interface UnknownBlock {
  type: string;
  text?: string;
}

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
  /** Enable inline editing for text blocks */
  editable?: boolean;
  /** Called when an editable block is saved */
  onBlockEdit?: (updatedBlock: ContentBlock) => void;
}

/**
 * Renders a single content block based on its type.
 * Pure presentational component - receives props, renders UI.
 * Delegates to specialized block components for each type.
 *
 * Supports 27 block types across all categories.
 */
export function ContentBlockRenderer({
  block,
  onSeek,
  onPlay,
  onStop,
  isVideoActive,
  activeStartSeconds,
  editable,
  onBlockEdit,
}: ContentBlockRendererProps) {
  // Defensive check for null/undefined or malformed block
  if (!block || typeof block !== 'object' || !('type' in block)) {
    return null;
  }

  const rendered = renderBlock({ block, onSeek, onPlay, onStop, isVideoActive, activeStartSeconds, editable, onBlockEdit });
  if (!rendered) return null;

  return (
    <BlockErrorBoundary type={block.type}>
      {rendered}
    </BlockErrorBoundary>
  );
}

function renderBlock({
  block,
  onSeek,
  onPlay,
  onStop,
  isVideoActive,
  activeStartSeconds,
  editable,
  onBlockEdit,
}: ContentBlockRendererProps): React.ReactNode {
  switch (block.type) {
    // ─────────────────────────────────────────────────────
    // Text & Lists
    // ─────────────────────────────────────────────────────
    case 'paragraph':
      if (editable && onBlockEdit) {
        return (
          <div className="block-paragraph max-w-prose">
            <InlineEditor
              value={block.text}
              onSave={(newText) => onBlockEdit({ ...block, text: newText })}
            />
          </div>
        );
      }
      return (
        <div className="block-paragraph max-w-prose">
          <p className="text-foreground/90 text-[15px] leading-[1.75]">
            {block.text}
          </p>
        </div>
      );

    case 'bullets':
      if (!Array.isArray(block.items)) return null;
      return <ListBlock items={block.items} variant={block.variant} />;

    case 'numbered':
      if (!Array.isArray(block.items)) return null;
      return (
        <StepBlock
          block={{
            blockId: block.blockId,
            type: 'step',
            steps: block.items.map((item, i) => ({ number: i + 1, instruction: item })),
          }}
          simple
        />
      );

    case 'do_dont':
      return <ComparisonRenderer block={{
        type: 'comparison',
        variant: 'dos_donts',
        left: { label: 'Do', items: block.do || [] },
        right: { label: "Don't", items: block.dont || [] },
      } as ContentBlock & { type: 'comparison' }} />;

    case 'example':
      return <CodeBlock code={block.code} explanation={block.explanation} />;

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
    // Universal blocks
    // ─────────────────────────────────────────────────────
    case 'timeline':
      return <TimelineBlock block={block} />;

    // ─────────────────────────────────────────────────────
    // Checklist blocks (unified)
    // ─────────────────────────────────────────────────────
    case 'tool_list':
      return <ChecklistBlock block={block} />;

    case 'ingredient':
      return <ChecklistBlock block={block} />;

    // ─────────────────────────────────────────────────────
    // Cooking blocks
    // ─────────────────────────────────────────────────────
    case 'step':
      return <StepBlock block={block} />;

    // ─────────────────────────────────────────────────────
    // Coding blocks
    // ─────────────────────────────────────────────────────
    case 'code':
      return <CodeBlock block={block} />;

    case 'terminal':
      return <CodeBlock block={block} />;

    // ─────────────────────────────────────────────────────
    // Review blocks
    // ─────────────────────────────────────────────────────
    case 'pro_con':
      return <ComparisonRenderer block={{
        type: 'comparison',
        variant: 'pros_cons',
        left: { label: 'Pros', items: block.pros || [] },
        right: { label: 'Cons', items: block.cons || [] },
      } as ContentBlock & { type: 'comparison' }} />;

    case 'verdict':
      return <VerdictBlock block={block} />;

    // ─────────────────────────────────────────────────────
    // Fitness blocks (unified)
    // ─────────────────────────────────────────────────────
    case 'exercise':
      return <FitnessBlock block={block} onPlay={onPlay} />;

    case 'workout_timer':
      return <FitnessBlock block={block} />;

    // ─────────────────────────────────────────────────────
    // Education blocks
    // ─────────────────────────────────────────────────────
    case 'quiz':
      return <QuizBlock block={block} />;

    // ─────────────────────────────────────────────────────
    // Generic blocks
    // ─────────────────────────────────────────────────────
    case 'table':
      return <TableBlock block={block} />;

    default: {
      // Handle unknown block types gracefully
      const unknownBlock = block as UnknownBlock;

      if (import.meta.env.DEV) {
        console.warn(`Unknown content block type: ${unknownBlock.type}`, block);
      }

      if ('text' in unknownBlock && typeof unknownBlock.text === 'string') {
        return (
          <div className="block-paragraph max-w-prose">
            <p className="text-foreground/90 text-[15px] leading-[1.75]">{unknownBlock.text}</p>
          </div>
        );
      }

      return null;
    }
  }
}
