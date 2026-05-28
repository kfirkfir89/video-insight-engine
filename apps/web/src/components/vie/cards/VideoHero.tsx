import { memo, useCallback, useState } from 'react';
import { motion } from 'motion/react';
import { Play, X, Check, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { springs } from '@/lib/motion';
import { stripLeadingEmoji } from '@/lib/string-utils';
import { useLabels } from '@/lib/i18n';
import { useVideoPlayer } from '@/features/video-output/contexts/VideoPlayerContext';
import { YouTubePlayer } from '@/components/videos/YouTubePlayer';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { FadeIn } from '@/components/vie';
import { CollapsibleSection } from './CollapsibleSection';
import { emojiForTakeaway } from '@/lib/takeaway-emoji';
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

// Brief and Takeaways collapse state is a global UI *preference* (visual
// density), not per-video *content interaction* — so the keys are global,
// matching how chrome density toggles behave elsewhere. Per-video bookmarks
// (e.g. starred Overview highlights) use a different `${prefix}-${videoId}`
// convention because they belong to the content, not the chrome.
const BRIEF_KEY = 'vie-hero-brief-open';
const TAKEAWAYS_KEY = 'vie-hero-takeaways-open';

function readPersistedOpen(key: string): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const saved = window.localStorage.getItem(key);
    if (saved === null) return true;
    return saved === 'true';
  } catch {
    return true;
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

  // Brief and Key takeaways each have an independent collapsible state. Default
  // open on first visit so the briefing lands, but persist the user's choice
  // globally — returning users land in the compact state they chose.
  const [briefOpen, setBriefOpen] = useState<boolean>(() => readPersistedOpen(BRIEF_KEY));
  const [takeawaysOpen, setTakeawaysOpen] = useState<boolean>(() => readPersistedOpen(TAKEAWAYS_KEY));

  const toggleBrief = useCallback(() => {
    setBriefOpen((prev) => {
      const next = !prev;
      writePersistedOpen(BRIEF_KEY, next);
      return next;
    });
  }, []);

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
      {/* Domain-tinted accent line along the top edge. Clipped via its own
          rounded-t-2xl + overflow-hidden so we don't need overflow-hidden on
          the section (which would break the sticky tab strip below). */}
      {domainGradient && (
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-px overflow-hidden rounded-t-2xl opacity-70"
          style={{ background: domainGradient }}
        />
      )}

      <div className="px-6 pt-5 md:px-7 md:pt-6">
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
            'mt-2.5 font-semibold tracking-tight leading-[1.15] text-balance line-clamp-2',
            'text-xl md:text-2xl',
          )}
        >
          {title || t.processing}
        </h2>

        {youtubeId && (
          <div className="flex flex-wrap items-center gap-2 mt-4">
            <button
              type="button"
              onClick={togglePlayer}
              className="cta-magnetic cursor-pointer inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-primary-foreground"
              aria-expanded={isPlayerOpen}
            >
              {isPlayerOpen ? (
                <>
                  <X className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {t.hide}
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {t.watch}
                </>
              )}
            </button>
            {!isPlayerOpen && (
              <a
                href={`https://youtu.be/${youtubeId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm font-medium text-foreground/85 transition-colors hover:bg-muted/55 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                YouTube
              </a>
            )}
          </div>
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

      <div
        className={cn(
          'grid transition-[grid-template-rows,opacity] duration-300 ease-[var(--ease-out-expo)]',
          isPlayerOpen ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100',
        )}
      >
        <div className="overflow-hidden">
          <div className="px-6 pb-5 md:px-7 md:pb-6 pt-5 space-y-4">
            <FadeIn>
              <CollapsibleSection
                baseId="vie-hero-brief"
                label={t.brief}
                open={briefOpen}
                onToggle={toggleBrief}
              >
                {isStreaming ? (
                  <div className="space-y-1.5" aria-hidden="true">
                    <div className="h-4 w-full rounded bg-muted/30 animate-pulse" />
                    <div className="h-4 w-4/5 rounded bg-muted/30 animate-pulse" />
                    <div className="h-4 w-2/3 rounded bg-muted/30 animate-pulse" />
                  </div>
                ) : (
                  <p className="text-[0.975rem] md:text-base leading-relaxed text-foreground/85 max-w-prose text-pretty">
                    {tldr}
                  </p>
                )}
              </CollapsibleSection>
            </FadeIn>

            {(visibleTakeaways && visibleTakeaways.length > 0) || isStreaming ? (
              <FadeIn index={1}>
                <CollapsibleSection
                  baseId="vie-hero-takeaways"
                  label={t.keyTakeaways}
                  open={takeawaysOpen}
                  onToggle={toggleTakeaways}
                >
                  <ul className="space-y-2.5">
                    {isStreaming
                      ? Array.from({ length: 4 }, (_, i) => (
                          <li key={i} className="flex items-start gap-3" aria-hidden="true">
                            <span className="h-5 w-5 rounded-full bg-muted/30 animate-pulse shrink-0" />
                            <span
                              className="h-4 rounded bg-muted/30 animate-pulse"
                              style={{ width: `${88 - i * 12}%` }}
                            />
                          </li>
                        ))
                      : visibleTakeaways!.map((takeaway, i) => (
                          <FadeIn key={i} index={i}>
                            <li className="flex items-start gap-3 text-[0.95rem] leading-relaxed text-foreground/90">
                              <span
                                aria-hidden="true"
                                className="text-base leading-none shrink-0 mt-0.5"
                              >
                                {emojiForTakeaway(takeaway, primaryTag)}
                              </span>
                              <span>{takeaway}</span>
                            </li>
                          </FadeIn>
                        ))}
                  </ul>
                </CollapsibleSection>
              </FadeIn>
            ) : null}
          </div>
        </div>
      </div>

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
