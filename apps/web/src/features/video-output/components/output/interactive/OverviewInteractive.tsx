import { memo, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Star, ArrowRight, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { HeroCard, FadeIn, GlassCard, StatPill, ExpandableCard, Badge, QuoteBlock } from '@/components/vie';
import { useLabels } from '@/lib/i18n';


interface OverviewStat {
  label: string;
  value: string;
  emoji?: string;
  tabId?: string;
}

interface OverviewHighlight {
  emoji: string;
  text: string;
}

interface OverviewInteractiveProps {
  title: string;
  emoji?: string;
  subtitle?: string;
  stats?: OverviewStat[];
  highlights?: OverviewHighlight[];
  tips?: string[];
  summary?: string;
  masterSummary?: string;
  keyTakeaways?: string[];
  quote?: string;
  quoteAuthor?: string;
  duration?: string;
  level?: string;
  itemCount?: number;
  crossTabLinks?: Array<{ targetTab: string; label: string }>;
  videoId?: string;
  nextTab?: string;
  onNavigateTab?: (id: string) => void;
}

const STARRED_KEY = (id: string) => `vie-overview-starred-${id}`;

export const OverviewInteractive = memo(function OverviewInteractive({
  title,
  emoji = '📋',
  subtitle,
  stats,
  highlights,
  tips,
  summary,
  masterSummary,
  keyTakeaways,
  quote,
  quoteAuthor,
  duration,
  level,
  itemCount,
  crossTabLinks,
  videoId,
  nextTab: _nextTab,
  onNavigateTab: _onNavigateTab,
}: OverviewInteractiveProps) {
  const t = useLabels();
  const [starredHighlights, setStarredHighlights] = useState<Set<number>>(new Set());

  // Load bookmarks from localStorage
  useEffect(() => {
    if (!videoId) return;
    try {
      const saved = localStorage.getItem(STARRED_KEY(videoId));
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.every((v) => typeof v === 'number'))
          setStarredHighlights(new Set(parsed));
      }
    } catch { /* ignore corrupt data */ }
  }, [videoId]);

  const toggleStar = useCallback((index: number) => {
    setStarredHighlights((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  // Sync starred highlights to localStorage (debounced to avoid per-click serialization)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    if (!videoId) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      try {
        if (starredHighlights.size === 0) {
          localStorage.removeItem(STARRED_KEY(videoId));
        } else {
          localStorage.setItem(STARRED_KEY(videoId), JSON.stringify(Array.from(starredHighlights)));
        }
      } catch { /* ignore */ }
    }, 500);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [videoId, starredHighlights]);

  // Build metadata stat pills from flattened props (memoized)
  const metaStats = useMemo<OverviewStat[]>(() => {
    const out: OverviewStat[] = [];
    if (duration) out.push({ label: t.duration, value: duration });
    if (level) out.push({ label: t.level, value: level });
    if (itemCount != null && itemCount > 0) out.push({ label: t.items, value: String(itemCount) });
    return out;
  }, [duration, level, itemCount, t.duration, t.level, t.items]);

  const allStats = useMemo(() => [...metaStats, ...(stats ?? [])], [metaStats, stats]);

  // Use masterSummary (2-3 sentences) or fall back to summary
  const displaySummary = masterSummary || summary;

  // Top 3 takeaways for landing page (memoized slice)
  const topTakeaways = useMemo(() => keyTakeaways?.slice(0, 3), [keyTakeaways]);

  return (
    <div className="space-y-4">
      {/* Hero */}
      <HeroCard emoji={emoji} title={title} subtitle={subtitle}>
        {allStats.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {allStats.map((stat, i) => (
              <StatPill
                key={i}
                value={stat.value}
                label={stat.label}
                onClick={stat.tabId && _onNavigateTab ? () => _onNavigateTab(stat.tabId!) : undefined}
              />
            ))}
          </div>
        )}
      </HeroCard>

      {/* Master summary */}
      {displaySummary && (
        <FadeIn>
          <GlassCard variant="outlined">
            <p className="text-sm leading-relaxed text-muted-foreground">{displaySummary}</p>
          </GlassCard>
        </FadeIn>
      )}

      {/* Key Takeaways */}
      {topTakeaways && topTakeaways.length > 0 && (
        <FadeIn index={1}>
          <GlassCard variant="outlined" className="space-y-2">
            <span className="type-eyebrow">
              Key takeaways
            </span>
            <ul className="space-y-2">
              {topTakeaways.map((takeaway, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm leading-relaxed text-muted-foreground">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary/60 shrink-0 translate-y-1.5" />
                  <span>{takeaway}</span>
                </li>
              ))}
            </ul>
          </GlassCard>
        </FadeIn>
      )}

      {/* Quote */}
      {quote && (
        <FadeIn index={2}>
          <GlassCard variant="outlined" className="border-s-2 border-primary/30">
            <QuoteBlock text={quote} attribution={quoteAuthor} variant="speaker" />
          </GlassCard>
        </FadeIn>
      )}

      {/* Highlights — collapsible */}
      {highlights && highlights.length > 0 && (
        <ExpandableCard
          defaultExpanded
          header={
            <div className="flex items-center gap-2 w-full">
              <span className="type-eyebrow">Highlights</span>
              <Badge variant="muted" className="tabular-nums">{highlights.length}</Badge>
              {videoId && starredHighlights.size > 0 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const starred = Array.from(starredHighlights)
                      .sort((a, b) => a - b)
                      .map((i) => highlights[i])
                      .filter(Boolean);
                    const text = starred
                      .map((h) => `${h.emoji} ${h.text}`)
                      .join('\n\n');
                    const header = `# ${title} — Starred highlights\n\n`;
                    const blob = new Blob([header + text], { type: 'text/markdown;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${title.replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 60)}-highlights.md`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="ms-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/10 transition-colors"
                  aria-label={`Export ${starredHighlights.size} starred highlights`}
                >
                  <Download className="h-3 w-3" aria-hidden="true" />
                  Export {starredHighlights.size}
                </button>
              )}
            </div>
          }
        >
          <ul className="space-y-2">
            {highlights.map((item, i) => (
              <FadeIn key={i} index={i}>
                <li className="flex items-start gap-2.5 text-sm leading-relaxed group">
                  <span className="text-lg shrink-0" aria-hidden="true">{item.emoji}</span>
                  <span className={cn(
                    'text-muted-foreground flex-1',
                    starredHighlights.has(i) && 'font-semibold text-foreground',
                  )}>
                    {item.text}
                  </span>
                  {videoId && (
                    <button
                      onClick={() => toggleStar(i)}
                      className="shrink-0 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label={starredHighlights.has(i) ? 'Remove bookmark' : 'Bookmark'}
                    >
                      <Star
                        className={cn(
                          'h-3.5 w-3.5 transition-colors',
                          starredHighlights.has(i)
                            ? 'fill-warning text-warning'
                            : 'text-muted-foreground hover:text-warning',
                        )}
                      />
                    </button>
                  )}
                </li>
              </FadeIn>
            ))}
          </ul>
        </ExpandableCard>
      )}

      {/* Tips — collapsible */}
      {tips && tips.length > 0 && (
        <ExpandableCard
          defaultExpanded
          header={
            <div className="flex items-center gap-2">
              <span className="type-eyebrow text-info">Tips</span>
              <Badge variant="info" className="tabular-nums">{tips.length}</Badge>
            </div>
          }
        >
          <ul className="space-y-1.5">
            {tips.map((tip, i) => (
              <li key={i} className="flex items-baseline gap-2 text-sm leading-relaxed text-muted-foreground">
                <span className="w-1 h-1 rounded-full bg-info/70 shrink-0 translate-y-1.5" />
                {tip}
              </li>
            ))}
          </ul>
        </ExpandableCard>
      )}

      {/* Navigation buttons (cross-tab links) */}
      {crossTabLinks && crossTabLinks.length > 0 && _onNavigateTab && (
        <div className="flex flex-col gap-2">
          {crossTabLinks.map((link) => (
            <button
              key={link.targetTab}
              onClick={() => _onNavigateTab(link.targetTab)}
              className="flex items-center justify-between gap-2 rounded-lg border border-border/50 bg-muted/10 px-4 py-2.5 text-sm font-semibold leading-snug transition-colors hover:bg-muted/20"
            >
              <span>{link.label}</span>
              <ArrowRight className="h-4 w-4 text-muted-foreground rtl:rotate-180" aria-hidden="true" />
            </button>
          ))}
        </div>
      )}

    </div>
  );
});
