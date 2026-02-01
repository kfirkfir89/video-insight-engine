import { Check, X } from 'lucide-react';
import type { ContentBlock } from '@vie/types';
import { KeyValueRenderer } from './blocks/KeyValueRenderer';
import { ComparisonRenderer } from './blocks/ComparisonRenderer';
import { TimestampRenderer } from './blocks/TimestampRenderer';
import { QuoteRenderer } from './blocks/QuoteRenderer';
import { StatisticRenderer } from './blocks/StatisticRenderer';
import { BulletsBlock } from './blocks/BulletsBlock';
import { NumberedBlock } from './blocks/NumberedBlock';
import { ExampleBlock } from './blocks/ExampleBlock';
import { CalloutBlock } from './blocks/CalloutBlock';

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
 */
export function ContentBlockRenderer({ block, onSeek, onPlay, onStop, isVideoActive, activeStartSeconds }: ContentBlockRendererProps) {
  // Defensive check for null/undefined or malformed block
  if (!block || typeof block !== 'object' || !('type' in block)) {
    return null;
  }

  switch (block.type) {
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
      if (!Array.isArray(block.do) || !Array.isArray(block.dont)) return null;
      return (
        <div className="rounded-lg border border-border/40 overflow-hidden">
          <div className="grid grid-cols-1 sm:grid-cols-2">
            {/* Do column */}
            <div className="p-4 sm:border-r border-border/40">
              <div className="flex items-center gap-1.5 pb-2 mb-3 border-b border-emerald-500/30">
                <Check className="h-3.5 w-3.5 text-emerald-600/80 dark:text-emerald-400/80" />
                <span className="text-xs font-medium text-emerald-600/80 dark:text-emerald-400/80">Do</span>
              </div>
              <ul className="space-y-1.5">
                {block.do.map((item, index) => (
                  <li key={index} className="flex items-baseline gap-2.5 text-sm">
                    <span className="w-1 h-1 rounded-full bg-emerald-500/60 shrink-0 translate-y-1.5" />
                    <span className="text-muted-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            {/* Don't column */}
            <div className="p-4 border-t sm:border-t-0 border-border/40">
              <div className="flex items-center gap-1.5 pb-2 mb-3 border-b border-rose-500/30">
                <X className="h-3.5 w-3.5 text-rose-600/80 dark:text-rose-400/80" />
                <span className="text-xs font-medium text-rose-600/80 dark:text-rose-400/80">Don't</span>
              </div>
              <ul className="space-y-1.5">
                {block.dont.map((item, index) => (
                  <li key={index} className="flex items-baseline gap-2.5 text-sm">
                    <span className="w-1 h-1 rounded-full bg-rose-500/60 shrink-0 translate-y-1.5" />
                    <span className="text-muted-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      );

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
      return (
        <div className="border-l-2 border-primary/30 pl-3">
          <dl>
            <dt className="text-sm font-medium">{block.term}</dt>
            <dd className="mt-0.5 text-sm text-muted-foreground">{block.meaning}</dd>
          </dl>
        </div>
      );

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

    default: {
      // Exhaustive type check - TypeScript will error if a case is missing
      const _exhaustiveCheck: never = block;
      // Log warning in development for debugging
      if (import.meta.env.DEV) {
        console.warn(`Unknown content block type: ${(_exhaustiveCheck as { type: string }).type}`);
      }
      return null;
    }
  }
}
