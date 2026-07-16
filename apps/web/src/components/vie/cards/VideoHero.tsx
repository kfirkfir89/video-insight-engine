import { memo, useCallback, useState } from 'react';
import { motion } from 'motion/react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { springs } from '@/lib/motion';
import { stripLeadingEmoji } from '@/lib/string-utils';
import { useLabels } from '@/lib/i18n';
import { useVideoPlayer } from '@/features/video-output/contexts/VideoPlayerContext';
import { YouTubePlayer } from '@/components/videos/YouTubePlayer';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { FadeIn } from '@/components/vie';
import { CollapsibleSection } from './CollapsibleSection';
import { PlayCloseGlyph } from './PlayCloseGlyph';
import type { TabDefinition, ContentTag } from '@vie/types';

interface VideoHeroTab extends TabDefinition {
  preview?: string;
}

interface VideoHeroProps {
  title: string;
  creator?: string;
  duration?: number | null;
  tldr?: string;
  keyTakeaways?: string[];
  masterSummary?: string;
  youtubeId?: string;
  tabs?: VideoHeroTab[];
  activeTabId?: string;
  onTabSelect?: (id: string) => void;
  completedTabs?: Set<string>;
  domainGradient?: string;
  /** Primary content tag — drives the identity-strip domain emoji + label and
   *  the fallback emoji selection on takeaways that don't match a keyword. */
  primaryTag?: ContentTag;
  /** Optional difficulty / depth label shown in the identity strip ("Beginner",
   *  "Advanced", etc). */
  level?: string;
  className?: string;
}

const DOMAIN_META: Record<string, { emoji: string; label: string }> = {
  learning: { emoji: '📚', label: 'Learning' },
  tech: { emoji: '💻', label: 'Tech' },
  food: { emoji: '🍳', label: 'Cooking' },
  travel: { emoji: '✈️', label: 'Travel' },
  fitness: { emoji: '💪', label: 'Fitness' },
  music: { emoji: '🎵', label: 'Music' },
  review: { emoji: '⭐', label: 'Review' },
  project: { emoji: '🛠️', label: 'Project' },
  language: { emoji: '🗣️', label: 'Language' },
  science: { emoji: '🔬', label: 'Science' },
  narrative: { emoji: '📖', label: 'Narrative' },
};

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// Takeaways collapse state is a global UI *preference* (visual density), not
// per-video *content interaction* — so the key is global, matching how chrome
// density toggles behave elsewhere. Per-video bookmarks (e.g. starred Overview
// highlights) use a different `${prefix}-${videoId}` convention because they
// belong to the content, not the chrome. The Brief no longer collapses — it
// rides beside the action cluster as the always-visible headline distillate.
const TAKEAWAYS_KEY = 'vie-hero-takeaways-open';

function readPersistedOpen(key: string, defaultOpen: boolean): boolean {
  if (typeof window === 'undefined') return defaultOpen;
  try {
    const saved = window.localStorage.getItem(key);
    if (saved === null) return defaultOpen;
    return saved === 'true';
  } catch {
    return defaultOpen;
  }
}

function writePersistedOpen(key: string, value: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    /* ignore */
  }
}


export const VideoHero = memo(function VideoHero({
  title,
  creator,
  duration,
  tldr,
  keyTakeaways,
  youtubeId,
  tabs,
  activeTabId,
  onTabSelect,
  completedTabs,
  domainGradient,
  primaryTag,
  level,
  className,
}: VideoHeroProps) {
  const t = useLabels();
  const { togglePlayer, isPlayerOpen, playerRef } = useVideoPlayer();
  const durationStr = formatDuration(duration);
  const safeTabs: VideoHeroTab[] = tabs ?? [];
  const hasTabs = safeTabs.length > 0;
  const domainMeta = primaryTag ? DOMAIN_META[primaryTag] : undefined;

  // Key takeaways collapse default-closed so the hero stays short: the title +
  // brief + action cluster land above the fold and the tab strip is reachable
  // without scrolling. The count rides in the disclosure label, so the value is
  // advertised even while collapsed. Persisted globally — a user who prefers
  // them open lands open next time.
  const [takeawaysOpen, setTakeawaysOpen] = useState<boolean>(() => readPersistedOpen(TAKEAWAYS_KEY, false));

  const toggleTakeaways = useCallback(() => {
    setTakeawaysOpen((prev) => {
      const next = !prev;
      writePersistedOpen(TAKEAWAYS_KEY, next);
      return next;
    });
  }, []);

  // Identity strip pieces — laid out as a single row, separated by dots so the
  // metadata reads as one cohesive line instead of a stack of chips.
  const identityChips: Array<{ key: string; node: React.ReactNode }> = [];
  if (domainMeta) {
    identityChips.push({
      key: 'domain',
      node: (
        <span className="inline-flex items-center gap-1.5 font-medium text-foreground/85">
          <span aria-hidden="true" className="text-sm leading-none">{domainMeta.emoji}</span>
          <span>{domainMeta.label}</span>
        </span>
      ),
    });
  }
  if (level) identityChips.push({ key: 'level', node: <span>{level}</span> });
  if (durationStr) identityChips.push({ key: 'duration', node: <span className="tabular-nums">{durationStr}</span> });
  if (creator) identityChips.push({ key: 'creator', node: <span className="truncate max-w-[24ch]">{creator}</span> });

  const visibleTakeaways = keyTakeaways?.slice(0, 6);
  const isStreaming = !tldr;
  const showTakeaways = (visibleTakeaways && visibleTakeaways.length > 0) || isStreaming;
  // When nothing renders below the header (no takeaways, no tab strip, player
  // closed), the header must carry its own bottom padding so the card doesn't
  // look clipped. Every other block supplies its own trailing space.
  const headerNeedsBottomPad = !showTakeaways && !hasTabs && !isPlayerOpen;

  return (
    <motion.section
      className={cn(
        'relative w-full rounded-2xl border border-border bg-card',
        className,
      )}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...springs.soft, delay: 0.04 }}
      aria-labelledby="vie-hero-title"
    >
      <div className={cn('px-6 pt-5 md:px-7 md:pt-6', headerNeedsBottomPad && 'pb-5 md:pb-6')}>
        {/* Top row: identity strip + title stack on the left; the watch control
            pins to the right corner as bare line-art — no tile, no ring, just a
            large stroked play arrow whose edges morph into a close mark when the
            player opens (PlayCloseGlyph). It sits in foreground ink at rest and
            lifts into the domain accent on hover and while open. The oversized
            invisible button keeps a comfortable touch target around the glyph. */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            {identityChips.length > 0 && (
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
                {identityChips.map((chip, i) => (
                  <span key={chip.key} className="inline-flex items-center gap-2.5">
                    {i > 0 && <span aria-hidden="true" className="text-muted-foreground/40">·</span>}
                    {chip.node}
                  </span>
                ))}
              </div>
            )}
            <h2
              id="vie-hero-title"
              className={cn(
                'font-semibold tracking-tight leading-[1.15] text-balance line-clamp-2 text-xl md:text-2xl',
                identityChips.length > 0 && 'mt-2.5',
              )}
            >
              {title || t.processing}
            </h2>
          </div>
          {youtubeId && (
            <button
              type="button"
              onClick={togglePlayer}
              className="play-control -mr-1 -mt-1 cursor-pointer flex size-12 shrink-0 items-center justify-center md:size-14"
              aria-label={isPlayerOpen ? t.hide : t.watch}
              aria-expanded={isPlayerOpen}
            >
              <PlayCloseGlyph open={isPlayerOpen} className="size-8 shrink-0 md:size-9" />
            </button>
          )}
        </div>

        {isStreaming ? (
          <div className="mt-3 space-y-1.5" aria-hidden="true">
            <div className="h-3.5 w-full rounded bg-muted/30 animate-pulse" />
            <div className="h-3.5 w-4/5 rounded bg-muted/30 animate-pulse" />
            <div className="h-3.5 w-3/5 rounded bg-muted/30 animate-pulse" />
          </div>
        ) : (
          <p className="mt-3 max-w-[68ch] text-[0.95rem] leading-relaxed text-foreground/85 text-pretty">
            {tldr}
          </p>
        )}
      </div>

      {youtubeId && (
        <div
          className={cn(
            'grid transition-[grid-template-rows,opacity] duration-300 ease-[var(--ease-out-expo)]',
            isPlayerOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
          )}
        >
          <div className="overflow-hidden">
            <div className="px-6 pb-4 md:px-7 pt-4">
              <YouTubePlayer
                ref={playerRef}
                youtubeId={youtubeId}
                className="rounded-lg"
              />
            </div>
          </div>
        </div>
      )}

      {/* Key takeaways — collapsed by default into a slim "Key takeaways · N"
          disclosure. Expanded, they render as a dense two-column grid so even
          the open state stays roughly half the height of the old single-column
          list. While streaming the count is unknown, so the eyebrow shows a
          static skeleton grid instead of a toggle. */}
      {showTakeaways ? (
        <div className="px-6 pb-5 md:px-7 md:pb-6 pt-4">
          {isStreaming ? (
            <div className="space-y-3" aria-hidden="true">
              <div className="flex items-center gap-2.5">
                <span className="h-px w-5 bg-border" />
                <span className="type-eyebrow text-muted-foreground">{t.keyTakeaways}</span>
                <span className="h-px flex-1 bg-border/60" />
              </div>
              <ul className="grid grid-cols-1 gap-x-7 gap-y-2 sm:grid-cols-2">
                {Array.from({ length: 4 }, (_, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="mt-[0.4rem] h-1 w-1 rounded-full bg-muted/40 shrink-0" />
                    <span
                      className="h-3 rounded bg-muted/30 animate-pulse"
                      style={{ width: `${88 - (i % 2) * 16}%` }}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <FadeIn>
              <CollapsibleSection
                baseId="vie-hero-takeaways"
                label={`${t.keyTakeaways} · ${visibleTakeaways!.length}`}
                open={takeawaysOpen}
                onToggle={toggleTakeaways}
              >
                {/* Uniform fine dot marker (not per-item emoji) keeps both
                    columns left-aligned and reads as a crisp, ordered list.
                    Tight 13px type sits clearly below the brief in hierarchy. */}
                <ul className="grid grid-cols-1 gap-x-7 gap-y-2 sm:grid-cols-2">
                  {visibleTakeaways!.map((takeaway, i) => (
                    <FadeIn key={i} index={i}>
                      <li className="flex items-start gap-2.5 text-[0.8125rem] leading-snug text-foreground/75">
                        <span
                          aria-hidden="true"
                          className="mt-[0.4rem] h-1 w-1 rounded-full bg-foreground/30 shrink-0"
                        />
                        <span>{takeaway}</span>
                      </li>
                    </FadeIn>
                  ))}
                </ul>
              </CollapsibleSection>
            </FadeIn>
          )}
        </div>
      ) : null}

      {hasTabs && (
        <TooltipProvider delayDuration={300}>
          <div
            role="tablist"
            aria-label="Video insight sections"
            className={cn(
              'sticky top-0 z-20 flex items-center gap-1.5 overflow-x-auto scroll-smooth',
              'border-t border-border/60 bg-card/85 backdrop-blur-md',
              'rounded-b-2xl px-3 py-2.5 md:px-4',
              '[mask-image:linear-gradient(to_right,transparent,black_16px,black_calc(100%-16px),transparent)]',
              '[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]',
            )}
          >
            {safeTabs.map((tab) => {
              const isActive = tab.id === activeTabId;
              const isCompleted = completedTabs?.has(tab.id) ?? false;
              const label = stripLeadingEmoji(tab.label);
              const button = (
                <button
                  key={tab.id}
                  type="button"
                  id={`tab-${tab.id}`}
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`panel-${tab.id}`}
                  onClick={() => onTabSelect?.(tab.id)}
                  className={cn(
                    'group relative inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap',
                    'rounded-xl px-3.5 py-2 text-sm transition-all duration-200',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    isActive
                      ? 'font-semibold text-primary-foreground shadow-md shadow-primary/15'
                      : 'font-medium border border-border/60 bg-muted/30 text-foreground/80 hover:bg-muted/60 hover:text-foreground',
                  )}
                  style={
                    isActive && domainGradient
                      ? { background: domainGradient }
                      : undefined
                  }
                >
                  {tab.emoji && (
                    <span aria-hidden="true" className="text-[0.95rem] leading-none">
                      {tab.emoji}
                    </span>
                  )}
                  <span>{label}</span>
                  {isCompleted && !isActive && (
                    <Check className="h-3.5 w-3.5 shrink-0 text-success" aria-label="Completed" />
                  )}
                </button>
              );
              if (!tab.preview) return button;
              return (
                <Tooltip key={tab.id}>
                  <TooltipTrigger asChild>{button}</TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs max-w-[220px]">
                    {tab.preview}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </TooltipProvider>
      )}
    </motion.section>
  );
});
