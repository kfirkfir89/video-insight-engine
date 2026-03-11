import { useMemo, useRef } from 'react';
import type { VideoResponse, VideoOutput, VIEResponse } from '@vie/types';
import type { StreamState } from '../../hooks/use-summary-stream';
import { getContentTagConfig } from '../../lib/output-type-config';
import { TabLayout, type TabLayoutHandle } from './output/TabLayout';
import { TabCoordinationProvider } from './output/TabCoordinationContext';
import { GlassCard } from './output/GlassCard';
import { ComposableOutput } from './output/ComposableOutput';

interface OutputRouterProps {
  video: VideoResponse;
  output: VideoOutput | null;
  isStreaming?: boolean;
  streamingState?: StreamState;
}

/**
 * Top-level output router.
 * Builds VIEResponse from VideoOutput and renders the composable tab system.
 */
export function OutputRouter({
  video,
  output,
  isStreaming,
}: OutputRouterProps) {
  if (!output) return null;

  const tabLayoutRef = useRef<TabLayoutHandle>(null);
  const { triage, synthesis } = output;
  const primaryTag = triage.primaryTag;
  const config = getContentTagConfig(primaryTag);
  const hasData = !!output.output;

  // Build VIEResponse from VideoOutput
  const vieResponse = useMemo((): VIEResponse => {
    const domainData = output.output ?? {};
    return {
      meta: {
        videoId: video.videoSummaryId,
        videoTitle: video.title,
        creator: video.channel ?? '',
        contentTags: triage.contentTags,
        modifiers: triage.modifiers,
        primaryTag: triage.primaryTag,
        userGoal: triage.userGoal,
      },
      tabs: triage.tabs,
      // Spread domain-keyed data
      ...(domainData as Record<string, unknown>),
      // Enrichment
      ...(output.enrichment?.quiz ? { quizzes: output.enrichment.quiz } : {}),
      ...(output.enrichment?.flashcards ? { flashcards: output.enrichment.flashcards } : {}),
      ...(output.enrichment?.scenarios ? { scenarios: output.enrichment.scenarios } : {}),
    } as VIEResponse;
  }, [output, video, triage]);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-4 md:p-6">
      {/* VIE Header Bar */}
      <div className="flex h-12 items-center gap-3 rounded-xl bg-primary px-4 text-primary-foreground">
        <span className="text-lg">{config.emoji}</span>
        <h2 className="flex-1 truncate text-sm font-semibold">{video.title}</h2>
      </div>

      {/* TLDR Strip */}
      {synthesis && synthesis.tldr && (
        <GlassCard variant="outlined" className="px-4 py-3">
          <p className="text-sm text-muted-foreground leading-relaxed">{synthesis.tldr}</p>
        </GlassCard>
      )}

      {/* Tab content */}
      {hasData && triage.tabs.length > 0 ? (
        <TabCoordinationProvider
          videoId={video.videoSummaryId}
          initialTab={triage.tabs[0].id}
        >
          <TabLayout
            ref={tabLayoutRef}
            tabs={triage.tabs}
            primaryTag={primaryTag}
          >
            {(activeTabId, onNavigateTab) => (
              <ComposableOutput
                response={vieResponse}
                activeTab={activeTabId}
                onNavigateTab={onNavigateTab}
              />
            )}
          </TabLayout>
        </TabCoordinationProvider>
      ) : isStreaming ? (
        <div className="flex flex-col gap-4">
          <div className="h-10 rounded-xl bg-muted/30 animate-pulse" />
          <div className="h-48 rounded-2xl bg-muted/20 animate-pulse" />
        </div>
      ) : null}

      {/* Key takeaways */}
      {synthesis && synthesis.keyTakeaways.length > 0 && (
        <GlassCard variant="elevated">
          <h3 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">Key Takeaways</h3>
          <ul className="flex flex-col gap-2">
            {synthesis.keyTakeaways.map((t, i) => (
              <li key={i} className="flex gap-2 text-sm">
                <span className="text-primary">{'\u{1F3AF}'}</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </GlassCard>
      )}

      {/* Footer */}
      <p className="text-center text-xs text-muted-foreground/60">
        AI-generated summary. Verify important details with the original video.
      </p>
    </div>
  );
}
