/**
 * Interactive Block Showcase — Dev Only
 *
 * Live design-system showcase of the post-overhaul 16-component interactive
 * layer. Each component is rendered in its own GlassCard section with a
 * one-line description, a "What's new" badge listing the interactive
 * features, and an ErrorBoundary so a single broken demo can't crash the
 * page.
 *
 * Heavy canvas/graph components (ConceptCanvas, StepFlowCanvas, ConnectCanvas)
 * are React.lazy + Suspense-loaded to keep the initial showcase render fast.
 *
 * Route: `localhost:5173/dev/design-system` → "Interactive" tab.
 */

// Production guard
if (!import.meta.env.DEV) {
  throw new Error('InteractiveBlockShowcase should not be imported in production');
}

import { lazy, memo, Suspense, useMemo, type ReactNode } from 'react';
import { ErrorBoundary, type FallbackProps } from '@/components/ui/error-boundary';

import { GlassCard, VisualEvidence } from '@/components/vie';

import { FlowPlayer } from '@/features/video-output/components/output/FlowPlayer';
import { RecipeStepView } from '@/features/video-output/components/output/RecipeStepView';
import { FlowContextPanel } from '@/features/video-output/components/output/FlowContextPanel';
import type { StepItem } from '@vie/types';

import {
  // Retained interactives
  ChecklistInteractive,
  FlashDeckInteractive,
  SpotExplorer,
  MomentTrack,
  ComparisonInteractive,
  InfoGridInteractive,
  // Lightweight new interactives — eager-loaded
  VideoFilmstrip,
  CodePlayground,
  QuizArena,
  PackingMission,
  WorkoutRoom,
  LyricsKaraoke,
  // Interactive Overhaul v2 — Phase 5b: news signature component
  ClaimsTracker,
  // Interactive Overhaul v2 — Phase 5c: gaming signature component
  TierList,
  // Interactive Overhaul v2 — Phase 2: secondary-tier (attachment-only)
  StatBanner,
  TipCallout,
  SummaryHeader,
} from '@/features/video-output/components/output/interactive';

import {
  // Retained component mock data
  createMockFlashCards,
  createMockChecklist,
  createMockTimeline,
  createMockComparisons,
  createMockSpotExplorerWithSections,
  createMockVerdict,
  createMockInfoGrid,
  createMockClips,
  // New mock data (video-to-action overhaul)
  createMockVisualEvidence,
  createMockFilmstripFrames,
  createMockConcepts,
  createMockStepFlowSteps,
  createMockComparisonRadarRows,
  createMockConnectCanvasPairs,
  createMockCodePlaygroundSnippets,
  createMockQuizArenaQuestions,
  createMockPackingItems,
  createMockWorkoutExercises,
  createMockLyricsKaraokeSections,
} from '@/lib/dev/mock-interactive-blocks';

// ── Lazy-load heavy canvas/graph components ──
// React Flow + Recharts ship sizable runtimes; defer them until the
// showcase section is actually opened.

const LazyConceptCanvas = lazy(() =>
  import('@/features/video-output/components/output/interactive/ConceptCanvas').then((m) => ({
    default: m.ConceptCanvas,
  })),
);

const LazyStepFlowCanvas = lazy(() =>
  import('@/features/video-output/components/output/interactive/StepFlowCanvas').then((m) => ({
    default: m.StepFlowCanvas,
  })),
);

const LazyConnectCanvas = lazy(() =>
  import('@/features/video-output/components/output/interactive/ConnectCanvas').then((m) => ({
    default: m.ConnectCanvas,
  })),
);

const LazyDiagramCard = lazy(() =>
  import('@/features/video-output/components/output/interactive/DiagramCard').then((m) => ({
    default: m.DiagramCard,
  })),
);

const LazyFormationDiagram = lazy(() =>
  import('@/features/video-output/components/output/interactive/FormationDiagram').then((m) => ({
    default: m.FormationDiagram,
  })),
);

// ── Per-section mock data (pre-built at module load) ──

const flashCards = createMockFlashCards();
const checklist = createMockChecklist();
const timeline = createMockTimeline();
const comparisons = createMockComparisons();
const spotSections = createMockSpotExplorerWithSections();
const verdict = createMockVerdict();
const infoGrid = createMockInfoGrid();
const clips = createMockClips();

const visualEvidenceSample = createMockVisualEvidence();
const filmstripFrames = createMockFilmstripFrames();
const concepts = createMockConcepts();
const stepFlowSteps = createMockStepFlowSteps();
const radarRows = createMockComparisonRadarRows();
const connectPairs = createMockConnectCanvasPairs();
const codePlaygroundSnippets = createMockCodePlaygroundSnippets();
const quizArenaQuestions = createMockQuizArenaQuestions();
const packingItems = createMockPackingItems();
const workoutExercises = createMockWorkoutExercises();
const lyricsSections = createMockLyricsKaraokeSections();

// FlowPlayer mock modes — context items + an ordered step sequence. The shell
// is domain-agnostic; these mocks exercise the cooking + build presentations.
const flowCookingSteps: StepItem[] = [
  { number: 1, title: 'Boil water', instruction: 'Bring a salted pot of water to a rolling boil.', duration: '5 min' },
  { number: 2, title: 'Cook pasta', instruction: 'Add the pasta and cook until al dente.', duration: '10 min' },
  { number: 3, title: 'Make sauce', instruction: 'Warm olive oil, add garlic, then the tomato sauce.', duration: '5 min' },
  { number: 4, title: 'Combine', instruction: 'Drain the pasta and toss it through the sauce.' },
];
const flowCookingContext = [
  { label: 'Pasta', note: 'penne or fusilli' },
  { label: 'Olive oil' },
  { label: 'Garlic', note: '3 cloves, minced' },
  { label: 'Tomato sauce', note: '1 can' },
];
const flowBuildSteps: StepItem[] = [
  { number: 1, title: 'Scaffold the project', instruction: 'Run the CLI generator and install dependencies.' },
  { number: 2, title: 'Wire the router', instruction: 'Register the routes and the layout shell.' },
  { number: 3, title: 'Ship the first screen', instruction: 'Build the landing route and verify the dev server.' },
];
const flowBuildContext = [
  { label: 'Node 20+', group: 'Materials' },
  { label: 'pnpm', group: 'Materials' },
  { label: 'router.ts', note: 'route registry', group: 'Code' },
];

// ── Demo-section primitives ──

interface SectionCardProps {
  index: number;
  name: string;
  description: string;
  whatsNew: string;
  testId: string;
  children: ReactNode;
}

/**
 * Section container — each interactive demo lives inside one of these. The
 * `data-section="showcase"` + per-section `data-testid` attributes let
 * Playwright assert that every component in the new registry rendered.
 */
const SectionCard = memo(function SectionCard({
  index,
  name,
  description,
  whatsNew,
  testId,
  children,
}: SectionCardProps) {
  return (
    <div data-section="showcase" data-testid={testId}>
      <GlassCard variant="default" className="space-y-4">
        <header className="space-y-2 border-b border-border/40 pb-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
              {String(index).padStart(2, '0')}
            </span>
            <h3 className="text-base font-semibold tracking-tight">{name}</h3>
          </div>
          <p className="text-sm text-muted-foreground">{description}</p>
          <p
            className="inline-flex items-center gap-1.5 rounded-md bg-muted/40 px-2 py-1 text-[11px] font-medium text-foreground/80"
            data-testid={`${testId}-whats-new`}
          >
            <span className="font-semibold uppercase tracking-wider text-muted-foreground">
              What&apos;s new
            </span>
            <span aria-hidden>·</span>
            <span>{whatsNew}</span>
          </p>
        </header>
        <div>{children}</div>
      </GlassCard>
    </div>
  );
});

function SectionErrorFallback({ error }: FallbackProps) {
  const message = error instanceof Error ? error.message : 'Unknown error';
  return (
    <div
      role="alert"
      className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
    >
      <p className="font-semibold">Demo crashed</p>
      <p className="mt-1 text-xs opacity-80">{message}</p>
    </div>
  );
}

function DemoSuspenseFallback({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex h-32 items-center justify-center rounded-md border border-dashed border-border/40 bg-muted/10 text-sm text-muted-foreground"
    >
      Loading {label}…
    </div>
  );
}

interface DemoBoundaryProps {
  label: string;
  children: ReactNode;
}

function DemoBoundary({ label: _label, children }: DemoBoundaryProps) {
  return <ErrorBoundary FallbackComponent={SectionErrorFallback}>{children}</ErrorBoundary>;
}

// ── Migration banner ──

// ── Section data (declarative wiring) ──

interface ShowcaseEntry {
  testId: string;
  name: string;
  description: string;
  whatsNew: string;
  /** A function so we can produce fresh handlers per render without leaking listeners. */
  render: () => ReactNode;
}

function useShowcaseEntries(): ShowcaseEntry[] {
  return useMemo<ShowcaseEntry[]>(() => {
    return [
      {
        testId: 'moment-track',
        name: 'MomentTrack',
        description: 'Frame-aware timeline blending navigable moments and replayable spans.',
        whatsNew: 'VisualEvidence in expanded view',
        render: () => {
          const items = [
            ...timeline.map((t) => ({ ...t, endSeconds: undefined as number | undefined })),
            ...clips.clips.map((c: Record<string, unknown>, idx: number) => ({
              label: c.label as string,
              seconds: (c.startSeconds as number) ?? 0,
              endSeconds: c.endSeconds as number | undefined,
              time: c.time as string,
              mood: c.mood as string | undefined,
              description: c.description as string | undefined,
              tags: c.tags as string[] | undefined,
              thumbnailUrl: c.thumbnailUrl as string | undefined,
              ...(idx === 0
                ? {
                    frameCaption: 'Animated diagram of attention weights between tokens',
                    frameSceneType: 'diagram',
                    frameOcr: 'Q·Kᵀ / √d_k',
                    frameEvidence: 'Shows the exact softmax inputs being computed.',
                  }
                : {}),
            })),
          ].sort((a, b) => a.seconds - b.seconds);
          return <MomentTrack items={items} />;
        },
      },
      {
        testId: 'flash-deck',
        name: 'FlashDeckInteractive',
        description: 'Flip cards for concept-definition pairs the viewer commits to memory.',
        whatsNew: 'nothing — proven pattern, kept verbatim',
        render: () => <FlashDeckInteractive cards={flashCards} />,
      },
      {
        testId: 'comparison',
        name: 'ComparisonInteractive (unified: verdict + radar + table)',
        description: 'One comparison component: verdict header on top, radar hero when ≥3 scoreable axes, table below. Absorbs the retired ComparisonRadar.',
        whatsNew: 'P3C unified · radar hero (≥3 axes) + weight sliders · ReviewSummary header · table',
        render: () => (
          <ComparisonInteractive
            comparisons={radarRows}
            pros={comparisons.pros}
            cons={comparisons.cons}
            verdict={{
              badge: verdict.badge,
              bottomLine: verdict.bottomLine,
              bestFor: verdict.bestFor,
              notFor: verdict.notFor,
              score: verdict.score,
              maxScore: verdict.maxScore,
            }}
          />
        ),
      },
      {
        testId: 'spot-explorer',
        name: 'SpotExplorer',
        description: 'Browsable cards for places, products, or other discrete spots.',
        whatsNew: 'Frame thumbnails on cards',
        render: () => (
          <SpotExplorer spots={spotSections.spots} sections={spotSections.sections} />
        ),
      },
      {
        testId: 'checklist',
        name: 'ChecklistInteractive',
        description: 'Items the viewer physically checks off — shopping, materials, packing.',
        whatsNew: 'Unchanged — battle-tested check pattern',
        render: () => (
          <ChecklistInteractive items={checklist.items} tabLabel={checklist.tabLabel} />
        ),
      },
      {
        testId: 'info-grid',
        name: 'InfoGridInteractive',
        description: 'Short reference rows: specs, glossary, key facts.',
        whatsNew: 'Searchable + adaptive grid + evidence field',
        render: () => <InfoGridInteractive items={infoGrid.items} />,
      },
      {
        testId: 'visual-evidence',
        name: 'VisualEvidence (primitive)',
        description: 'The canonical frame-evidence slot — thumbnail + caption + OCR + scene type.',
        whatsNew: 'Slot pattern shared across MomentTrack, StepFlow, ConceptCanvas, CodePlayground',
        render: () => (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                variant=&quot;compact&quot;
              </p>
              <VisualEvidence
                variant="compact"
                thumbnailUrl={visualEvidenceSample.thumbnailUrl}
                caption={visualEvidenceSample.caption}
                ocr={visualEvidenceSample.ocr}
                sceneType={visualEvidenceSample.sceneType}
                evidence={visualEvidenceSample.evidence}
                timestamp={visualEvidenceSample.timestamp}
                onSeek={() => undefined}
              />
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                variant=&quot;figure&quot;
              </p>
              <VisualEvidence
                variant="figure"
                thumbnailUrl={visualEvidenceSample.thumbnailUrl}
                caption={visualEvidenceSample.caption}
                ocr={visualEvidenceSample.ocr}
                sceneType={visualEvidenceSample.sceneType}
                evidence={visualEvidenceSample.evidence}
                timestamp={visualEvidenceSample.timestamp}
                onSeek={() => undefined}
              />
            </div>
          </div>
        ),
      },
      {
        testId: 'video-filmstrip',
        name: 'VideoFilmstrip',
        description: 'Horizontal scrubber of vision-analyzed frames with caption tooltips.',
        whatsNew: 'New · scene-type badges · ±5s playhead highlight · tab + overlay modes',
        render: () => (
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              mode=&quot;tab&quot;
            </p>
            <VideoFilmstrip frames={filmstripFrames} mode="tab" currentTime={260} />
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pt-2">
              mode=&quot;overlay&quot;
            </p>
            <VideoFilmstrip frames={filmstripFrames} mode="overlay" currentTime={450} />
          </div>
        ),
      },
      {
        testId: 'concept-canvas',
        name: 'ConceptCanvas',
        description: 'Drag-arrangeable concept map (React Flow) with persisted per-video layout.',
        whatsNew: 'Drag to reorder · Saves layout · Frame thumbs on nodes',
        render: () => (
          <Suspense fallback={<DemoSuspenseFallback label="ConceptCanvas" />}>
            <LazyConceptCanvas concepts={concepts} videoId="showcase-demo" />
          </Suspense>
        ),
      },
      {
        testId: 'step-flow-canvas',
        name: 'StepFlowCanvas',
        description: 'Vertical zigzag step graph (React Flow) — completion lights up edges.',
        whatsNew: 'Zigzag node graph · Animated edges on completion',
        render: () => (
          <Suspense fallback={<DemoSuspenseFallback label="StepFlowCanvas" />}>
            <LazyStepFlowCanvas steps={stepFlowSteps} tabId="showcase-step-flow" />
          </Suspense>
        ),
      },
      {
        testId: 'connect-canvas',
        name: 'ConnectCanvas',
        description: 'Graded drag-to-connect quiz (React Flow) — match left prompts to right answers, scored, best score persisted.',
        whatsNew: 'New (P3B) · connectable handles · answer-key from concept connections · localStorage best score',
        render: () => (
          <Suspense fallback={<DemoSuspenseFallback label="ConnectCanvas" />}>
            <LazyConnectCanvas pairs={connectPairs} videoId="showcase-connect" tabId="showcase-connect" />
          </Suspense>
        ),
      },
      {
        testId: 'code-playground',
        name: 'CodePlayground',
        description: 'Syntax-highlighted snippet viewer with a sandboxed Run iframe + copy.',
        whatsNew: 'Syntax highlighting · Sandboxed Run iframe · Copy',
        render: () => <CodePlayground snippets={codePlaygroundSnippets} />,
      },
      {
        testId: 'quiz-arena',
        name: 'QuizArena',
        description: 'Replaces Quiz + Scenario — streak counter, timer, frame evidence per question.',
        whatsNew: 'Streak counter · 10s timer · Frame context · Best-score localStorage',
        render: () => (
          <QuizArena
            questions={quizArenaQuestions}
            videoId="showcase-quiz-arena"
            withTimer
            timerSeconds={10}
          />
        ),
      },
      {
        testId: 'packing-mission',
        name: 'PackingMission',
        description: 'Drag items into a virtual suitcase — weight tally + essential-item warnings.',
        whatsNew: 'Drag into suitcase · Weight tally · Essential warnings',
        render: () => (
          <PackingMission items={packingItems} videoId="showcase-packing-mission" />
        ),
      },
      {
        testId: 'workout-room',
        name: 'WorkoutRoom',
        description: 'Replaces ExerciseTracker — auto-advance through sets with audio cues + form frames.',
        whatsNew: 'Auto-advance · Audio cue · Form-loop frames',
        render: () => <WorkoutRoom exercises={workoutExercises} />,
      },
      {
        testId: 'lyrics-karaoke',
        name: 'LyricsKaraoke',
        description: 'Word-synced lyric scroller — replaces the static lyrics player.',
        whatsNew: 'Word-synced highlight · Section nav · Auto-scroll',
        render: () => (
          <LyricsKaraoke
            sections={lyricsSections}
            artist="Digital Wanderer"
            currentTime={5}
          />
        ),
      },
      // ── Secondary-tier (attachment-only) components — interactive-overhaul-v2 P2 ──
      {
        testId: 'stat-banner',
        name: 'StatBanner (secondary)',
        description: 'A row of equal-weight compact stats. Attachment-only — never a standalone tab.',
        whatsNew: 'New · equal-weight stats (NOT a hero metric) · no gradient',
        render: () => (
          <StatBanner
            stats={[
              { label: 'Duration', value: '12 min', emoji: '⏱️' },
              { label: 'Steps', value: '8', emoji: '🪜' },
              { label: 'Difficulty', value: 'Intermediate', emoji: '🎯' },
            ]}
          />
        ),
      },
      {
        testId: 'tip-callout',
        name: 'TipCallout (secondary)',
        description: 'A single highlighted aside. Full border + bg tint — never a side-stripe.',
        whatsNew: 'New · tip / warning / note styles · delegates to Callout primitive',
        render: () => (
          <div className="space-y-2">
            <TipCallout text="Whisk the eggs while the pan is still cold for a creamier scramble." />
            <TipCallout
              style="warning"
              title="Heads up"
              text="Unplug the tool before changing the blade."
            />
          </div>
        ),
      },
      {
        testId: 'summary-header',
        name: 'SummaryHeader (secondary)',
        description: 'One-line orientation banner placed on top of a dense tab.',
        whatsNew: 'New · opaque card · breaks up long lists',
        render: () => (
          <SummaryHeader
            emoji="🧭"
            title="In short"
            summary="Eight ordered steps take you from raw dough to a finished loaf."
          />
        ),
      },
      {
        testId: 'diagram-card',
        name: 'DiagramCard (secondary)',
        description: 'Read-only ReactFlow diagram — a pan-only "how the pieces connect" sketch.',
        whatsNew: 'P3A · read-only ReactFlow (nodesDraggable=false) · edges from connections / step order',
        render: () => (
          <Suspense fallback={<DemoSuspenseFallback label="DiagramCard" />}>
            <LazyDiagramCard
              caption="Request lifecycle"
              nodes={[
                { label: 'Client', detail: 'Sends request', emoji: '💻' },
                { label: 'Gateway', detail: 'Auth + route', emoji: '🚪' },
                { label: 'Service', detail: 'Business logic', emoji: '⚙️' },
                { label: 'DB', detail: 'Persist', emoji: '🗄️' },
              ]}
              edges={[
                { source: 0, target: 1 },
                { source: 1, target: 2 },
                { source: 2, target: 3 },
              ]}
            />
          </Suspense>
        ),
      },
      {
        testId: 'attachment-layout',
        name: 'Attachment layout (primary + secondaries)',
        description: 'How a tab composes: top summary_header → primary interactive → bottom frame_strip / quick_quiz.',
        whatsNew: 'New · tier model: one primary + optional top/bottom attachments',
        render: () => (
          <div className="flex flex-col gap-2">
            <SummaryHeader
              emoji="🧭"
              title="In short"
              summary="The reviewer scores three phones across battery, camera, and price."
            />
            <ComparisonInteractive
              comparisons={comparisons.comparisons}
              pros={comparisons.pros}
              cons={comparisons.cons}
            />
            <StatBanner
              stats={[
                { label: 'Winner', value: 'Phone B', emoji: '🏆' },
                { label: 'Axes', value: '3', emoji: '📊' },
              ]}
            />
          </div>
        ),
      },
      // ── News signature component — interactive-overhaul-v2 P5b ──
      {
        testId: 'claims-tracker',
        name: 'ClaimsTracker',
        description: 'The news signature surface: every factual claim with who said it and a verified / disputed / context status badge, plus optional source citation and a status filter.',
        whatsNew: 'New (P5b) · status badges · disputed-claim filter · seek-to-timestamp',
        render: () => (
          <ClaimsTracker
            claims={[
              {
                claim: 'The plan creates 1,200 jobs',
                source: 'Mayor Diaz',
                status: 'disputed',
                sourceCitation: 'Independent analysts put the figure near 700.',
                timestamp: 210,
              },
              {
                claim: 'Fares will rise 15% in 2026',
                source: 'Transit Authority',
                status: 'verified',
                sourceCitation: 'Approved fare schedule, council record.',
                timestamp: 540,
              },
              {
                claim: 'The city faces a structural deficit',
                source: 'Reporter',
                status: 'context',
                timestamp: 60,
              },
            ]}
            onSeek={() => undefined}
          />
        ),
      },
      // ── Gaming signature component — interactive-overhaul-v2 P5c ──
      {
        testId: 'tier-list',
        name: 'TierList',
        description: 'The gaming signature surface: drag items into S/A/B/C/D tiers. Seeded with the creator\'s suggested placement; the viewer overrides and the ranking persists per video.',
        whatsNew: 'New (P5c) · drag-to-rank · localStorage persistence · reset',
        render: () => (
          <TierList
            videoId="showcase-tier-list"
            tabId="showcase"
            items={[
              { item: 'Jett', tier: 'S', reason: 'Top entry duelist, high skill ceiling', emoji: '🌪️' },
              { item: 'Sage', tier: 'A', reason: 'Wall + heal carry low ranks', emoji: '🧊' },
              { item: 'Sova', tier: 'A', reason: 'Recon util wins rounds', emoji: '🏹' },
              { item: 'Killjoy', tier: 'B', reason: 'Strong on defense', emoji: '🤖' },
              { item: 'Yoru', tier: 'C', reason: 'Hard to use, niche value', emoji: '👤' },
              { item: 'Mystery pick', emoji: '❓' },
            ]}
          />
        ),
      },
      // ── Sport signature component — interactive-overhaul-v2 P5d ──
      {
        testId: 'formation-diagram',
        name: 'FormationDiagram',
        description: 'The sport signature surface: players placed on a pitch by 0-100 x/y coordinates. Read-only ReactFlow (nodesDraggable=false) — a tactical lineup overview.',
        whatsNew: 'New (P5d) · read-only ReactFlow pitch · positions by role',
        render: () => (
          <Suspense fallback={<DemoSuspenseFallback label="FormationDiagram" />}>
            <LazyFormationDiagram
              team="City"
              name="4-3-3"
              positions={[
                { player: 'Ederson', role: 'GK', x: 50, y: 8, number: 31 },
                { player: 'Walker', role: 'RB', x: 80, y: 30, number: 2 },
                { player: 'Dias', role: 'CB', x: 60, y: 25, number: 3 },
                { player: 'Stones', role: 'CB', x: 40, y: 25, number: 5 },
                { player: 'Gvardiol', role: 'LB', x: 20, y: 30, number: 24 },
                { player: 'Rodri', role: 'CDM', x: 50, y: 50, number: 16 },
                { player: 'De Bruyne', role: 'CM', x: 70, y: 60, number: 17 },
                { player: 'Silva', role: 'CM', x: 30, y: 60, number: 20 },
                { player: 'Foden', role: 'RW', x: 80, y: 80, number: 47 },
                { player: 'Haaland', role: 'ST', x: 50, y: 90, number: 9 },
                { player: 'Grealish', role: 'LW', x: 20, y: 80, number: 10 },
              ]}
            />
          </Suspense>
        ),
      },
      // ── Generalized enter mode (FlowPlayer) — interactive-overhaul-v2 P4 ──
      {
        testId: 'flow-player',
        name: 'FlowPlayer (enter mode)',
        description: 'Generalized cooking mode: left context panel + a sequenced action pane with progress, stepper dots, and a completion celebration. Reused across cooking, workout, build, study, explore, practice.',
        whatsNew: 'New (P4) · extracted from RecipePlayer · per-mode context + sequence + per-step render slot',
        render: () => (
          <div className="space-y-6">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                mode=&quot;cooking&quot; (migrated, unchanged)
              </p>
              <FlowPlayer
                emoji="🍳"
                modeLabel="Cooking Mode"
                stepNoun="steps"
                contextLabel="Ingredients"
                contextCount={flowCookingContext.length}
                renderContext={() => (
                  <FlowContextPanel items={flowCookingContext} label="Ingredients" />
                )}
                sequenceLength={flowCookingSteps.length}
                renderStep={(args) => (
                  <RecipeStepView
                    steps={flowCookingSteps}
                    currentStep={args.currentStep}
                    onStepChange={args.onStepChange}
                    onComplete={args.onComplete}
                  />
                )}
                completionMessage="All steps complete! Enjoy your meal!"
                onExit={() => undefined}
              />
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                mode=&quot;build&quot; (tech / project)
              </p>
              <FlowPlayer
                emoji="🔧"
                modeLabel="Build Mode"
                stepNoun="steps"
                contextLabel="Materials"
                contextCount={flowBuildContext.length}
                renderContext={() => (
                  <FlowContextPanel items={flowBuildContext} label="Materials" />
                )}
                sequenceLength={flowBuildSteps.length}
                renderStep={(args) => (
                  <RecipeStepView
                    steps={flowBuildSteps}
                    currentStep={args.currentStep}
                    onStepChange={args.onStepChange}
                    onComplete={args.onComplete}
                  />
                )}
                completionMessage="Build complete! Nicely done!"
                onExit={() => undefined}
              />
            </div>
          </div>
        ),
      },
    ];
  }, []);
}

// ── Public component ──

export function InteractiveBlockShowcase() {
  const entries = useShowcaseEntries();

  return (
    <div className="space-y-6" data-section="showcase-root">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Interactive Components</h2>
        <p className="text-sm text-muted-foreground">
          Live demos of every interactive component. Heavy canvas demos lazy-load.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {entries.map((entry, idx) => (
          <SectionCard
            key={entry.testId}
            index={idx + 1}
            name={entry.name}
            description={entry.description}
            whatsNew={entry.whatsNew}
            testId={`showcase-${entry.testId}`}
          >
            <DemoBoundary label={entry.name}>{entry.render()}</DemoBoundary>
          </SectionCard>
        ))}
      </div>
    </div>
  );
}
