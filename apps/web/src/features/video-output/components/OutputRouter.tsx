import { useMemo, useRef } from 'react';
import { isContentTag } from '@vie/types';
import type { TabEntry, SynthesisResult, ContentTag, VIEResponseMeta } from '@vie/types';
import { TabLayout, type TabLayoutHandle } from './output/TabLayout';
import { TabCoordinationProvider } from './output/TabCoordinationContext';
import { TabStateProvider } from '@/features/video-output/contexts/TabStateContext';
import { GlassCard } from './output/GlassCard';
import { ComposableOutput } from './output/ComposableOutput';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { VideoHero } from '@/components/vie';
import { stripLeadingEmoji } from '@/lib/string-utils';
import { DirectionProvider } from '@/contexts/DirectionContext';
import type { StreamPhase } from '@/features/video-output/hooks/use-summary-stream';
import { STREAM_PHASE_LABELS } from '@/features/video-output/hooks/use-summary-stream';

interface OutputRouterProps {
  /** Video title for display. */
  title: string;
  /** Video summary ID for tab coordination. */
  videoSummaryId: string;
  /** Assembled tabs (from API or streaming). */
  tabs: TabEntry[] | null;
  /** Video meta (VIEResponseMeta shape from API/streaming). */
  meta: VIEResponseMeta | null;
  /** Synthesis result for TLDR/takeaways. */
  synthesis: SynthesisResult | null;
  /** Whether the video is currently streaming. */
  isStreaming?: boolean;
  /** Total expected tab count (for progress indicator during streaming). */
  tabCount?: number;
  /** Tab labels from meta event (for skeleton tab bar). */
  tabLabels?: { id: string; label: string; emoji: string }[];
  /** YouTube video ID for embedded player. */
  youtubeId?: string;
  /** Video creator/channel name. */
  creator?: string;
  /** Video duration in seconds. */
  duration?: number | null;
  /** ISO 639-1 language code (e.g., "en", "he"). */
  language?: string;
  /** Whether the video content is in a right-to-left language. */
  isRTL?: boolean;
  /** Current streaming phase (for skeleton label). */
  streamPhase?: StreamPhase;
}

/**
 * Top-level output router.
 * Renders VideoHero + assembled tabs using component-addressed rendering.
 */
export function OutputRouter({
  title,
  videoSummaryId,
  tabs,
  meta,
  synthesis,
  isStreaming,
  tabCount = 0,
  tabLabels = [],
  youtubeId,
  creator,
  duration,
  language,
  isRTL: isRTLProp,
  streamPhase,
}: OutputRouterProps) {
  const tabLayoutRef = useRef<TabLayoutHandle>(null);

  const primaryTag = useMemo((): ContentTag => {
    const raw = typeof meta?.primaryTag === 'string' ? meta.primaryTag : '';
    if (isContentTag(raw)) return raw;
    if (raw && import.meta.env.DEV) {
      console.warn(`[OutputRouter] Invalid primaryTag "${raw}", defaulting to learning`);
    }
    return 'learning';
  }, [meta]);

  // Build tab definitions, stripping emoji from labels to avoid duplication with the emoji field
  const tabDefs = useMemo(() => {
    if (!tabs || tabs.length === 0) return [];
    return tabs.map(t => ({
      id: t.id,
      label: t.emoji ? stripLeadingEmoji(t.label) : t.label,
      emoji: t.emoji,
      dataSource: '',
    }));
  }, [tabs]);

  const hasData = tabs != null && tabs.length > 0;

  if (!hasData && !isStreaming) return null;

  return (
    <DirectionProvider language={language} isRTL={isRTLProp}>
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 md:gap-8 px-4 pt-6 pb-8 md:px-6 md:pt-10 md:pb-12">
      {/* Interactive Hero */}
      <VideoHero
        title={title}
        creator={creator}
        duration={duration}
        tldr={synthesis?.tldr}
        keyTakeaways={synthesis?.keyTakeaways}
        masterSummary={synthesis?.masterSummary}
        youtubeId={youtubeId}
      />

      {/* Tab content */}
      {hasData && tabDefs.length > 0 ? (
        <TabCoordinationProvider
          videoId={videoSummaryId}
          initialTab={tabDefs[0].id}
        >
          <TabStateProvider videoId={videoSummaryId}>
            <TabLayout
              ref={tabLayoutRef}
              tabs={tabDefs}
              primaryTag={primaryTag}
              isStreaming={isStreaming}
              totalCount={tabCount}
              phaseLabel={streamPhase ? STREAM_PHASE_LABELS[streamPhase] : undefined}
            >
              {(activeTabId, onNavigateTab) => (
                <ErrorBoundary
                  fallback={
                    <GlassCard>
                      <p className="text-sm text-muted-foreground text-center py-6">
                        Something went wrong rendering this tab. Try switching to another tab.
                      </p>
                    </GlassCard>
                  }
                >
                  <ComposableOutput
                    response={null}
                    tabs={tabs}
                    activeTab={activeTabId}
                    onNavigateTab={onNavigateTab}
                    primaryTag={primaryTag}
                  />
                </ErrorBoundary>
              )}
            </TabLayout>
          </TabStateProvider>
        </TabCoordinationProvider>
      ) : isStreaming ? (
        <div className="flex flex-col gap-6">
          {tabLabels.length > 0 ? (
            <div className="flex gap-2 overflow-x-auto px-1 py-2">
              {tabLabels.map((t, i) => (
                <div
                  key={t.id}
                  className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-border/30 bg-muted/20 px-3.5 py-1.5 text-sm text-muted-foreground/70 animate-[fadeUp_0.5s_var(--ease-spring)_both]"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <span>{t.emoji}</span>
                  <span>{t.label}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-10 rounded-xl bg-muted/30 animate-pulse" />
          )}
          {/* Phase-aware streaming skeleton — scene-setting, not placeholder */}
          <div className="relative flex flex-col items-center justify-center gap-5 rounded-3xl border border-[var(--glass-border-strong)] bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] py-20 overflow-hidden"
               style={{ boxShadow: 'var(--glass-shadow-elevated)' }}>
            {/* Radial gradient backdrop */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,var(--primary)/6%,transparent_60%)] pointer-events-none" />
            {/* Phase emoji — scales with easing on phase change, with breathing glow */}
            <div className="relative">
              <span
                className="absolute inset-[-20%] rounded-full bg-primary/20 blur-2xl animate-[emoji-breathe_3s_ease-in-out_infinite]"
                aria-hidden="true"
              />
              <div key={streamPhase} className="relative text-5xl animate-[popIn_0.5s_var(--ease-spring)_both]" aria-hidden="true">
                {streamPhase === 'metadata' && '🎬'}
                {streamPhase === 'triage' && '🔍'}
                {streamPhase === 'extraction' && '🧩'}
                {streamPhase === 'enrichment' && '✨'}
                {streamPhase === 'synthesis' && '📝'}
                {(!streamPhase || streamPhase === 'idle' || streamPhase === 'connecting') && '⚡'}
              </div>
            </div>
            {/* Phase label */}
            <p className="relative text-base md:text-lg font-semibold text-foreground">
              {streamPhase ? STREAM_PHASE_LABELS[streamPhase] : 'Preparing...'}
            </p>
            {/* Animated progress dots — staggered */}
            <div className="relative flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-pulse"
                  style={{ animationDelay: `${i * 200}ms`, animationDuration: '1.2s' }}
                />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <GlassCard>
          <p className="text-sm text-muted-foreground text-center py-6">
            Content extraction was incomplete for this video.
          </p>
        </GlassCard>
      )}

      {/* Footer */}
      <p className="text-center text-xs text-muted-foreground/60">
        AI-generated summary. Verify important details with the original video.
      </p>
    </div>
    </DirectionProvider>
  );
}
