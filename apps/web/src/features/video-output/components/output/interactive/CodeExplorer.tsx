import { memo, useState, useCallback, useRef, useEffect } from 'react';
import { FileCode, Copy, Check, List } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { GlassCard, FadeIn, BackForward, Stepper, Badge, Timestamp } from '@/components/vie';

import type { TechSnippet } from '@vie/types';

interface CodeExplorerProps {
  snippets: TechSnippet[];
  mode?: 'navigate' | 'showAll';
  onSeek?: (seconds: number) => void;
  nextTab?: string;
  onNavigateTab?: (id: string) => void;
}

export const CodeExplorer = memo(function CodeExplorer({
  snippets,
  mode: initialMode = 'navigate',
  onSeek,
  nextTab: _nextTab,
  onNavigateTab: _onNavigateTab,
}: CodeExplorerProps) {
  const [currentSnippet, setCurrentSnippet] = useState(0);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'navigate' | 'showAll'>(initialMode);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => { if (copyTimerRef.current) clearTimeout(copyTimerRef.current); }, []);

  const total = snippets.length;

  const handleCopy = useCallback(async (code: string, index: number) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedIndex(index);
      clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopiedIndex(null), 2000);
    } catch {
      // Clipboard may not be available
    }
  }, []);

  if (total === 0) return null;

  const renderSnippet = (snippet: TechSnippet, index: number) => (
    <GlassCard key={index} variant="default" className="space-y-3 p-0 overflow-hidden">
      {/* Filename + language + tags */}
      <div className="flex items-center gap-1.5 px-4 pt-4 text-xs text-muted-foreground">
        <FileCode className="h-3.5 w-3.5" aria-hidden="true" />
        {snippet.filename && <span className="font-mono">{snippet.filename}</span>}
        <span className="ml-auto">
          <Badge variant="muted" className="text-[10px]">{snippet.language}</Badge>
        </span>
      </div>

      {/* Explanation — rendered above code for warm tone */}
      <div className="px-4 space-y-2">
        <p className="text-sm text-muted-foreground">{snippet.explanation}</p>
        {snippet.timestamp != null && onSeek && (
          <Timestamp seconds={snippet.timestamp} onClick={() => onSeek(snippet.timestamp!)} />
        )}
      </div>

      {/* Code block */}
      <div className="relative rounded-lg mx-3 mb-3 bg-[oklch(12%_0_0)] text-[oklch(90%_0_0)] overflow-hidden">
        <button
          onClick={() => handleCopy(snippet.code, index)}
          className={cn(
            'absolute top-2 right-2 z-10 flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors',
            copiedIndex === index
              ? 'bg-success/20 text-success'
              : 'bg-[oklch(20%_0_0)] text-[oklch(70%_0_0)] hover:bg-[oklch(25%_0_0)] hover:text-[oklch(85%_0_0)]',
          )}
          aria-label={copiedIndex === index ? 'Copied' : 'Copy code'}
        >
          {copiedIndex === index ? (
            <><Check className="h-3 w-3" aria-hidden="true" /> Copied</>
          ) : (
            <><Copy className="h-3 w-3" aria-hidden="true" /> Copy</>
          )}
        </button>
        <pre className="overflow-x-auto p-4 pr-20 text-sm leading-relaxed">
          <code className="font-mono whitespace-pre-wrap">{snippet.code}</code>
        </pre>
      </div>
    </GlassCard>
  );

  return (
    <div className="space-y-4">
      {/* View mode toggle */}
      {total > 1 && (
        <div className="flex items-center justify-between">
          {viewMode === 'navigate' ? (
            <BackForward
              onBack={() => setCurrentSnippet((i) => Math.max(0, i - 1))}
              onForward={() => setCurrentSnippet((i) => Math.min(total - 1, i + 1))}
              backDisabled={currentSnippet === 0}
              forwardDisabled={currentSnippet === total - 1}
              backLabel="Prev"
              forwardLabel="Next"
            />
          ) : (
            <span className="text-xs text-muted-foreground">{total} snippets</span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewMode((m) => m === 'navigate' ? 'showAll' : 'navigate')}
            className="text-xs gap-1.5"
          >
            <List className="h-3.5 w-3.5" aria-hidden="true" />
            {viewMode === 'navigate' ? 'Show all' : 'Step through'}
          </Button>
        </div>
      )}

      {/* Content */}
      {viewMode === 'navigate' ? (
        <FadeIn key={currentSnippet}>
          {renderSnippet(snippets[currentSnippet], currentSnippet)}
        </FadeIn>
      ) : (
        <div className="space-y-4">
          {snippets.map((snippet, index) => (
            <FadeIn key={index} index={index}>
              {renderSnippet(snippet, index)}
            </FadeIn>
          ))}
        </div>
      )}

      {/* Stepper dots */}
      {viewMode === 'navigate' && total > 1 && (
        <Stepper total={total} current={currentSnippet} onStepClick={setCurrentSnippet} />
      )}

    </div>
  );
});
