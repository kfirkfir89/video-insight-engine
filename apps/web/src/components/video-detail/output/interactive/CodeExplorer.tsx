import { memo, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, FileCode, Clock, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { GlassCard } from '../GlassCard';
import { CrossTabLink } from '../CrossTabLink';
import type { TechSnippet } from '@vie/types';

interface CodeExplorerProps {
  snippets: TechSnippet[];
  onSeek?: (seconds: number) => void;
  nextTab?: string;
  onNavigateTab?: (id: string) => void;
}

export const CodeExplorer = memo(function CodeExplorer({
  snippets,
  onSeek,
  nextTab,
  onNavigateTab,
}: CodeExplorerProps) {
  const [currentSnippet, setCurrentSnippet] = useState(0);
  const [copied, setCopied] = useState(false);

  const snippet = snippets[currentSnippet];
  const total = snippets.length;

  const prev = () => setCurrentSnippet((i) => Math.max(0, i - 1));
  const next = () => setCurrentSnippet((i) => Math.min(total - 1, i + 1));

  const handleCopy = useCallback(async () => {
    if (!snippet) return;
    try {
      await navigator.clipboard.writeText(snippet.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard may not be available
    }
  }, [snippet]);

  if (total === 0 || !snippet) return null;

  return (
    <div className="space-y-4">
      {/* Navigation header */}
      {total > 1 && (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={prev}
            disabled={currentSnippet === 0}
            className="gap-1 text-xs"
          >
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Prev
          </Button>
          <span className="text-xs text-muted-foreground tabular-nums">
            {currentSnippet + 1} of {total}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={next}
            disabled={currentSnippet === total - 1}
            className="gap-1 text-xs"
          >
            Next
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </div>
      )}

      {/* Snippet display */}
      <GlassCard variant="default" className="space-y-3 p-0 overflow-hidden">
        {/* Filename badge */}
        {snippet.filename && (
          <div className="flex items-center gap-1.5 px-4 pt-4 text-xs text-muted-foreground">
            <FileCode className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="font-mono">{snippet.filename}</span>
            <span className="ml-auto text-muted-foreground/50">{snippet.language}</span>
          </div>
        )}

        {/* Code block */}
        <div className="relative rounded-lg mx-3 bg-[oklch(12%_0_0)] text-[oklch(90%_0_0)] overflow-hidden">
          <button
            onClick={handleCopy}
            className={cn(
              'absolute top-2 right-2 z-10 flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors',
              copied ? 'text-success' : 'text-[oklch(50%_0_0)] hover:text-[oklch(75%_0_0)]',
            )}
            aria-label={copied ? 'Copied' : 'Copy code'}
          >
            {copied ? (
              <Check className="h-3 w-3" aria-hidden="true" />
            ) : (
              <Copy className="h-3 w-3" aria-hidden="true" />
            )}
          </button>
          <pre className="overflow-x-auto p-4 pr-16 text-sm leading-relaxed">
            <code className="font-mono whitespace-pre-wrap">{snippet.code}</code>
          </pre>
        </div>

        {/* Explanation */}
        <div className="px-4 pb-4 space-y-2">
          <p className="text-sm text-muted-foreground">{snippet.explanation}</p>

          {snippet.timestamp != null && onSeek && (
            <Button
              variant="ghost"
              size="bare"
              onClick={() => onSeek(snippet.timestamp!)}
              className="text-xs text-primary hover:underline gap-1"
            >
              <Clock className="h-3 w-3" aria-hidden="true" />
              Jump to timestamp
            </Button>
          )}
        </div>
      </GlassCard>

      {nextTab && onNavigateTab && (
        <CrossTabLink tabId={nextTab} label="Next section" onNavigate={onNavigateTab} />
      )}
    </div>
  );
});
