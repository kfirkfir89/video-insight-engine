import { memo, useState, useCallback, useRef, useEffect, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, Play, Sparkles, BookOpen, ArrowLeft, X } from 'lucide-react';

/** Rotating highlight emojis for takeaway items (no data emojis available). */
const TAKEAWAY_EMOJIS = ['🔥', '🧩', '📊', '🪝', '💡', '⚡', '🎯', '🛡️'];

type HeroFace = 'front' | 'takeaways' | 'overview';

interface VideoHeroProps {
  title: string;
  creator?: string;
  duration?: number | null;
  tldr?: string;
  keyTakeaways?: string[];
  masterSummary?: string;
  youtubeId?: string;
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

const YOUTUBE_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;

function VideoModal({ youtubeId, onClose }: { youtubeId: string; onClose: () => void }) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  // Focus trap: cycle focus within the modal
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'Tab') {
      // Only one focusable element (close button), trap focus on it
      e.preventDefault();
      closeRef.current?.focus();
    }
  };

  if (!YOUTUBE_ID_REGEX.test(youtubeId)) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-[fadeIn_0.2s_ease_both]"
      onClick={onClose}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-label="Video player"
      tabIndex={-1}
    >
      <div
        className="relative w-full max-w-3xl mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          ref={closeRef}
          onClick={onClose}
          className="absolute -top-10 end-0 flex items-center gap-1 text-white/80 hover:text-white text-sm transition-colors"
          aria-label="Close video"
        >
          <X className="h-4 w-4" />
          Close
        </button>
        <div className="relative w-full rounded-xl overflow-hidden" style={{ paddingBottom: '56.25%' }}>
          <iframe
            className="absolute inset-0 w-full h-full"
            src={`https://www.youtube.com/embed/${encodeURIComponent(youtubeId)}?autoplay=1&rel=0`}
            title="Video player"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Interactive hero card with horizontal flip animation between 3 logical faces.
 *
 * Uses a 2-panel flip (front/back) with content swapping at the midpoint
 * of the animation — avoids the CSS `rotateY(360deg) === 0deg` problem.
 *
 * Face 1 (front): title, creator, duration + expandable TLDR + action buttons
 * Face 2 (takeaways): key takeaways list
 * Face 3 (overview): master summary
 */
export const VideoHero = memo(function VideoHero({
  title,
  creator,
  duration,
  tldr,
  keyTakeaways = [],
  masterSummary,
  youtubeId,
  className,
}: VideoHeroProps) {
  const [face, setFace] = useState<HeroFace>('front');
  const [expanded, setExpanded] = useState(false);
  const [showVideo, setShowVideo] = useState(false);

  // Flip animation state: content swaps at the midpoint (card edge-on)
  const [isFlipping, setIsFlipping] = useState(false);
  const [flipDirection, setFlipDirection] = useState<'forward' | 'backward'>('forward');
  const [displayFace, setDisplayFace] = useState<HeroFace>('front');
  const pendingFace = useRef<HeroFace>('front');

  const durationStr = formatDuration(duration);
  const hasTakeaways = keyTakeaways.length > 0;
  const hasMasterSummary = !!masterSummary;

  const goToFace = useCallback((next: HeroFace) => {
    if (isFlipping || next === face) return;

    // Determine flip direction based on face order
    const order: HeroFace[] = ['front', 'takeaways', 'overview'];
    const fromIdx = order.indexOf(face);
    const toIdx = order.indexOf(next);
    setFlipDirection(toIdx > fromIdx ? 'forward' : 'backward');

    pendingFace.current = next;
    setFace(next);
    setIsFlipping(true);

    if (next === 'front') {
      setExpanded(false);
    }
  }, [face, isFlipping]);

  // At animation midpoint (250ms of 500ms), swap the displayed content
  useEffect(() => {
    if (!isFlipping) return;
    const midTimer = setTimeout(() => {
      setDisplayFace(pendingFace.current);
    }, 200);
    const endTimer = setTimeout(() => {
      setIsFlipping(false);
    }, 500);
    return () => {
      clearTimeout(midTimer);
      clearTimeout(endTimer);
    };
  }, [isFlipping]);

  const toggleExpand = useCallback(() => setExpanded((p) => !p), []);

  const handleClose = useCallback(() => {
    goToFace('front');
  }, [goToFace]);

  // ─── Face content renderers ───

  function renderFront(): ReactNode {
    return (
      <>
        {/* Header — always visible, clickable to expand */}
        <button
          onClick={toggleExpand}
          className="w-full flex items-center justify-between gap-3 px-5 py-4 text-start hover:bg-muted/10 transition-colors rounded-2xl"
          aria-expanded={expanded}
          aria-label={expanded ? 'Collapse hero' : 'Expand hero'}
        >
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-base truncate">{title || 'Processing...'}</h2>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              {creator && <span className="truncate">{creator}</span>}
              {creator && durationStr && <span aria-hidden="true">&middot;</span>}
              {durationStr && <span className="shrink-0">{durationStr}</span>}
            </div>
          </div>
          <ChevronDown
            className={cn(
              'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
              expanded && 'rotate-180',
            )}
            aria-hidden="true"
          />
        </button>

        {/* Expandable body */}
        <div
          className="grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
          style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}
        >
          <div className="overflow-hidden">
            <div className="px-5 pb-4">
              {tldr ? (
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">{tldr}</p>
              ) : (
                <div className="h-10 rounded-lg bg-muted/30 animate-pulse mb-4" />
              )}

              <div className="flex items-center justify-end gap-2">
                {youtubeId && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowVideo(true);
                    }}
                    className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    <Play className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    Watch Video
                  </button>
                )}
                {hasTakeaways && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      goToFace('takeaways');
                    }}
                    className="flex items-center gap-1.5 rounded-lg bg-muted/50 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                  >
                    <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    Key Takeaways
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  function renderTakeaways(): ReactNode {
    return (
      <div className="px-5 py-4">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Key Takeaways
        </h3>
        <div className="flex flex-col gap-3 mb-4">
          {keyTakeaways.map((t, i) => (
            <div key={i} className="flex gap-3 items-start">
              <span className="text-lg shrink-0 leading-none mt-0.5" aria-hidden="true">
                {TAKEAWAY_EMOJIS[i % TAKEAWAY_EMOJIS.length]}
              </span>
              <span className="text-sm font-medium leading-snug">{t}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => goToFace('front')}
            className="flex items-center gap-1.5 rounded-lg bg-muted/50 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5 shrink-0 rtl:rotate-180" aria-hidden="true" />
            Back
          </button>
          {hasMasterSummary && (
            <button
              onClick={() => goToFace('overview')}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <BookOpen className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Overview
            </button>
          )}
        </div>
      </div>
    );
  }

  function renderOverview(): ReactNode {
    return (
      <div className="px-5 py-4">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
          <BookOpen className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Overview
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line mb-4">
          {masterSummary}
        </p>

        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => goToFace('takeaways')}
            className="flex items-center gap-1.5 rounded-lg bg-muted/50 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5 shrink-0 rtl:rotate-180" aria-hidden="true" />
            Back
          </button>
          <button
            onClick={handleClose}
            className="flex items-center gap-1.5 rounded-lg bg-muted/50 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
          >
            <X className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Close
          </button>
        </div>
      </div>
    );
  }

  const FACE_RENDERERS: Record<HeroFace, () => ReactNode> = {
    front: renderFront,
    takeaways: renderTakeaways,
    overview: renderOverview,
  };

  // Flip animation CSS class
  const flipClass = isFlipping
    ? flipDirection === 'forward'
      ? 'animate-[heroFlipForward_500ms_ease-in-out_both]'
      : 'animate-[heroFlipBackward_500ms_ease-in-out_both]'
    : '';

  return (
    <>
      <div
        className={cn('relative w-full', className)}
        style={{ perspective: '1200px' }}
      >
        <div
          className={cn(
            'w-full rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur,20px)] shadow-[var(--glass-shadow)]',
            flipClass,
          )}
          style={{ transformStyle: 'preserve-3d' }}
        >
          {FACE_RENDERERS[displayFace]()}
        </div>
      </div>

      {/* Video Modal Overlay */}
      {showVideo && youtubeId && (
        <VideoModal youtubeId={youtubeId} onClose={() => setShowVideo(false)} />
      )}
    </>
  );
});
