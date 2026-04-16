import { memo, useState, useMemo, useEffect } from 'react';
import { Clock, ChevronDown, ChevronUp, Share2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { FadeIn, Badge, GlassCard } from '@/components/vie';


interface ClipEntry {
  label: string;
  description?: string;
  startSeconds: number;
  endSeconds?: number;
  time: string;
  mood?: string;
  tags?: string[];
  thumbnailUrl?: string;
}

interface ClipPlayerInteractiveProps {
  clips: ClipEntry[];
  filters?: boolean;
  onSeek?: (seconds: number) => void;
  nextTab?: string;
  onNavigateTab?: (id: string) => void;
}

/** Mood-to-OKLCH color mapping for left border */
const MOOD_COLORS: Record<string, string> = {
  highlight: 'oklch(85% 0.15 85)',  // warm yellow
  info: 'oklch(70% 0.12 240)',      // blue
  demo: 'oklch(75% 0.15 145)',      // green
  warning: 'oklch(65% 0.18 25)',    // red
};

const DEFAULT_MOOD_COLOR = 'oklch(70% 0.05 250)'; // neutral

function getMoodColor(mood?: string): string {
  if (!mood) return DEFAULT_MOOD_COLOR;
  return MOOD_COLORS[mood.toLowerCase()] ?? DEFAULT_MOOD_COLOR;
}

export const ClipPlayerInteractive = memo(function ClipPlayerInteractive({
  clips,
  filters,
  onSeek,
  nextTab: _nextTab,
  onNavigateTab: _onNavigateTab,
}: ClipPlayerInteractiveProps) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [moodFilter, setMoodFilter] = useState<string | null>(null);

  // Clear expanded indices when filter changes (indices shift)
  useEffect(() => {
    setExpanded(new Set());
  }, [moodFilter]);

  const uniqueMoods = useMemo(() => {
    const moods = new Set<string>();
    for (const clip of clips) {
      if (clip.mood) moods.add(clip.mood);
    }
    return Array.from(moods);
  }, [clips]);

  const filtered = useMemo(
    () => (moodFilter ? clips.filter((c) => c.mood === moodFilter) : clips),
    [clips, moodFilter],
  );

  const toggleExpand = (index: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const copyTimestampUrl = (seconds: number) => {
    const url = new URL(window.location.href);
    url.hash = `t=${seconds}`;
    navigator.clipboard.writeText(url.toString()).catch(() => {});
  };

  if (clips.length === 0) return null;

  return (
    <div className="space-y-4">
      {/* Mood filter pills */}
      {filters !== false && uniqueMoods.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setMoodFilter(null)}
            className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
              moodFilter === null
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-muted/20 text-muted-foreground border-border/50 hover:bg-muted/40'
            }`}
          >
            All
          </button>
          {uniqueMoods.map((mood) => (
            <button
              key={mood}
              onClick={() => setMoodFilter(moodFilter === mood ? null : mood)}
              className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors capitalize ${
                moodFilter === mood
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted/20 text-muted-foreground border-border/50 hover:bg-muted/40'
              }`}
              style={moodFilter !== mood ? { borderLeftColor: getMoodColor(mood), borderLeftWidth: 'calc(var(--border-width) * 3)' } : undefined}
            >
              {mood}
            </button>
          ))}
        </div>
      )}

      {/* Clip list */}
      <div className="space-y-2">
        {filtered.map((clip, index) => {
          const isExpanded = expanded.has(index);
          const moodColor = getMoodColor(clip.mood);
          return (
            <FadeIn key={index} index={index}>
              <GlassCard
                variant="outlined"
                className="p-0 overflow-hidden"
                style={{ borderLeftWidth: 'calc(var(--border-width) * 4)', borderLeftColor: moodColor }}
              >
                <button
                  type="button"
                  onClick={() => toggleExpand(index)}
                  className="w-full text-start px-4 py-3 flex items-center gap-3 transition-colors hover:bg-muted/30"
                >
                  {/* 48px thumbnail on left */}
                  {clip.thumbnailUrl && (
                    <img
                      src={clip.thumbnailUrl}
                      alt={clip.label}
                      loading="lazy"
                      className="w-12 h-12 rounded object-cover shrink-0 border border-border/30"
                    />
                  )}
                  <span
                    role={onSeek ? "button" : undefined}
                    tabIndex={onSeek ? 0 : undefined}
                    onClick={onSeek ? (e) => { e.stopPropagation(); onSeek(clip.startSeconds); } : undefined}
                    onKeyDown={onSeek ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); e.preventDefault(); onSeek(clip.startSeconds); } } : undefined}
                    className={cn(
                      "text-xs font-bold tabular-nums text-primary bg-primary/10 px-2 py-0.5 rounded-md shrink-0 inline-flex items-center gap-1",
                      onSeek && "cursor-pointer hover:bg-primary/20 transition-colors"
                    )}
                  >
                    <Clock className="h-3 w-3" aria-hidden="true" />
                    {clip.time}
                  </span>
                  <span className="flex-1 text-sm font-medium truncate">{clip.label}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    {clip.mood && <Badge variant="muted" className="text-xs capitalize">{clip.mood}</Badge>}
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </button>

                {isExpanded && (
                  <FadeIn>
                    <div className="px-4 pb-3 space-y-2">
                      {clip.description && (
                        <p className="text-sm text-muted-foreground">{clip.description}</p>
                      )}
                      {clip.tags && clip.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {clip.tags.map((tag, i) => (
                            <Badge key={i} variant="muted" className="text-xs">{tag}</Badge>
                          ))}
                        </div>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyTimestampUrl(clip.startSeconds)}
                        className="text-xs gap-1.5 text-muted-foreground"
                      >
                        <Share2 className="h-3 w-3" aria-hidden="true" />
                        Share clip
                      </Button>
                    </div>
                  </FadeIn>
                )}
              </GlassCard>
            </FadeIn>
          );
        })}
      </div>

    </div>
  );
});
