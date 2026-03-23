import { memo, useState, useEffect, useRef, useCallback } from 'react';
import { Check, X, ThumbsUp, ThumbsDown, ChevronDown, ChevronUp } from 'lucide-react';
import { HeroCard, FadeIn, Badge, StatPill, ScoreRing } from '@/components/vie';
import { GlassCard } from '../GlassCard';
import { Button } from '@/components/ui/button';


interface SubScore {
  category: string;
  score: number;
}

interface VerdictInteractiveProps {
  product: string;
  score?: number;
  maxScore?: number;
  badge?: string;
  bottomLine: string;
  bestFor?: string[];
  notFor?: string[];
  price?: string;
  subScores?: SubScore[];
  videoId?: string;
  nextTab?: string;
  onNavigateTab?: (id: string) => void;
}

const BADGE_COLORS: Record<string, 'success' | 'warning' | 'destructive' | 'info'> = {
  recommended: 'success',
  best_in_class: 'success',
  conditional: 'warning',
  not_recommended: 'destructive',
};

type Vote = 'agree' | 'disagree';
const VOTE_KEY = (id: string) => `vie-verdict-vote-${id}`;

export const VerdictInteractive = memo(function VerdictInteractive({
  product,
  score,
  maxScore = 10,
  badge = 'neutral',
  bottomLine,
  bestFor,
  notFor,
  price,
  subScores,
  videoId,
  nextTab: _nextTab,
  onNavigateTab: _onNavigateTab,
}: VerdictInteractiveProps) {
  const [animatedScore, setAnimatedScore] = useState(0);
  const [userVote, setUserVote] = useState<Vote | null>(null);
  const [bestForExpanded, setBestForExpanded] = useState(true);
  const [notForExpanded, setNotForExpanded] = useState(true);
  const animRef = useRef<number>(0);

  // Load saved vote
  useEffect(() => {
    if (!videoId) return;
    try {
      const saved = localStorage.getItem(VOTE_KEY(videoId));
      if (saved === 'agree' || saved === 'disagree') setUserVote(saved);
    } catch { /* localStorage may fail */ }
  }, [videoId]);

  // Animate score on mount
  useEffect(() => {
    if (score == null) return;
    const target = score;
    const duration = 700;
    const start = performance.now();

    const step = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedScore(parseFloat((eased * target).toFixed(1)));
      if (progress < 1) animRef.current = requestAnimationFrame(step);
    };
    animRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animRef.current);
  }, [score]);

  const handleVote = useCallback((vote: Vote) => {
    setUserVote(vote);
    if (videoId) {
      try { localStorage.setItem(VOTE_KEY(videoId), vote); }
      catch { /* ignore */ }
    }
  }, [videoId]);

  return (
    <div className="space-y-4">
      {/* Hero */}
      <HeroCard emoji="⚖️" title={product} subtitle="Verdict">
        <div className="flex items-center gap-3 mt-2">
          <Badge variant={BADGE_COLORS[badge] ?? 'muted'} className="capitalize">
            {badge.replace(/_/g, ' ')}
          </Badge>
          {price && <StatPill value={price} label="Price" />}
        </div>
      </HeroCard>

      {/* Animated score ring */}
      {score != null && (
        <FadeIn>
          <div className="flex justify-center py-2">
            <ScoreRing score={animatedScore} total={maxScore} label="Score" size="lg" />
          </div>
        </FadeIn>
      )}

      {/* Sub-category scores */}
      {subScores && subScores.length > 0 && (
        <FadeIn index={1}>
          <div className="overflow-x-auto">
            <div className="flex gap-4 pb-2 min-w-max px-1">
              {subScores.map((sub, i) => (
                <div key={i} className="flex flex-col items-center gap-1">
                  <ScoreRing score={sub.score} total={maxScore} size="sm" />
                  <span className="text-[10px] text-muted-foreground text-center max-w-[64px] truncate">
                    {sub.category}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </FadeIn>
      )}

      {/* Bottom line */}
      <FadeIn index={2}>
        <GlassCard variant="outlined">
          <p className="text-sm font-medium">{bottomLine}</p>
        </GlassCard>
      </FadeIn>

      {/* Agree / Disagree micro-poll */}
      <FadeIn index={3}>
        <GlassCard variant="subtle" className="flex items-center justify-center gap-3">
          {userVote ? (
            <p className="text-sm text-muted-foreground">
              Thanks for your feedback!
            </p>
          ) : (
            <>
              <span className="text-xs text-muted-foreground mr-1">Do you agree?</span>
              <Button
                variant="outline"
                size="sm"
                className="text-xs gap-1.5"
                onClick={() => handleVote('agree')}
              >
                <ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" />
                Agree
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs gap-1.5"
                onClick={() => handleVote('disagree')}
              >
                <ThumbsDown className="h-3.5 w-3.5" aria-hidden="true" />
                Disagree
              </Button>
            </>
          )}
        </GlassCard>
      </FadeIn>

      {/* Best For / Not For with collapsible headers */}
      {((bestFor?.length ?? 0) > 0 || (notFor?.length ?? 0) > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {bestFor && bestFor.length > 0 && (
            <FadeIn index={4}>
              <GlassCard variant="outlined" className="space-y-2">
                <button
                  onClick={() => setBestForExpanded((p) => !p)}
                  className="w-full flex items-center justify-between"
                >
                  <h4 className="text-xs font-bold uppercase tracking-wider text-success flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    Best For
                    <Badge variant="success" className="text-[10px]">{bestFor.length}</Badge>
                  </h4>
                  {bestForExpanded
                    ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                    : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  }
                </button>
                {bestForExpanded && (
                  <ul className="space-y-1.5">
                    {bestFor.map((item, i) => (
                      <li key={i} className="flex items-baseline gap-2 text-sm text-muted-foreground">
                        <span className="w-1 h-1 rounded-full bg-success/70 shrink-0 translate-y-1.5" />
                        {item}
                      </li>
                    ))}
                  </ul>
                )}
              </GlassCard>
            </FadeIn>
          )}
          {notFor && notFor.length > 0 && (
            <FadeIn index={5}>
              <GlassCard variant="outlined" className="space-y-2">
                <button
                  onClick={() => setNotForExpanded((p) => !p)}
                  className="w-full flex items-center justify-between"
                >
                  <h4 className="text-xs font-bold uppercase tracking-wider text-destructive flex items-center gap-1.5">
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                    Not For
                    <Badge variant="destructive" className="text-[10px]">{notFor.length}</Badge>
                  </h4>
                  {notForExpanded
                    ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                    : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  }
                </button>
                {notForExpanded && (
                  <ul className="space-y-1.5">
                    {notFor.map((item, i) => (
                      <li key={i} className="flex items-baseline gap-2 text-sm text-muted-foreground">
                        <span className="w-1 h-1 rounded-full bg-destructive/70 shrink-0 translate-y-1.5" />
                        {item}
                      </li>
                    ))}
                  </ul>
                )}
              </GlassCard>
            </FadeIn>
          )}
        </div>
      )}

    </div>
  );
});
