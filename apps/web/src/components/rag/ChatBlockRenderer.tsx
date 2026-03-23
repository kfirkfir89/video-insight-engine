import { Component, memo, type ReactNode } from 'react';
import {
  TextBlock,
  ListItems,
  CodeSnippet,
  Callout,
  KeyValue,
  QuoteBlock,
  DefinitionItem,
  TableView,
} from '@/components/vie';

/** Minimal runtime block shape — no compile-time union needed. */
interface ChatBlock {
  type: string;
  [key: string]: unknown;
}

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

interface ChatBlockRendererProps {
  block: ChatBlock;
  onPlay?: (seconds: number) => void;
}

/**
 * Slim block renderer for RAG chat messages.
 * Handles the ~8 block types the chat API actually produces,
 * using VIE primitives directly.
 */
export const ChatBlockRenderer = memo(function ChatBlockRenderer({
  block,
  onPlay,
}: ChatBlockRendererProps) {
  if (!block || typeof block !== 'object' || !('type' in block)) return null;

  const rendered = renderChatBlock(block, onPlay);
  if (!rendered) return null;

  return (
    <BlockErrorBoundary type={block.type}>
      {rendered}
    </BlockErrorBoundary>
  );
});

function renderChatBlock(block: ChatBlock, onPlay?: (seconds: number) => void): ReactNode {
  switch (block.type) {
    case 'paragraph':
      if (typeof block.text !== 'string') return null;
      return <TextBlock>{block.text}</TextBlock>;

    case 'bullets':
      if (!Array.isArray(block.items)) return null;
      return <ListItems items={block.items.filter((i): i is string => typeof i === 'string')} />;

    case 'numbered':
      if (!Array.isArray(block.items)) return null;
      return (
        <ol className="space-y-1 list-decimal list-inside">
          {block.items.filter((i): i is string => typeof i === 'string').map((item, i) => (
            <li key={i} className="text-sm text-muted-foreground">{item}</li>
          ))}
        </ol>
      );

    case 'code':
    case 'terminal':
    case 'example': {
      const code = block.type === 'terminal'
        ? [block.command, block.output].filter(Boolean).join('\n')
        : block.code;
      if (typeof code !== 'string') return null;
      return <CodeSnippet code={code} explanation={typeof block.explanation === 'string' ? block.explanation : undefined} />;
    }

    case 'callout': {
      if (typeof block.text !== 'string') return null;
      const validStyles = ['tip', 'warning', 'note', 'security', 'chef_tip'] as const;
      const style = validStyles.includes(block.style as typeof validStyles[number])
        ? block.style as typeof validStyles[number]
        : 'note';
      return <Callout style={style} text={block.text} />;
    }

    case 'keyvalue':
      if (!Array.isArray(block.items)) return null;
      return <KeyValue variant="info" items={block.items.filter(
        (i): i is { key: string; value: string } =>
          typeof i === 'object' && i !== null && typeof (i as Record<string, unknown>).key === 'string' && typeof (i as Record<string, unknown>).value === 'string'
      )} />;

    case 'quote':
      if (typeof block.text !== 'string') return null;
      return (
        <QuoteBlock
          text={block.text}
          attribution={typeof block.attribution === 'string' ? block.attribution : undefined}
          variant={(['speaker', 'testimonial', 'highlight'] as const).includes(block.variant as 'speaker')
            ? block.variant as 'speaker' | 'testimonial' | 'highlight'
            : 'speaker'}
        />
      );

    case 'definition':
      if (typeof block.term !== 'string' || typeof block.meaning !== 'string') return null;
      return <DefinitionItem term={block.term} meaning={block.meaning} />;

    case 'table':
      if (!Array.isArray(block.columns) || !Array.isArray(block.rows)) return null;
      return (
        <TableView
          columns={block.columns.filter(
            (c): c is { key: string; label: string } =>
              typeof c === 'object' && c !== null && typeof (c as Record<string, unknown>).key === 'string' && typeof (c as Record<string, unknown>).label === 'string'
          )}
          rows={block.rows.filter(
            (r): r is Record<string, string | number> => typeof r === 'object' && r !== null
          )}
        />
      );

    case 'timestamp': {
      if (typeof block.seconds !== 'number') return null;
      const label = typeof block.label === 'string' ? block.label : '';
      return (
        <button
          onClick={() => onPlay?.(block.seconds as number)}
          className="text-xs font-mono text-primary hover:underline cursor-pointer"
          disabled={!onPlay}
        >
          {formatTimestamp(block.seconds as number)} — {label}
        </button>
      );
    }

    default: {
      // Fallback: render text if available
      if ('text' in block && typeof block.text === 'string') {
        return <TextBlock>{block.text}</TextBlock>;
      }
      return null;
    }
  }
}

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
