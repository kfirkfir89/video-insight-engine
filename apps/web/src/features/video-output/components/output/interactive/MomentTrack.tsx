import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, ChevronUp, Clock, Play, Share2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge, FadeIn, GlassCard } from '@/components/vie';
import { useTabState } from '@/features/video-output/contexts/TabStateContext';
import { cn } from '@/lib/utils';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';

import { getMoodColor } from '../../../lib/moodColors';

type TypeFilter = 'all' | 'clips' | 'moments';

export interface MomentItem {
  time: string;
  seconds: number;
  endSeconds?: number;
  label: string;
  description?: string;
  mood?: string;
  emoji?: string;
  speaker?: string;
  tags?: string[];
  thumbnailUrl?: string;
  /** One-line vision caption for the frame at this timestamp. */
  frameCaption?: string;
  /** Vision LLM rationale for why this frame is educationally valuable. */
  frameEvidence?: string;
  /** On-screen text (OCR or LLM-read) visible in the frame. */
  frameOcr?: string;
  /** "slide", "code", "diagram", "demo", etc. — used to badge the moment. */
  frameSceneType?: string;
}

interface MomentTrackProps {
  items: MomentItem[];
  filters?: boolean;
  onSeek?: (seconds: number) => void;
  currentTime?: number;
  nextTab?: string;
  onNavigateTab?: (id: string) => void;
}

function isClip(item: MomentItem): boolean {
  return typeof item.endSeconds === 'number' && item.endSeconds > item.seconds + 1;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rem = seconds % 60;
  return rem === 0 ? `${minutes}m` : `${minutes}m ${rem}s`;
}

function resolveLabel(item: MomentItem): string {
  const label = item.label?.trim();
  if (label && label.toLowerCase() !== 'clip' && label.toLowerCase() !== 'moment') return label;
  if (item.description) {
    const trimmed = item.description.slice(0, 60);
    return trimmed + (item.description.length > 60 ? '…' : '');
  }
  return `Moment at ${item.time}`;
}

export const MomentTrack = memo(function MomentTrack({
  items,
  filters,
  onSeek,
  currentTime,
  nextTab: _nextTab,
  onNavigateTab: _onNavigateTab,
}: MomentTrackProps) {
  // Per-item explicit expand/collapse choice. When an entry exists, it overrides
  // the auto-expand-active-clip default — that lets users dismiss an active clip
  // (and re-expand a non-active one) without the auto rule fighting them.
  const [explicit, setExplicit] = useState<Map<number, boolean>>(new Map());
  const [moodFilter, setMoodFilter] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [pulseKey, setPulseKey] = useState<number>(-1);
  const reducedMotion = usePrefersReducedMotion();
  const tabState = useTabState();
  const completedStepCount = tabState.completedSteps.size;

  const prevActiveRef = useRef<number>(-1);

  // Note: explicit choices intentionally persist across filter toggles. Map
  // keys are integer indices into `items` — entries for currently-hidden items
  // are inert, and naturally restore their state when the filter is cleared.

  const hasClips = useMemo(() => items.some(isClip), [items]);
  const hasMoments = useMemo(() => items.some((i) => !isClip(i)), [items]);
  const showTypeFilter = hasClips && hasMoments;

  const activeIndex = useMemo(() => {
    if (currentTime == null) return -1;
    // Don't assume `items` is chronologically sorted. Track the latest start
    // time we've seen so unsorted input still resolves the right active index.
    let best = -1;
    let bestSeconds = -Infinity;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const end = item.endSeconds ?? item.seconds + 0.5;
      if (currentTime >= item.seconds && currentTime < end) return i;
      if (item.seconds <= currentTime && item.seconds > bestSeconds) {
        best = i;
        bestSeconds = item.seconds;
      }
    }
    return best;
  }, [items, currentTime]);

  useEffect(() => {
    if (reducedMotion) return;
    if (activeIndex !== prevActiveRef.current && activeIndex >= 0) {
      setPulseKey(activeIndex);
      const timer = setTimeout(() => setPulseKey(-1), 650);
      prevActiveRef.current = activeIndex;
      return () => clearTimeout(timer);
    }
    prevActiveRef.current = activeIndex;
  }, [activeIndex, reducedMotion]);

  const uniqueMoods = useMemo(() => {
    const moods = new Set<string>();
    for (const item of items) {
      if (item.mood) moods.add(item.mood);
    }
    return Array.from(moods);
  }, [items]);

  // Carry originalIndex through filtering so the render loop doesn't pay an
  // O(N) `items.indexOf(item)` per row — was O(N²) per render on long videos.
  const filtered = useMemo(() => {
    const result: Array<{ item: MomentItem; originalIndex: number }> = [];
    items.forEach((item, originalIndex) => {
      if (moodFilter && item.mood !== moodFilter) return;
      if (typeFilter === 'clips' && !isClip(item)) return;
      if (typeFilter === 'moments' && isClip(item)) return;
      result.push({ item, originalIndex });
    });
    return result;
  }, [items, moodFilter, typeFilter]);

  const totalDuration = useMemo(() => {
    if (items.length === 0) return 0;
    const last = items[items.length - 1];
    return Math.max(last.endSeconds ?? last.seconds, last.seconds) || 1;
  }, [items]);

  const toggleExpand = (index: number, currentlyExpanded: boolean): void => {
    setExplicit((prev) => {
      const next = new Map(prev);
      next.set(index, !currentlyExpanded);
      return next;
    });
  };

  const handleSeek = (seconds: number): void => {
    onSeek?.(seconds);
  };

  const handleShare = (item: MomentItem): void => {
    const url = new URL(window.location.href);
    const hash = isClip(item) ? `t=${item.seconds},${item.endSeconds}` : `t=${item.seconds}`;
    url.hash = hash;
    navigator.clipboard.writeText(url.toString()).catch(() => {});
  };

  if (items.length === 0) return null;

  return (
    <div className="space-y-4" data-testid="moment-track">
      {/* Filter row */}
      {filters !== false && (showTypeFilter || uniqueMoods.length > 1 || completedStepCount > 0) && (
        <div className="flex flex-wrap items-center gap-2">
          {showTypeFilter && (
            <div
              role="group"
              aria-label="Filter by type"
              className="inline-flex items-center rounded-full border border-border/50 bg-muted/20 p-0.5 text-xs font-medium"
            >
              {([
                { id: 'all', label: 'All' },
                { id: 'clips', label: 'Clips' },
                { id: 'moments', label: 'Moments' },
              ] as const).map((opt) => {
                const active = typeFilter === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setTypeFilter(opt.id)}
                    aria-pressed={active}
                    data-testid={`type-filter-${opt.id}`}
                    className={cn(
                      'rounded-full px-3 py-1 transition-colors',
                      active ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          )}

          {uniqueMoods.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setMoodFilter(null)}
                className={cn(
                  'rounded-full px-2.5 py-1 text-xs font-medium border transition-colors',
                  moodFilter === null
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-muted/20 text-muted-foreground border-border/50 hover:bg-muted/40',
                )}
              >
                All moods
              </button>
              {uniqueMoods.map((mood) => {
                const active = moodFilter === mood;
                return (
                  <button
                    key={mood}
                    type="button"
                    onClick={() => setMoodFilter(active ? null : mood)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border transition-colors capitalize',
                      active
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-muted/20 text-muted-foreground border-border/50 hover:bg-muted/40',
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className="inline-block size-1.5 rounded-full shrink-0"
                      style={{ background: active ? 'currentColor' : getMoodColor(mood) }}
                    />
                    {mood}
                  </button>
                );
              })}
            </div>
          )}

          {completedStepCount > 0 && (
            <div className="ms-auto flex items-center gap-1.5 px-1 text-xs font-medium text-success">
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
              <span>
                <span className="tabular-nums font-semibold">{completedStepCount}</span> step
                {completedStepCount !== 1 ? 's' : ''} completed
              </span>
            </div>
          )}
        </div>
      )}

      {/* Track */}
      <ol className="relative space-y-2" aria-label="Moment track">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute start-[14px] top-1 bottom-1 w-px bg-gradient-to-b from-primary/50 via-primary/25 to-transparent"
        />

        {filtered.map(({ item, originalIndex }, index) => {
          const clip = isClip(item);
          const isActive = activeIndex === originalIndex;
          // Active clips auto-expand, but an explicit user choice always wins
          // — this is what lets the user collapse an active clip's body.
          const autoExpand = isActive && clip;
          const explicitChoice = explicit.get(originalIndex);
          const isExpanded = explicitChoice ?? autoExpand;
          const moodColor = getMoodColor(item.mood);
          const duration = clip ? (item.endSeconds as number) - item.seconds : 0;
          const capsuleHeight = clip
            ? Math.max(32, Math.min(120, Math.round((duration / totalDuration) * 240)))
            : 0;
          const liveProgress = clip && isActive && currentTime != null
            ? Math.max(0, Math.min(duration, currentTime - item.seconds))
            : null;
          const chipContent = (
            <>
              <Clock className="h-3 w-3" aria-hidden="true" />
              {item.time}
              {clip && liveProgress != null && (
                <span className="text-muted-foreground/80"> / {formatDuration(Math.round(liveProgress))}</span>
              )}
            </>
          );

          return (
            <FadeIn key={originalIndex} index={index}>
              <li
                data-kind={clip ? 'clip' : 'moment'}
                data-active={isActive ? 'true' : undefined}
                className="relative"
              >
                <div className="flex items-stretch gap-3 ps-10">
                  {/* Spine marker */}
                  <div
                    aria-hidden="true"
                    className={cn(
                      'absolute start-[8px] flex flex-col items-center',
                      clip ? 'top-3 bottom-3' : 'top-3',
                    )}
                  >
                    {clip ? (
                      <div
                        data-testid={`capsule-${originalIndex}`}
                        style={{ height: `${capsuleHeight}px` }}
                        className={cn(
                          'relative w-[14px] rounded-full border border-primary/40 bg-primary/15',
                          'shadow-[inset_0_0_12px_oklch(var(--primary)/0.25)]',
                          isActive && 'ring-1 ring-[var(--vie-accent)]/60 bg-primary/30',
                        )}
                      >
                        <span className="absolute -top-1 start-1/2 -translate-x-1/2 size-2 rounded-full bg-primary" aria-hidden="true" />
                        <span className="absolute -bottom-1 start-1/2 -translate-x-1/2 size-2 rounded-full bg-primary/70" aria-hidden="true" />
                      </div>
                    ) : (
                      <div
                        className={cn(
                          'size-[14px] rounded-full border-2 bg-background',
                          isActive ? 'border-[var(--vie-accent)]' : 'border-primary',
                          pulseKey === originalIndex && !reducedMotion && 'animate-pulse-once',
                        )}
                      />
                    )}
                  </div>

                  {/* Card body — chip and toggle are sibling buttons (HTML
                      forbids interactive content nested inside a <button>). */}
                  <GlassCard
                    variant={isActive ? 'default' : 'outlined'}
                    className={cn(
                      'flex-1 overflow-hidden p-0',
                      isActive && 'ring-1 ring-[var(--vie-accent)]/40',
                    )}
                  >
                    <div className="px-3 py-2 flex items-start gap-3">
                      {item.thumbnailUrl && (
                        <img
                          src={item.thumbnailUrl}
                          alt=""
                          loading="lazy"
                          className={cn(
                            'rounded object-cover shrink-0 border border-border/30',
                            clip ? 'w-24 h-[54px]' : 'w-14 h-9',
                          )}
                        />
                      )}

                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {onSeek ? (
                            <button
                              type="button"
                              onClick={() => handleSeek(item.seconds)}
                              dir="ltr"
                              className="inline-flex items-center gap-1 text-xs font-bold tabular-nums text-primary bg-primary/10 px-2 py-0.5 rounded-md shrink-0 cursor-pointer hover:bg-primary/20 transition-colors"
                              aria-label={`Jump to ${item.time}`}
                            >
                              {chipContent}
                            </button>
                          ) : (
                            <span dir="ltr" className="inline-flex items-center gap-1 text-xs font-bold tabular-nums text-primary bg-primary/10 px-2 py-0.5 rounded-md shrink-0">
                              {chipContent}
                            </span>
                          )}
                          {clip && (
                            <span dir="ltr" className="text-[11px] font-medium tabular-nums text-muted-foreground">
                              {formatDuration(duration)}
                            </span>
                          )}
                          {item.emoji && <span aria-hidden="true" className="text-base">{item.emoji}</span>}
                          {item.mood && (
                            <span
                              className="inline-flex items-center gap-1.5"
                              aria-label={`Mood: ${item.mood}`}
                            >
                              <span
                                aria-hidden="true"
                                className="inline-block size-1.5 rounded-full"
                                style={{ background: moodColor }}
                              />
                              <Badge variant="muted" className="text-xs font-medium capitalize">
                                {item.mood}
                              </Badge>
                            </span>
                          )}
                          {item.speaker && (
                            <span className="text-xs font-medium text-muted-foreground/70 italic">
                              {item.speaker}
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => toggleExpand(originalIndex, isExpanded)}
                          aria-expanded={isExpanded}
                          className="-mx-1 flex w-full items-start gap-2 rounded px-1 py-0.5 text-start transition-colors hover:bg-muted/30"
                        >
                          <span className="text-sm font-semibold leading-snug flex-1 truncate">
                            {resolveLabel(item)}
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                          )}
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <FadeIn>
                        <div className="px-3 pb-3 space-y-2">
                          {item.description && (
                            <p className="text-sm leading-relaxed text-muted-foreground">
                              {item.description}
                            </p>
                          )}
                          {(item.frameCaption || item.frameOcr || item.frameEvidence) && (
                            <div className="rounded-md border border-border/40 bg-muted/15 px-3 py-2 space-y-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/80">
                                  On screen
                                </span>
                                {item.frameSceneType && (
                                  <Badge variant="muted" className="text-[10px] font-medium capitalize">
                                    {item.frameSceneType.replace(/_/g, ' ')}
                                  </Badge>
                                )}
                              </div>
                              {item.frameCaption && (
                                <p className="text-sm leading-snug text-foreground/90">
                                  {item.frameCaption}
                                </p>
                              )}
                              {item.frameOcr && (
                                <p className="text-xs leading-snug text-muted-foreground font-mono break-words">
                                  &ldquo;{item.frameOcr}&rdquo;
                                </p>
                              )}
                              {item.frameEvidence && (
                                <p className="text-xs italic leading-snug text-muted-foreground/80">
                                  {item.frameEvidence}
                                </p>
                              )}
                            </div>
                          )}
                          {item.tags && item.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {item.tags.map((tag, i) => (
                                <Badge key={i} variant="muted" className="text-xs">{tag}</Badge>
                              ))}
                            </div>
                          )}
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            {onSeek && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleSeek(item.seconds)}
                                className="text-xs gap-1.5"
                              >
                                <Play className="h-3 w-3" aria-hidden="true" />
                                {clip ? 'Play range' : 'Jump to'}
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleShare(item)}
                              className="text-xs gap-1.5 text-muted-foreground"
                              data-testid={`share-${originalIndex}`}
                            >
                              <Share2 className="h-3 w-3" aria-hidden="true" />
                              Share {clip ? 'clip' : 'moment'}
                            </Button>
                          </div>
                        </div>
                      </FadeIn>
                    )}
                  </GlassCard>
                </div>
              </li>
            </FadeIn>
          );
        })}
      </ol>
    </div>
  );
});
