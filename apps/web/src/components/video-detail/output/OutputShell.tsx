import type { VideoResponse, VideoOutput } from '@vie/types';
import type { StreamState } from '../../../hooks/use-summary-stream';
import { getOutputTypeConfig } from '../../../lib/output-type-config';
import { OutputHero } from './OutputHero';
import { TabLayout } from './TabLayout';
import { GlassCard } from './GlassCard';
import { OutputContent } from './OutputContent';
import { OutputSkeleton } from './skeletons/OutputSkeleton';
import { ConfettiCelebration } from './ConfettiCelebration';

interface OutputShellProps {
  video: VideoResponse;
  output: VideoOutput;
  isStreaming?: boolean;
  streamingState?: StreamState;
}

export function OutputShell({ video, output, isStreaming, streamingState }: OutputShellProps) {
  const { intent, synthesis, outputType } = output;
  const hasData = !!output.output;
  const showConfetti = streamingState?.phase === 'done' && !streamingState?.isCached;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-4 md:p-6">
      {showConfetti && <ConfettiCelebration />}

      {/* VIE Header Bar */}
      <div className="flex h-12 items-center gap-3 rounded-xl bg-primary px-4 text-primary-foreground">
        <span className="text-lg">{getOutputTypeConfig(outputType).emoji}</span>
        <h2 className="flex-1 truncate text-sm font-semibold">{video.title}</h2>
      </div>

      {/* Hero */}
      <OutputHero
        outputType={outputType}
        title={video.title ?? 'Video Summary'}
        emoji={getOutputTypeConfig(outputType).emoji}
        meta={[
          ...(video.channel ? [{ label: 'Channel', value: video.channel }] : []),
          ...(video.duration ? [{ label: 'Duration', value: `${Math.round(video.duration / 60)}min` }] : []),
        ]}
      />

      {/* Source strip */}
      {synthesis && (
        <GlassCard variant="outlined" className="px-4 py-3">
          <p className="text-sm text-muted-foreground leading-relaxed">{synthesis.tldr}</p>
        </GlassCard>
      )}

      {/* Tab content */}
      {hasData ? (
        <TabLayout sections={intent.sections} outputType={outputType}>
          {(activeTabId) => (
            <OutputContent
              outputType={outputType}
              outputData={output.output}
              enrichment={output.enrichment}
              activeTabId={activeTabId}
            />
          )}
        </TabLayout>
      ) : isStreaming ? (
        <OutputSkeleton outputType={outputType} sections={intent.sections} streamingState={streamingState} />
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
