import { useMemo, useRef } from 'react';
import { isContentTag } from '@vie/types';
import type { TabEntry, SynthesisResult, ContentTag, VIEResponseMeta } from '@vie/types';
import { TabLayout, type TabLayoutHandle } from './output/TabLayout';
import { TabCoordinationProvider } from './output/TabCoordinationContext';
import { TabStateProvider } from '@/contexts/TabStateContext';
import { GlassCard } from './output/GlassCard';
import { ComposableOutput } from './output/ComposableOutput';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { VideoHero } from '@/components/vie';
import { stripLeadingEmoji } from '@/lib/string-utils';

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
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-4 md:p-6">
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
        <div className="flex flex-col gap-4">
          {tabLabels.length > 0 ? (
            <div className="flex gap-1.5 overflow-x-auto px-1 py-2">
              {tabLabels.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center gap-1 whitespace-nowrap rounded-full bg-muted/30 px-2.5 py-1 text-xs text-muted-foreground/60"
                >
                  <span>{t.emoji}</span>
                  <span>{t.label}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-8 rounded-xl bg-muted/30 animate-pulse" />
          )}
          <div className="h-48 rounded-2xl bg-muted/20 animate-pulse" />
        </div>
      ) : (
        <GlassCard>
          <p className="text-sm text-muted-foreground text-center py-6">
            Content extraction was incomplete for this video.
          </p>
        </GlassCard>
      )}

      {/* Progressive loading indicator for remaining tabs */}
      {isStreaming && tabs && tabCount > 0 && tabs.length < tabCount && (
        <div className="text-center py-3 text-sm text-muted-foreground animate-pulse">
          Loading tabs... ({tabs.length}/{tabCount})
        </div>
      )}

      {/* Footer */}
      <p className="text-center text-xs text-muted-foreground/60">
        AI-generated summary. Verify important details with the original video.
      </p>
    </div>
  );
}
