/**
 * Interactive Block Showcase — Dev Only
 *
 * Two sections:
 * 1. Core Interactive Blocks — standalone block components (FlashCard, ScenarioCard, ScoreRing, SpotCard)
 * 2. Interactive Output Components — 17 full-page interactive components from the composable output system
 */

// Production guard
if (!import.meta.env.DEV) {
  throw new Error('InteractiveBlockShowcase should not be imported in production');
}

import { useState } from 'react';
import { cn } from '@/lib/utils';

// VIE primitives for core block demos
import { ScoreRing, VideoHero } from '@/components/vie';

// Interactive output components (16 after merging Timeline + ClipPlayer into MomentTrack)
import {
  ChecklistInteractive,
  QuizInteractive,
  FlashDeckInteractive,
  ScenarioInteractive,
  SpotExplorer,
  StepByStepInteractive,
  ExerciseInteractive,
  MomentTrack,
  CodeExplorer,
  ComparisonInteractive,
  VerdictInteractive,
  BudgetInteractive,
  OverviewInteractive,
  InfoGridInteractive,
  GalleryInteractive,
  LyricsPlayerInteractive,
} from '@/features/video-output/components/output/interactive';

import {
  // Core block data
  createMockFlashCards,
  createMockScenarios,
  scoreRingConfigs,
  // Interactive output data (original 10)
  createMockChecklist,
  createMockQuizQuestions,
  createMockSteps,
  createMockExercises,
  createMockTimeline,
  createMockCodeSnippets,
  createMockComparisons,
  createMockSpotExplorerWithSections,
  // Interactive output data (new 7)
  createMockVerdict,
  createMockBudget,
  createMockOverview,
  createMockInfoGrid,
  createMockGallery,
  createMockClips,
  createMockLyrics,
} from '@/lib/dev/mock-interactive-blocks';

// Pre-create mock data outside component
const flashCards = createMockFlashCards();
const scenarios = createMockScenarios();
const checklist = createMockChecklist();
const quizQuestions = createMockQuizQuestions();
const steps = createMockSteps();
const exerciseData = createMockExercises();
const timeline = createMockTimeline();
const codeSnippets = createMockCodeSnippets();
const comparisons = createMockComparisons();
const spotSections = createMockSpotExplorerWithSections();
const verdict = createMockVerdict();
const budget = createMockBudget();
const overview = createMockOverview();
const infoGrid = createMockInfoGrid();
const gallery = createMockGallery();
const clips = createMockClips();
const lyrics = createMockLyrics();

type Category = 'all' | 'core' | 'learning' | 'travel' | 'review' | 'food' | 'fitness' | 'tech' | 'media' | 'general';

const CATEGORIES: { id: Category; label: string; count: number }[] = [
  { id: 'all', label: 'All', count: 18 },
  { id: 'core', label: 'Core Primitives', count: 2 },
  { id: 'learning', label: 'Learning', count: 4 },
  { id: 'food', label: 'Food', count: 2 },
  { id: 'fitness', label: 'Fitness', count: 1 },
  { id: 'tech', label: 'Tech', count: 1 },
  { id: 'travel', label: 'Travel', count: 2 },
  { id: 'review', label: 'Review', count: 2 },
  { id: 'media', label: 'Media', count: 2 },
  { id: 'general', label: 'General', count: 3 },
];

function ShowcaseCard({ label, type, children }: { label: string; type: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/40 bg-card/80 overflow-hidden shadow-sm">
      <div className="flex items-center gap-2 border-b border-border/30 px-4 py-3 bg-muted/20">
        <span className="font-medium text-sm">{label}</span>
        <code className="text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{type}</code>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function useNavHandler() {
  const [lastNav, setLastNav] = useState<string | null>(null);
  const onNavigateTab = (id: string) => setLastNav(id);
  return { lastNav, onNavigateTab };
}

function OutputCard({ label, type, domain, children, lastNav }: { label: string; type: string; domain: string; children: React.ReactNode; lastNav: string | null }) {
  return (
    <div className="rounded-xl border border-border/40 bg-card/80 overflow-hidden shadow-sm">
      <div className="flex items-center gap-2 border-b border-border/30 px-4 py-3 bg-muted/20">
        <span className="font-medium text-sm">{label}</span>
        <code className="text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{type}</code>
        <span className="text-[10px] text-primary/70 bg-primary/5 px-1.5 py-0.5 rounded font-medium ml-auto">
          {domain}
        </span>
      </div>
      <div className="p-4">
        {children}
        {lastNav && (
          <p className="text-xs text-muted-foreground text-center mt-3">
            Navigated to: <code className="bg-muted px-1 rounded">{lastNav}</code>
          </p>
        )}
      </div>
    </div>
  );
}

// ── Demo wrappers for each interactive ──

function ChecklistDemo() {
  const { lastNav, onNavigateTab } = useNavHandler();
  return (
    <OutputCard label="Checklist" type="ChecklistInteractive" domain="food/project" lastNav={lastNav}>
      <ChecklistInteractive items={checklist.items} tabLabel={checklist.tabLabel} nextTab="steps" onNavigateTab={onNavigateTab} />
    </OutputCard>
  );
}

function QuizDemo() {
  const { lastNav, onNavigateTab } = useNavHandler();
  return (
    <OutputCard label="Quiz" type="QuizInteractive" domain="learning" lastNav={lastNav}>
      <QuizInteractive questions={quizQuestions} nextTab="flashcards" onNavigateTab={onNavigateTab} />
    </OutputCard>
  );
}

function FlashDeckDemo() {
  const { lastNav, onNavigateTab } = useNavHandler();
  return (
    <OutputCard label="Flash Deck" type="FlashDeckInteractive" domain="learning" lastNav={lastNav}>
      <FlashDeckInteractive cards={flashCards} nextTab="scenarios" onNavigateTab={onNavigateTab} />
    </OutputCard>
  );
}

function ScenarioDemo() {
  const { lastNav, onNavigateTab } = useNavHandler();
  return (
    <OutputCard label="Scenarios" type="ScenarioInteractive" domain="learning" lastNav={lastNav}>
      <ScenarioInteractive scenarios={scenarios} nextTab="quizzes" onNavigateTab={onNavigateTab} />
    </OutputCard>
  );
}

function SpotExplorerDemo() {
  const { lastNav, onNavigateTab } = useNavHandler();
  return (
    <OutputCard label="Spot Explorer" type="SpotExplorer" domain="travel" lastNav={lastNav}>
      <SpotExplorer spots={spotSections.spots} sections={spotSections.sections} nextTab="budget" onNavigateTab={onNavigateTab} />
    </OutputCard>
  );
}

function StepByStepDemo() {
  const { lastNav, onNavigateTab } = useNavHandler();
  return (
    <OutputCard label="Step-by-Step" type="StepByStepInteractive" domain="food/project" lastNav={lastNav}>
      <StepByStepInteractive steps={steps} nextTab="tips" onNavigateTab={onNavigateTab} />
    </OutputCard>
  );
}

function ExerciseDemo() {
  const { lastNav, onNavigateTab } = useNavHandler();
  return (
    <OutputCard label="Exercise Tracker" type="ExerciseInteractive" domain="fitness" lastNav={lastNav}>
      <ExerciseInteractive exercises={exerciseData.exercises} warmup={exerciseData.warmup} cooldown={exerciseData.cooldown} nextTab="tips" onNavigateTab={onNavigateTab} />
    </OutputCard>
  );
}

function MomentTrackDemo() {
  const { lastNav, onNavigateTab } = useNavHandler();
  // Mix the timeline points with the clip dataset to showcase points + spans
  // together. The first clip carries frame metadata (caption + OCR + scene
  // type + educational rationale) — expand it to see how vision intelligence
  // surfaces as evidence rather than a passive thumbnail.
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
      // Synthetic frame-evidence on the first clip so the showcase renders
      // the "On screen" callout the real pipeline produces for frame-aware
      // moments. Mirrors the data the assembler attaches at runtime.
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
  return (
    <OutputCard label="Moment Track" type="MomentTrack" domain="general" lastNav={lastNav}>
      <MomentTrack items={items} nextTab="takeaways" onNavigateTab={onNavigateTab} />
    </OutputCard>
  );
}

function CodeExplorerDemo() {
  const { lastNav, onNavigateTab } = useNavHandler();
  return (
    <OutputCard label="Code Explorer" type="CodeExplorer" domain="tech" lastNav={lastNav}>
      <CodeExplorer snippets={codeSnippets} nextTab="concepts" onNavigateTab={onNavigateTab} />
    </OutputCard>
  );
}

function ComparisonDemo() {
  const { lastNav, onNavigateTab } = useNavHandler();
  return (
    <OutputCard label="Comparison / Pros & Cons" type="ComparisonInteractive" domain="review" lastNav={lastNav}>
      <ComparisonInteractive comparisons={comparisons.comparisons} pros={comparisons.pros} cons={comparisons.cons} nextTab="verdict" onNavigateTab={onNavigateTab} />
    </OutputCard>
  );
}

function VerdictDemo() {
  const { lastNav, onNavigateTab } = useNavHandler();
  return (
    <OutputCard label="Verdict" type="VerdictInteractive" domain="review" lastNav={lastNav}>
      <VerdictInteractive product={verdict.product} bottomLine={verdict.bottomLine} score={verdict.score} maxScore={verdict.maxScore} badge={verdict.badge} bestFor={verdict.bestFor} notFor={verdict.notFor} price={verdict.price} nextTab="specs" onNavigateTab={onNavigateTab} />
    </OutputCard>
  );
}

function BudgetDemo() {
  const { lastNav, onNavigateTab } = useNavHandler();
  return (
    <OutputCard label="Budget" type="BudgetInteractive" domain="travel" lastNav={lastNav}>
      <BudgetInteractive total={budget.total} breakdown={budget.breakdown} currency={budget.currency} savingTips={budget.savingTips} nextTab="packing" onNavigateTab={onNavigateTab} />
    </OutputCard>
  );
}

function OverviewDemo() {
  const { lastNav, onNavigateTab } = useNavHandler();
  return (
    <OutputCard label="Overview" type="OverviewInteractive" domain="general" lastNav={lastNav}>
      <OverviewInteractive
        duration={overview.duration}
        level={overview.level}
        itemCount={overview.itemCount}
        keyTakeaways={overview.keyTakeaways}
        highlights={overview.highlights}
        tips={overview.tips}
        crossTabLinks={overview.crossTabLinks}
        videoId={overview.videoId}
        onNavigateTab={onNavigateTab}
      />
    </OutputCard>
  );
}

function InfoGridDemo() {
  const { lastNav, onNavigateTab } = useNavHandler();
  return (
    <OutputCard label="Info Grid" type="InfoGridInteractive" domain="general" lastNav={lastNav}>
      <InfoGridInteractive items={infoGrid.items} nextTab="overview" onNavigateTab={onNavigateTab} />
    </OutputCard>
  );
}

function GalleryDemo() {
  const { lastNav, onNavigateTab } = useNavHandler();
  return (
    <OutputCard label="Gallery" type="GalleryInteractive" domain="media" lastNav={lastNav}>
      <GalleryInteractive images={gallery.images} layout="grid" nextTab="overview" onNavigateTab={onNavigateTab} />
    </OutputCard>
  );
}

function LyricsPlayerDemo() {
  const { lastNav, onNavigateTab } = useNavHandler();
  return (
    <OutputCard label="Lyrics Player" type="LyricsPlayerInteractive" domain="music" lastNav={lastNav}>
      <LyricsPlayerInteractive sections={lyrics.sections} artist={lyrics.artist} nextTab="analysis" onNavigateTab={onNavigateTab} />
    </OutputCard>
  );
}

// Map demo components to categories for filtering
const OUTPUT_DEMOS: { category: Exclude<Category, 'all' | 'core'>; Component: React.ComponentType }[] = [
  { category: 'general', Component: OverviewDemo },
  { category: 'general', Component: MomentTrackDemo },
  { category: 'general', Component: InfoGridDemo },
  { category: 'learning', Component: QuizDemo },
  { category: 'learning', Component: FlashDeckDemo },
  { category: 'learning', Component: ScenarioDemo },
  { category: 'tech', Component: CodeExplorerDemo },
  { category: 'food', Component: ChecklistDemo },
  { category: 'food', Component: StepByStepDemo },
  { category: 'fitness', Component: ExerciseDemo },
  { category: 'travel', Component: SpotExplorerDemo },
  { category: 'travel', Component: BudgetDemo },
  { category: 'review', Component: ComparisonDemo },
  { category: 'review', Component: VerdictDemo },
  { category: 'media', Component: GalleryDemo },
  { category: 'learning', Component: LyricsPlayerDemo },
];

export function InteractiveBlockShowcase() {
  const [category, setCategory] = useState<Category>('all');

  const filteredDemos = category === 'all' || category === 'core'
    ? OUTPUT_DEMOS
    : OUTPUT_DEMOS.filter((d) => d.category === category);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Interactive Components</h2>
        <p className="text-sm text-muted-foreground">
          VIE primitives + 17 interactive output components. All fully functional with live interaction.
        </p>
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-1.5">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setCategory(cat.id)}
            className={cn(
              'rounded-md px-2.5 py-1 text-xs transition-colors',
              category === cat.id
                ? 'bg-foreground text-background font-medium'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            )}
          >
            {cat.label} ({cat.count})
          </button>
        ))}
      </div>

      {/* Core VIE Primitives */}
      {(category === 'all' || category === 'core') && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold tracking-tight">Core VIE Primitives</h3>
          <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
            <ShowcaseCard label="Score Ring" type="ScoreRing">
              <div className="flex items-end justify-around py-4">
                {scoreRingConfigs.map((config) => (
                  <ScoreRing
                    key={config.label}
                    score={config.score}
                    total={config.maxScore}
                    label={config.label}
                    size={config.size}
                  />
                ))}
              </div>
            </ShowcaseCard>
            <ShowcaseCard label="Video Hero" type="VideoHero">
              <VideoHero
                title="How to Build a REST API with Node.js"
                creator="Dev Academy"
                duration={1823}
                tldr="Step-by-step guide to building a production-ready REST API using Node.js, Express, and MongoDB with auth and validation."
                keyTakeaways={[
                  'Structure routes by resource, not by HTTP method',
                  'Always validate request bodies with Zod or Joi',
                  'Use middleware for auth, not route-level checks',
                ]}
                masterSummary="This tutorial covers the full lifecycle of building a REST API. Starting with project scaffolding, the presenter sets up Express with TypeScript, adds MongoDB via Mongoose, implements JWT authentication middleware, and adds request validation with Zod. The video concludes with deployment to Railway and monitoring setup."
                youtubeId="fgTGADljAMg"
              />
            </ShowcaseCard>
          </div>
        </div>
      )}

      {/* Interactive Output Components */}
      {category !== 'core' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold tracking-tight">
            Interactive Output Components
            {category !== 'all' && <span className="text-sm font-normal text-muted-foreground ml-2">({category})</span>}
          </h3>
          <p className="text-sm text-muted-foreground">
            Full-page interactive components used by ComposableOutput. Each manages its own state,
            progress tracking, and tab navigation.
          </p>
          <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
            {filteredDemos.map(({ Component }, i) => (
              <Component key={i} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
