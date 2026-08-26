import { useEffect, useState } from 'react';
import {
  StreamingPlaceholder,
  StreamErrorCard,
} from '@/features/video-output/components/StreamingPlaceholder';
import { VideoHero } from '@/components/vie';
import { VideoPlayerProvider } from '@/features/video-output/contexts/VideoPlayerContext';
import { Button } from '@/components/ui/button';
import type {
  StreamPhase,
  StreamPhaseDetail,
  ExtractionProgressInfo,
  FrameInfo,
} from '@/features/video-output/hooks/use-summary-stream';
import type { TriageResult } from '@vie/types';

interface PreviewState {
  name: string;
  phase: StreamPhase;
  phaseDetail?: StreamPhaseDetail;
  extractionProgress?: ExtractionProgressInfo;
  triage?: TriageResult;
  frames?: FrameInfo[];
  tabCount?: number;
  tabLabels?: { id: string; label: string; emoji: string }[];
  warnings?: string[];
}

const TRIAGE: TriageResult = {
  contentTags: ['tech'],
  modifiers: [],
  primaryTag: 'tech',
  userGoal: 'Learn the tool end to end',
  tabs: [],
  confidence: 0.93,
};

const TAB_LABELS = [
  { id: 'moments', label: 'Moments', emoji: '🎯' },
  { id: 'quiz', label: 'Quiz', emoji: '🧪' },
  { id: 'flashcards', label: 'Flashcards', emoji: '🃏' },
  { id: 'cheatsheet', label: 'Cheat sheet', emoji: '📋' },
];

const FRAMES: FrameInfo[] = Array.from({ length: 6 }, (_, i) => ({
  index: i,
  timestamp: i * 90,
  url: `https://picsum.photos/seed/vie-${i}/320/180`,
}));

const STATES: PreviewState[] = [
  { name: '1 · Connecting / metadata', phase: 'metadata' },
  { name: '2 · Whisper transcription', phase: 'transcript', phaseDetail: 'audio-transcription' },
  {
    name: '3 · Chunked extraction (triaged, frames in)',
    phase: 'extraction',
    triage: TRIAGE,
    extractionProgress: { section: 'chunked-sequential', percent: 55, batch: 3, of: 5 },
    frames: FRAMES,
  },
  {
    name: '4 · Building tabs (plan known, warning)',
    phase: 'building',
    triage: TRIAGE,
    frames: FRAMES,
    tabCount: 4,
    tabLabels: TAB_LABELS,
    warnings: ['Some frame analysis failed; continuing without 2 frames'],
  },
];

/** Dev-only visual harness for the streaming experience. Mirrors the real
 *  VideoDetailPage composition (hero + placeholder) without needing a live
 *  pipeline run. Not routed in production builds. */
export function StreamingPreviewPage() {
  const [autoStep, setAutoStep] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (!autoStep) return;
    const t = setInterval(() => setStepIndex((i) => (i + 1) % STATES.length), 4000);
    return () => clearInterval(t);
  }, [autoStep]);

  return (
    <VideoPlayerProvider>
      <div className="min-h-screen bg-background py-10">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 md:px-6">
          <header className="flex items-center justify-between gap-4">
            <div>
              <p className="type-eyebrow text-primary">Dev preview</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight">Streaming experience</h1>
            </div>
            <Button variant="outline" size="sm" onClick={() => setAutoStep((v) => !v)}>
              {autoStep ? `Stop auto-step (${stepIndex + 1}/${STATES.length})` : 'Auto-step states'}
            </Button>
          </header>

          {(autoStep ? [STATES[stepIndex]] : STATES).map((state) => (
            <section key={state.name} className="flex flex-col gap-4">
              <h2 className="type-eyebrow text-muted-foreground">{state.name}</h2>
              <VideoHero
                title="Advanced TypeScript Patterns Every Developer Should Know"
                creator="Matt Pocock"
                duration={4260}
                youtubeId="dQw4w9WgXcQ"
                primaryTag={state.triage?.primaryTag ?? 'learning'}
                isStreaming
                pendingTabs={state.tabLabels ?? []}
              />
              <StreamingPlaceholder
                streamPhase={state.phase}
                phaseDetail={state.phaseDetail}
                extractionProgress={state.extractionProgress ?? null}
                triage={state.triage ?? null}
                frames={state.frames ?? []}
                thumbnailUrl={state.phase === 'metadata' ? undefined : 'https://picsum.photos/seed/vie-poster/640/360'}
                tabCount={state.tabCount ?? 0}
                tabLabels={state.tabLabels ?? []}
                warnings={state.warnings ?? []}
                onCancel={() => {}}
              />
            </section>
          ))}

          {!autoStep && (
            <section className="flex flex-col gap-4">
              <h2 className="type-eyebrow text-muted-foreground">5 · Mid-stream error</h2>
              <StreamErrorCard
                message="The AI service is temporarily overloaded. This is usually transient."
                onRetry={() => {}}
              />
            </section>
          )}
        </div>
      </div>
    </VideoPlayerProvider>
  );
}
