import { useMemo, useRef } from 'react';
import { isContentTag } from '@vie/types';
import type { TabEntry, SynthesisResult, ContentTag, VIEResponseMeta } from '@vie/types';
import { getDomainGradient } from '@vie/shared/config';
import { TabLayout, type TabLayoutHandle } from './output/TabLayout';
import {
  TabCoordinationProvider,
  useTabCoordination,
} from './output/TabCoordinationContext';
import { TabStateProvider } from '@/features/video-output/contexts/TabStateContext';
import { GlassCard } from './output/GlassCard';
import { ComposableOutput } from './output/ComposableOutput';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { VideoHero, EmojiMarker } from '@/components/vie';
import { stripLeadingEmoji } from '@/lib/string-utils';
import { DirectionProvider } from '@/contexts/DirectionContext';
import { getLabels } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { StreamPhase } from '@/features/video-output/hooks/use-summary-stream';
import { STREAM_PHASE_LABELS } from '@/features/video-output/hooks/use-summary-stream';

interface OutputRouterProps {
  title: string;
  videoSummaryId: string;
  tabs: TabEntry[] | null;
  meta: VIEResponseMeta | null;
  synthesis: SynthesisResult | null;
  isStreaming?: boolean;
  tabCount?: number;
  tabLabels?: { id: string; label: string; emoji: string }[];
  youtubeId?: string;
  creator?: string;
  duration?: number | null;
  language?: string;
  isRTL?: boolean;
  streamPhase?: StreamPhase;
}

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
  const primaryTag = useMemo((): ContentTag => {
    const raw = typeof meta?.primaryTag === 'string' ? meta.primaryTag : '';
    if (isContentTag(raw)) return raw;
    if (raw && import.meta.env.DEV) {
      console.warn(`[OutputRouter] Invalid primaryTag "${raw}", defaulting to learning`);
    }
    return 'learning';
  }, [meta]);

  // All tabs visible in the deck. Overview is no longer hidden — it's the
  // default first tab and behaves like any other section.
  // Tab-preview tooltips come from the i18n bundle so non-English sessions
  // don't regress to hardcoded strings. getLabels() is pure, safe to call
  // here above DirectionProvider (it takes the language prop directly).
  const tabPreviews = useMemo(() => getLabels(language ?? 'en').tabPreviews, [language]);
  const tabDefs = useMemo(() => {
    if (!tabs || tabs.length === 0) return [];
    return tabs.map(t => ({
      id: t.id,
      label: t.emoji ? stripLeadingEmoji(t.label) : t.label,
      emoji: t.emoji,
      dataSource: '',
      preview: tabPreviews[t.id],
    }));
  }, [tabs, tabPreviews]);

  const hasData = tabs != null && tabs.length > 0;
  const domainGradient = useMemo(() => getDomainGradient(primaryTag), [primaryTag]);
  const initialTab = tabDefs[0]?.id ?? '';

  if (!hasData && !isStreaming) return null;

  return (
    <DirectionProvider language={language} isRTL={isRTLProp}>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-3 pt-3 pb-8 md:px-6 md:pt-5 md:pb-12">
        {hasData && tabDefs.length > 0 ? (
          <TabCoordinationProvider videoId={videoSummaryId} initialTab={initialTab}>
            <TabStateProvider videoId={videoSummaryId}>
              <CommandDeck
                title={title}
                creator={creator}
                duration={duration}
                tldr={synthesis?.tldr}
                keyTakeaways={synthesis?.keyTakeaways}
                masterSummary={synthesis?.masterSummary}
                youtubeId={youtubeId}
                tabDefs={tabDefs}
                domainGradient={domainGradient}
              />
              <TabPanel
                tabDefs={tabDefs}
                tabs={tabs}
                primaryTag={primaryTag}
                isStreaming={isStreaming}
                tabCount={tabCount}
                streamPhase={streamPhase}
              />
            </TabStateProvider>
          </TabCoordinationProvider>
        ) : (
          <>
            <VideoHero
              title={title}
              creator={creator}
              duration={duration}
              tldr={synthesis?.tldr}
              keyTakeaways={synthesis?.keyTakeaways}
              masterSummary={synthesis?.masterSummary}
              youtubeId={youtubeId}
            />
            {isStreaming ? (
              <StreamingPlaceholder tabLabels={tabLabels} streamPhase={streamPhase} />
            ) : (
              <GlassCard>
                <p className="text-sm text-muted-foreground text-center py-6">
                  Content extraction was incomplete for this video.
                </p>
              </GlassCard>
            )}
          </>
        )}

        <p className="text-center text-xs text-muted-foreground/60">
          AI-generated summary. Verify important details with the original video.
        </p>
      </div>
    </DirectionProvider>
  );
}

interface CommandDeckProps {
  title: string;
  creator?: string;
  duration?: number | null;
  tldr?: string;
  keyTakeaways?: string[];
  masterSummary?: string;
  youtubeId?: string;
  tabDefs: Array<{ id: string; label: string; emoji: string; preview?: string; dataSource: string }>;
  domainGradient: string;
}

/** Reads active-tab state from coordination context and renders the hero with
 *  the embedded tab bar. A thin wrapper so the hero doesn't need the context
 *  imported into it (keeps VideoHero reusable). */
function CommandDeck({
  title,
  creator,
  duration,
  tldr,
  keyTakeaways,
  masterSummary,
  youtubeId,
  tabDefs,
  domainGradient,
}: CommandDeckProps) {
  // CommandDeck is only rendered inside <TabCoordinationProvider> (see parent
  // render). Context must be present — fail loud if a future refactor breaks
  // that invariant instead of silently showing a non-interactive tab bar.
  const coordination = useTabCoordination();
  if (!coordination) {
    throw new Error('CommandDeck must be rendered inside TabCoordinationProvider');
  }
  const { activeTab: activeTabId, setActiveTab, completedTabs } = coordination;

  return (
    <VideoHero
      title={title}
      creator={creator}
      duration={duration}
      tldr={tldr}
      keyTakeaways={keyTakeaways}
      masterSummary={masterSummary}
      youtubeId={youtubeId}
      tabs={tabDefs}
      activeTabId={activeTabId}
      onTabSelect={setActiveTab}
      completedTabs={completedTabs}
      domainGradient={domainGradient}
    />
  );
}

interface TabPanelProps {
  tabDefs: Array<{ id: string; label: string; emoji: string; preview?: string; dataSource: string }>;
  tabs: TabEntry[] | null;
  primaryTag: ContentTag;
  isStreaming?: boolean;
  tabCount: number;
  streamPhase?: StreamPhase;
}

function TabPanel({ tabDefs, tabs, primaryTag, isStreaming, tabCount, streamPhase }: TabPanelProps) {
  const tabLayoutRef = useRef<TabLayoutHandle>(null);
  return (
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
  );
}

interface StreamingPlaceholderProps {
  tabLabels: { id: string; label: string; emoji: string }[];
  streamPhase?: StreamPhase;
}

const PHASE_EMOJI: Partial<Record<StreamPhase, string>> = {
  connecting: '⚡',
  metadata: '📡',
  triage: '🧠',
  extraction: '🔍',
  enrichment: '✨',
  synthesis: '📝',
};

const PHASE_HUE: Partial<Record<StreamPhase, number>> = {
  connecting: 290,
  metadata: 290,
  triage: 260,
  extraction: 60,
  enrichment: 180,
  synthesis: 330,
};

function StreamingPlaceholder({ tabLabels, streamPhase }: StreamingPlaceholderProps) {
  const phaseEmoji = streamPhase ? PHASE_EMOJI[streamPhase] : '⚡';
  const hue = streamPhase ? (PHASE_HUE[streamPhase] ?? 290) : 290;

  return (
    <div className="relative flex flex-col gap-6">
      <div
        className="vie-stream-backdrop pointer-events-none absolute -inset-x-4 -top-8 -bottom-4 rounded-3xl"
        aria-hidden="true"
        style={{ '--vie-stream-hue': hue } as React.CSSProperties}
      />

      {tabLabels.length > 0 ? (
        <div className="relative flex gap-2 overflow-x-auto px-1 py-2">
          {tabLabels.map((t, i) => (
            <div
              key={t.id}
              data-stream-tab-pill
              style={{ '--stagger-i': i } as React.CSSProperties}
              className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-border/40 bg-muted/20 px-3.5 py-1.5 text-sm text-muted-foreground/80"
            >
              <EmojiMarker emoji={t.emoji} size="sm" animated={false} />
              <span>{t.label}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="relative h-10 rounded-xl bg-muted/30 animate-pulse" />
      )}

      <div
        className="relative flex flex-col items-center justify-center gap-5 rounded-2xl border border-border/60 bg-card/60 backdrop-blur-sm py-16"
        role="status"
        aria-live="polite"
      >
        {phaseEmoji && (
          <EmojiMarker
            emoji={phaseEmoji}
            size="lg"
            animated={false}
            className="animate-[emoji-breathe_3s_ease-in-out_infinite] motion-reduce:animate-none select-none"
          />
        )}
        <p className="text-base md:text-lg font-medium text-foreground">
          {streamPhase ? STREAM_PHASE_LABELS[streamPhase] : 'Getting ready…'}
        </p>
        <StreamProgressSteps phase={streamPhase} />
      </div>
    </div>
  );
}

const PIPELINE_STEPS: readonly StreamPhase[] = [
  'connecting',
  'metadata',
  'triage',
  'extraction',
  'enrichment',
  'synthesis',
] as const;

const STEP_LABEL: Partial<Record<StreamPhase, string>> = {
  connecting: 'Connect',
  metadata: 'Read',
  triage: 'Understand',
  extraction: 'Highlight',
  enrichment: 'Build',
  synthesis: 'Summarize',
};

interface StreamProgressStepsProps {
  phase?: StreamPhase;
}

function StreamProgressSteps({ phase }: StreamProgressStepsProps) {
  const activeIndex = phase ? PIPELINE_STEPS.indexOf(phase) : -1;
  const currentStep = activeIndex >= 0 ? activeIndex + 1 : 0;
  const totalSteps = PIPELINE_STEPS.length;

  return (
    <div className="relative flex flex-col items-center gap-2">
      <div
        className="flex items-center gap-1.5"
        role="progressbar"
        aria-valuenow={currentStep}
        aria-valuemin={0}
        aria-valuemax={totalSteps}
      >
        {PIPELINE_STEPS.map((step, idx) => {
          const isComplete = activeIndex >= 0 && idx < activeIndex;
          const isActive = idx === activeIndex;
          return (
            <span
              key={step}
              aria-hidden="true"
              className={cn(
                'h-1.5 rounded-full transition-all duration-500',
                isActive
                  ? 'w-6 bg-primary'
                  : isComplete
                    ? 'w-2.5 bg-primary/70'
                    : 'w-2.5 bg-muted',
              )}
            />
          );
        })}
      </div>
      {currentStep > 0 && (
        <p className="text-xs text-muted-foreground/70 tabular-nums">
          Step {currentStep} of {totalSteps}
          {phase && STEP_LABEL[phase] ? ` · ${STEP_LABEL[phase]}` : ''}
        </p>
      )}
    </div>
  );
}
