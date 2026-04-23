import { memo } from 'react';
import { motion } from 'motion/react';
import { Play, X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { springs } from '@/lib/motion';
import { useVideoPlayer } from '@/features/video-output/contexts/VideoPlayerContext';
import { YouTubePlayer } from '@/components/videos/YouTubePlayer';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { TabDefinition } from '@vie/types';

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
  className?: string;
}

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function stripDuplicatedEmoji(label: string, emoji?: string): string {
  if (!emoji || !label) return label;
  if (label.startsWith(emoji)) return label.slice(emoji.length).trimStart();
  return label;
}

export const VideoHero = memo(function VideoHero({
  title,
  creator,
  duration,
  tldr,
  youtubeId,
  tabs,
  activeTabId,
  onTabSelect,
  completedTabs,
  domainGradient,
  className,
}: VideoHeroProps) {
  const { togglePlayer, isPlayerOpen, playerRef } = useVideoPlayer();
  const durationStr = formatDuration(duration);
  const safeTabs: VideoHeroTab[] = tabs ?? [];
  const hasTabs = safeTabs.length > 0;

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
      <div className="px-6 pt-5 md:px-7 md:pt-6">
        <h2
          id="vie-hero-title"
          className="font-semibold text-2xl md:text-[1.7rem] tracking-tight leading-tight line-clamp-2 text-balance"
        >
          {title || 'Processing…'}
        </h2>
        <div className="flex items-center gap-2.5 mt-2 text-sm text-muted-foreground">
          {creator && <span className="truncate font-medium">{creator}</span>}
          {creator && durationStr && (
            <span aria-hidden="true" className="text-muted-foreground/40">•</span>
          )}
          {durationStr && <span className="shrink-0 tabular-nums">{durationStr}</span>}
        </div>

        {youtubeId && (
          <div className="flex items-center gap-2 mt-4">
            <button
              type="button"
              onClick={togglePlayer}
              className="cta-magnetic cursor-pointer inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-primary-foreground"
              aria-expanded={isPlayerOpen}
            >
              {isPlayerOpen ? (
                <>
                  <X className="h-4 w-4 shrink-0" aria-hidden="true" />
                  Hide
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 shrink-0" aria-hidden="true" />
                  Watch
                </>
              )}
            </button>
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
            <div className="px-6 pb-4 md:px-7">
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
          <div className="px-6 pb-5 md:px-7 md:pb-6">
            {tldr ? (
              <p className="text-[0.95rem] text-muted-foreground leading-relaxed max-w-prose text-pretty">
                {tldr}
              </p>
            ) : (
              <div className="h-12 rounded-lg bg-muted/30 animate-pulse" aria-hidden="true" />
            )}
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
              const label = stripDuplicatedEmoji(tab.label, tab.emoji);
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
