import { Check, X, Code2, Copy, ChefHat, UtensilsCrossed, Square } from 'lucide-react';
import { memo, useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import type { ContentBlock, CalloutStyle } from '@vie/types';
import { KeyValueRenderer } from './blocks/KeyValueRenderer';
import { ComparisonRenderer } from './blocks/ComparisonRenderer';
import { TimestampRenderer } from './blocks/TimestampRenderer';
import { QuoteRenderer } from './blocks/QuoteRenderer';
import { StatisticRenderer } from './blocks/StatisticRenderer';

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
 * Supports variant styling for specialized content (recipes, code tutorials, etc.)
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
        <ExampleBlockComponent
          title={block.title}
          code={block.code}
          explanation={block.explanation}
          variant={block.variant}
        />
      );

    case 'callout':
      return <CalloutBlockComponent style={block.style} variant={block.variant} text={block.text} />;

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

// ─────────────────────────────────────────────────────
// Bullets Block with variant support
// ─────────────────────────────────────────────────────

interface BulletsBlockProps {
  items: string[];
  variant?: string;
}

const BulletsBlock = memo(function BulletsBlock({ items, variant }: BulletsBlockProps) {
  // Ingredients variant: warm amber styling for recipe content
  const isIngredients = variant === 'ingredients';
  // Checklist variant: checkbox-style for todo/action items
  const isChecklist = variant === 'checklist';

  return (
    <div
      className={cn(
        isIngredients && 'border-l-2 border-amber-400/50 pl-3'
      )}
    >
      {isIngredients && (
        <div className="flex items-center gap-1.5 mb-2">
          <UtensilsCrossed className="h-3.5 w-3.5 text-muted-foreground/60" aria-hidden="true" />
          <span className="text-xs text-muted-foreground/70">ingredients</span>
        </div>
      )}
      <ul className={cn('space-y-1', isChecklist && 'pl-0.5')}>
        {items.map((item, index) => (
          <li
            key={index}
            className="flex items-baseline gap-2.5 text-sm"
          >
            {isChecklist ? (
              <Square className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60 translate-y-0.5" aria-hidden="true" />
            ) : (
              <span className="w-1 h-1 rounded-full bg-muted-foreground/50 shrink-0 translate-y-1.5" />
            )}
            <span className="text-muted-foreground">
              {item}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
});

// ─────────────────────────────────────────────────────
// Numbered Block with variant support
// ─────────────────────────────────────────────────────

interface NumberedBlockProps {
  items: string[];
  variant?: string;
}

const NumberedBlock = memo(function NumberedBlock({ items, variant }: NumberedBlockProps) {
  // Cooking steps variant: emerald accent for recipe steps
  const isCookingSteps = variant === 'cooking_steps';

  return (
    <div
      className={cn(
        isCookingSteps && 'border-l-2 border-emerald-400/50 pl-3'
      )}
    >
      {isCookingSteps && (
        <div className="flex items-center gap-1.5 mb-2">
          <ChefHat className="h-3.5 w-3.5 text-muted-foreground/60" aria-hidden="true" />
          <span className="text-xs text-muted-foreground/70">steps</span>
        </div>
      )}
      <ol className="space-y-2">
        {items.map((item, index) => (
          <li key={index} className="flex items-baseline gap-2.5 text-sm">
            <span
              className={cn(
                'w-5 shrink-0 text-right font-medium tabular-nums',
                isCookingSteps
                  ? 'text-emerald-600/70 dark:text-emerald-400/70'
                  : 'text-muted-foreground/70'
              )}
            >
              {index + 1}.
            </span>
            <span className="text-muted-foreground">
              {item}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
});

// ─────────────────────────────────────────────────────
// Example block with variant support
// ─────────────────────────────────────────────────────

interface ExampleBlockComponentProps {
  title?: string;
  code: string;
  explanation?: string;
  variant?: string;
}

const ExampleBlockComponent = memo(function ExampleBlockComponent({ title, code, explanation, variant }: ExampleBlockComponentProps) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timeout on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      // Clear any existing timeout before setting a new one
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Clipboard API may fail in certain contexts (non-HTTPS, iframe restrictions)
      // Fail silently - user can still manually copy
      if (import.meta.env.DEV) {
        console.warn('Failed to copy to clipboard:', err);
      }
    }
  }, [code]);

  // Terminal command variant: minimal single-panel design
  const isTerminal = variant === 'terminal_command';

  // Terminal variant: ultra-minimal
  if (isTerminal) {
    return (
      <div className="rounded-lg bg-zinc-950 dark:bg-black p-3 overflow-hidden">
        <div className="flex items-center justify-between">
          <pre className="text-sm overflow-x-auto">
            <code className="font-mono text-emerald-400">
              <span className="text-emerald-500/70 mr-2">$</span>
              {code}
            </code>
          </pre>
          <button
            onClick={handleCopy}
            aria-label={copied ? 'Copied to clipboard' : 'Copy code to clipboard'}
            className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 ml-3 shrink-0"
          >
            <Copy className="h-3 w-3" aria-hidden="true" />
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        {explanation && (
          <p className="mt-2 text-xs text-zinc-500">{explanation}</p>
        )}
      </div>
    );
  }

  // Default code example
  return (
    <div className="rounded-lg border overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b bg-muted/50">
        <div className="flex items-center gap-1.5">
          <Code2 className="h-3.5 w-3.5 text-muted-foreground/60" aria-hidden="true" />
          <span className="text-xs text-muted-foreground/70">
            {title || 'Example'}
          </span>
        </div>
        <button
          onClick={handleCopy}
          aria-label={copied ? 'Copied to clipboard' : 'Copy code to clipboard'}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Copy className="h-3 w-3" aria-hidden="true" />
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      {/* Code area */}
      <div className="bg-zinc-950 dark:bg-zinc-900 px-4 py-3">
        <pre className="text-sm overflow-x-auto">
          <code className="font-mono text-zinc-300">{code}</code>
        </pre>
      </div>
      {/* Explanation footer */}
      {explanation && (
        <div className="px-3 py-2 border-t bg-muted/30">
          <p className="text-sm text-muted-foreground">{explanation}</p>
        </div>
      )}
    </div>
  );
});

// ─────────────────────────────────────────────────────
// Callout block with variant support
// ─────────────────────────────────────────────────────

interface CalloutBlockComponentProps {
  style: CalloutStyle;
  variant?: string;
  text: string;
}

const CalloutBlockComponent = memo(function CalloutBlockComponent({ style, variant, text }: CalloutBlockComponentProps) {
  // Chef tip variant: warm amber styling
  const isChefTip = variant === 'chef_tip';

  // Simple border color mapping - no icons or labels, just colored border
  const borderClasses: Record<CalloutStyle, string> = {
    tip: isChefTip ? 'border-orange-400/60' : 'border-amber-400/60',
    warning: 'border-rose-400/60',
    note: 'border-sky-400/60',
    chef_tip: 'border-orange-400/60',
    security: 'border-rose-500/60',
  };

  const borderClass = borderClasses[style] || borderClasses.note;

  return (
    <div className={cn('py-2 pl-3 border-l-2 text-sm text-muted-foreground', borderClass)}>
      {text}
    </div>
  );
});
