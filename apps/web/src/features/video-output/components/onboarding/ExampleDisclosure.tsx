import { useState } from 'react';
import { ChevronDown, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Opt-in "see what an example looks like" affordance for new users on
 * /generate. Renders a CSS-only mockup of a finished output rather than
 * an image — it never goes stale, has zero CLS, and ships without a CDN.
 */
export function ExampleDisclosure() {
  const [expanded, setExpanded] = useState<boolean>(false);

  return (
    <div
      className="rounded-2xl border border-border/40 bg-muted/15 overflow-hidden"
      data-testid="onboarding-example-disclosure"
    >
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        aria-expanded={expanded}
        aria-controls="example-disclosure-panel"
        className="w-full flex items-center justify-between gap-2 px-4 py-3 text-sm font-medium text-foreground/85 hover:bg-muted/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 transition-colors"
      >
        <span className="inline-flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
          See an example
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 text-muted-foreground transition-transform duration-300 ease-[var(--ease-out-expo,cubic-bezier(0.16,1,0.3,1))]',
            expanded && 'rotate-180',
          )}
          aria-hidden="true"
        />
      </button>
      <div
        id="example-disclosure-panel"
        className="grid transition-[grid-template-rows,opacity] duration-300 ease-[var(--ease-out-expo,cubic-bezier(0.16,1,0.3,1))] motion-reduce:transition-none"
        style={{ gridTemplateRows: expanded ? '1fr' : '0fr', opacity: expanded ? 1 : 0 }}
      >
        <div className="overflow-hidden">
          <div className="px-4 pb-4 pt-1 flex flex-col gap-3">
            <ExampleMockup />
            <p className="text-center text-[11px] text-muted-foreground">
              Stylised preview — actual output adapts to each video.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Pure-CSS skeleton of a finished video output. No assets, no CLS. */
function ExampleMockup() {
  return (
    <div
      aria-hidden="true"
      className="rounded-xl bg-card border border-border/60 p-3 shadow-sm sm:p-4"
    >
      {/* Tab strip */}
      <div className="flex items-center gap-1 pb-3 border-b border-border/40 overflow-x-auto">
        {['Summary', 'Flashcards', 'Quiz', 'Timestamps'].map((t, i) => (
          <span
            key={t}
            className={cn(
              'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider',
              i === 0
                ? 'bg-primary/15 text-primary'
                : 'text-muted-foreground/70',
            )}
          >
            {t}
          </span>
        ))}
      </div>

      {/* Body: heading + bullets + flashcard */}
      <div className="grid grid-cols-3 gap-3 pt-3">
        <div className="col-span-3 sm:col-span-2 flex flex-col gap-1.5">
          <div className="h-3 rounded bg-muted/70 w-3/4" />
          <div className="h-2 rounded bg-muted/40 w-full" />
          <div className="h-2 rounded bg-muted/40 w-5/6" />
          <div className="h-2 rounded bg-muted/40 w-2/3" />
          <div className="mt-2 flex flex-col gap-1.5">
            {[100, 80, 60].map((w) => (
              <div key={w} className="flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-primary shrink-0" />
                <div
                  className="h-2 rounded bg-muted/40"
                  style={{ width: `${w}%` }}
                />
              </div>
            ))}
          </div>
        </div>
        <div className="col-span-3 sm:col-span-1 rounded-lg border border-primary/20 bg-gradient-to-br from-primary/15 to-primary/[0.03] p-2.5 flex flex-col gap-1.5">
          <div className="text-[9px] font-mono uppercase tracking-wider text-primary/70">
            Flashcard
          </div>
          <div className="h-2 rounded bg-foreground/15 w-full" />
          <div className="h-2 rounded bg-foreground/15 w-2/3" />
          <div className="mt-1 flex gap-1">
            <div className="h-4 flex-1 rounded bg-muted/30" />
            <div className="h-4 flex-1 rounded bg-muted/30" />
          </div>
        </div>
      </div>
    </div>
  );
}
