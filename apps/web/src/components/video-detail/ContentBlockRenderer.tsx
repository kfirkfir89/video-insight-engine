import { Lightbulb, AlertTriangle, Info, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ContentBlock } from '@vie/types';

interface ContentBlockRendererProps {
  block: ContentBlock;
}

/**
 * Renders a single content block based on its type.
 * Pure presentational component - receives props, renders UI.
 */
export function ContentBlockRenderer({ block }: ContentBlockRendererProps) {
  switch (block.type) {
    case 'paragraph':
      return (
        <p className="text-muted-foreground leading-relaxed">
          {block.text}
        </p>
      );

    case 'bullets':
      return (
        <ul className="space-y-2">
          {block.items.map((item, index) => (
            <li key={index} className="flex gap-2.5 text-sm">
              <span className="text-primary mt-0.5 shrink-0">&#8226;</span>
              <span className="text-muted-foreground">{item}</span>
            </li>
          ))}
        </ul>
      );

    case 'numbered':
      return (
        <ol className="space-y-2">
          {block.items.map((item, index) => (
            <li key={index} className="flex gap-2.5 text-sm">
              <span className="text-primary font-medium mt-0.5 shrink-0 min-w-[1.25rem]">
                {index + 1}.
              </span>
              <span className="text-muted-foreground">{item}</span>
            </li>
          ))}
        </ol>
      );

    case 'do_dont':
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Do column */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-green-600 dark:text-green-400">
              <Check className="h-4 w-4" />
              <span>Do</span>
            </div>
            <ul className="space-y-1.5">
              {block.do.map((item, index) => (
                <li key={index} className="flex gap-2 text-sm">
                  <Check className="h-4 w-4 mt-0.5 shrink-0 text-green-600 dark:text-green-400" />
                  <span className="text-muted-foreground">{item}</span>
                </li>
              ))}
            </ul>
          </div>
          {/* Don't column */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-red-600 dark:text-red-400">
              <X className="h-4 w-4" />
              <span>Don't</span>
            </div>
            <ul className="space-y-1.5">
              {block.dont.map((item, index) => (
                <li key={index} className="flex gap-2 text-sm">
                  <X className="h-4 w-4 mt-0.5 shrink-0 text-red-600 dark:text-red-400" />
                  <span className="text-muted-foreground">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      );

    case 'example':
      return (
        <div className="bg-muted/30 rounded-lg border p-4 space-y-2">
          {block.title && (
            <div className="text-sm font-medium">{block.title}</div>
          )}
          <pre className="text-sm bg-muted/50 rounded p-3 overflow-x-auto">
            <code className="font-mono text-muted-foreground">{block.code}</code>
          </pre>
          {block.explanation && (
            <p className="text-sm text-muted-foreground">{block.explanation}</p>
          )}
        </div>
      );

    case 'callout':
      return <CalloutBlock style={block.style} text={block.text} />;

    case 'definition':
      return (
        <div className="bg-muted/50 rounded-lg border p-4">
          <span className="font-semibold">{block.term}</span>
          <span className="text-muted-foreground"> — {block.meaning}</span>
        </div>
      );

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

// Callout styling based on style variant
interface CalloutBlockProps {
  style: 'tip' | 'warning' | 'note';
  text: string;
}

function CalloutBlock({ style, text }: CalloutBlockProps) {
  const variants = {
    tip: {
      icon: Lightbulb,
      containerClass: 'border-amber-500/50 bg-amber-50 dark:bg-amber-950/30',
      iconClass: 'text-amber-600 dark:text-amber-400',
    },
    warning: {
      icon: AlertTriangle,
      containerClass: 'border-red-500/50 bg-red-50 dark:bg-red-950/30',
      iconClass: 'text-red-600 dark:text-red-400',
    },
    note: {
      icon: Info,
      containerClass: 'border-blue-500/50 bg-blue-50 dark:bg-blue-950/30',
      iconClass: 'text-blue-600 dark:text-blue-400',
    },
  };

  const variant = variants[style];
  const Icon = variant.icon;

  return (
    <div className={cn('flex gap-3 rounded-lg border p-4', variant.containerClass)}>
      <Icon className={cn('h-5 w-5 shrink-0 mt-0.5', variant.iconClass)} />
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
