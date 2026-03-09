import { useState } from 'react';
import type { ExplanationOutput } from '@vie/types';
import { GlassCard } from '../GlassCard';
import { cn } from '../../../../lib/utils';

interface ExplanationTabsProps {
  data: ExplanationOutput;
  activeTab: string;
}

export function ExplanationTabs({ data, activeTab }: ExplanationTabsProps) {
  switch (activeTab) {
    case 'key_points':
      return <KeyPointCards points={data.keyPoints} />;

    case 'concepts':
      return <ConceptGrid concepts={data.concepts} />;

    case 'takeaways':
      return <TakeawayList items={data.takeaways} />;

    case 'timestamps':
      return <TimestampTimeline timestamps={data.timestamps} />;

    default:
      return null;
  }
}

/** Expandable key point cards with timestamp badges */
function KeyPointCards({ points }: { points: ExplanationOutput['keyPoints'] }) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  return (
    <div className="flex flex-col gap-3">
      {points.map((point, i) => {
        const isExpanded = expandedIdx === i;
        return (
          <GlassCard key={i} variant="interactive" className="cursor-pointer">
            <button
              className="flex w-full items-start gap-3 text-left"
              onClick={() => setExpandedIdx(isExpanded ? null : i)}
              aria-expanded={isExpanded}
            >
              <span className="text-2xl shrink-0">{point.emoji}</span>
              <div className="flex flex-col gap-1 min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold">{point.title}</h4>
                  {point.timestamp !== undefined && (
                    <span className="shrink-0 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-mono font-semibold text-primary">
                      {Math.floor(point.timestamp / 60)}:{String(point.timestamp % 60).padStart(2, '0')}
                    </span>
                  )}
                </div>
                {isExpanded ? (
                  <p className="text-sm text-muted-foreground leading-relaxed animate-[fadeUp_0.2s_ease_both]">
                    {point.detail}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
                    {point.detail}
                  </p>
                )}
              </div>
              <span
                className={cn(
                  'shrink-0 text-muted-foreground/50 transition-transform duration-200 text-xs mt-1',
                  isExpanded && 'rotate-180',
                )}
                aria-hidden="true"
              >
                ▼
              </span>
            </button>
          </GlassCard>
        );
      })}
    </div>
  );
}

/** Expandable concept cards in responsive grid */
function ConceptGrid({ concepts }: { concepts: ExplanationOutput['concepts'] }) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {concepts.map((concept, i) => {
        const isExpanded = expandedIdx === i;
        return (
          <GlassCard key={i} variant="interactive" className="cursor-pointer">
            <button
              className="flex w-full items-start gap-2 text-left"
              onClick={() => setExpandedIdx(isExpanded ? null : i)}
              aria-expanded={isExpanded}
            >
              <span className="text-xl shrink-0">{concept.emoji}</span>
              <div className="flex flex-col gap-1 min-w-0 flex-1">
                <h4 className="text-sm font-semibold">{concept.name}</h4>
                <p className={cn(
                  'text-sm text-muted-foreground leading-relaxed',
                  !isExpanded && 'line-clamp-2',
                  isExpanded && 'animate-[fadeUp_0.2s_ease_both]',
                )}>
                  {concept.definition}
                </p>
              </div>
            </button>
          </GlassCard>
        );
      })}
    </div>
  );
}

/** Action-oriented takeaway cards with checkbox UX */
function TakeawayList({ items }: { items: string[] }) {
  const [checked, setChecked] = useState<Set<number>>(new Set());

  function toggle(idx: number) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map((takeaway, i) => {
        const isDone = checked.has(i);
        return (
          <GlassCard key={i} variant="interactive" className="cursor-pointer">
            <button
              className="flex w-full gap-3 items-start text-left"
              onClick={() => toggle(i)}
              aria-pressed={isDone}
            >
              <span
                className={cn(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-all duration-200 mt-0.5',
                  isDone
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-muted-foreground/30',
                )}
              >
                {isDone && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="animate-[fadeUp_0.15s_ease_both]">
                    <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
              <p className={cn(
                'text-sm leading-relaxed transition-all duration-200',
                isDone && 'text-muted-foreground line-through',
              )}>
                {takeaway}
              </p>
            </button>
          </GlassCard>
        );
      })}
      {checked.size > 0 && (
        <p className="text-xs text-muted-foreground text-center mt-1">
          {checked.size} of {items.length} completed
        </p>
      )}
    </div>
  );
}

/** Persistent timeline with visual indicators */
function TimestampTimeline({ timestamps }: { timestamps: ExplanationOutput['timestamps'] }) {
  return (
    <div className="flex flex-col gap-0.5">
      {timestamps.map((ts, i) => (
        <div
          key={i}
          className="group flex items-center gap-3 rounded-xl px-4 py-3 transition-colors hover:bg-muted/50"
        >
          {/* Timeline dot + line */}
          <div className="flex flex-col items-center shrink-0">
            <div className="h-2.5 w-2.5 rounded-full bg-primary/60 group-hover:bg-primary transition-colors" />
            {i < timestamps.length - 1 && (
              <div className="w-px h-6 bg-border mt-0.5" />
            )}
          </div>
          {/* Time badge */}
          <span className="shrink-0 rounded-md bg-primary/10 px-2 py-1 text-xs font-mono font-semibold text-primary min-w-[52px] text-center">
            {ts.time}
          </span>
          {/* Label */}
          <span className="text-sm">{ts.label}</span>
        </div>
      ))}
    </div>
  );
}
