/**
 * Modes Showcase — Dev Only
 *
 * Live design-system showcase of the "enter modes" — the immersive FlowPlayer
 * runners a viewer enters from a finished video (cooking, workout, build, study,
 * explore, practice, listen). Cards are driven by `FLOW_MODE_REGISTRY` (the same
 * registry production uses) so the showcase can't drift from the real mode list;
 * each card pairs a registry mode with mock context + step data and renders it
 * through the generic `FlowPlayer` shell, exactly as the live output does.
 *
 * Each card wraps its FlowPlayer in its own `TabStateProvider` so step-completion
 * progress works and stays isolated per mode.
 *
 * Route: `localhost:5173/dev/design-system` → "Modes" tab.
 */

// Production guard
if (!import.meta.env.DEV) {
  throw new Error('ModesShowcase should not be imported in production');
}

import { FlowPlayer } from '@/features/video-output/components/output/FlowPlayer';
import { RecipeStepView } from '@/features/video-output/components/output/RecipeStepView';
import { FlowContextPanel } from '@/features/video-output/components/output/FlowContextPanel';
import { FLOW_MODE_REGISTRY, type FlowContextItem } from '@/features/video-output/components/output/flow-modes';
import { TabStateProvider } from '@/features/video-output/contexts/TabStateContext';
import type { StepItem } from '@vie/types';

import { SectionCard, DemoBoundary } from './showcase-primitives';

// ── Per-mode mock data ──
// Keyed by the registry `id`. Each mode contributes a small context list (the
// orientation panel) and an ordered step sequence (the action pane). The shapes
// mirror what each mode's `resolve()` produces in production, but hand-authored
// so the showcase has no dependency on a real assembled video.

interface ModeMock {
  context: FlowContextItem[];
  steps: StepItem[];
}

const MODE_MOCKS: Record<string, ModeMock> = {
  cooking: {
    context: [
      { label: 'Pasta', note: 'penne or fusilli' },
      { label: 'Olive oil' },
      { label: 'Garlic', note: '3 cloves, minced' },
      { label: 'Tomato sauce', note: '1 can' },
    ],
    steps: [
      { number: 1, title: 'Boil water', instruction: 'Bring a salted pot of water to a rolling boil.', duration: '5 min' },
      { number: 2, title: 'Cook pasta', instruction: 'Add the pasta and cook until al dente.', duration: '10 min' },
      { number: 3, title: 'Make sauce', instruction: 'Warm olive oil, add garlic, then the tomato sauce.', duration: '5 min' },
      { number: 4, title: 'Combine', instruction: 'Drain the pasta and toss it through the sauce.' },
    ],
  },
  workout: {
    context: [
      { label: 'Jumping jacks', emoji: '🤸', note: '60 sec', group: 'Warmup' },
      { label: 'Arm circles', emoji: '🔄', note: '30 sec', group: 'Warmup' },
      { label: 'Hamstring stretch', emoji: '🧘', note: '45 sec', group: 'Cooldown' },
    ],
    steps: [
      { number: 1, title: 'Push-ups', instruction: '3 sets of 12 — keep your core tight and elbows tucked.', duration: '3 min' },
      { number: 2, title: 'Air squats', instruction: '3 sets of 15 — drive through the heels, chest up.', duration: '3 min' },
      { number: 3, title: 'Plank', instruction: 'Hold for 45 seconds, neutral spine, glutes engaged.', duration: '1 min' },
      { number: 4, title: 'Walking lunges', instruction: '3 sets of 10 per leg — knee tracks over the toe.', duration: '3 min' },
    ],
  },
  build: {
    context: [
      { label: 'Node 20+', group: 'Materials' },
      { label: 'pnpm', group: 'Materials' },
      { label: 'router.ts', note: 'route registry', group: 'Code' },
    ],
    steps: [
      { number: 1, title: 'Scaffold the project', instruction: 'Run the CLI generator and install dependencies.' },
      { number: 2, title: 'Wire the router', instruction: 'Register the routes and the layout shell.' },
      { number: 3, title: 'Ship the first screen', instruction: 'Build the landing route and verify the dev server.' },
    ],
  },
  study: {
    context: [
      { label: 'Photosynthesis', emoji: '🌱', note: 'Light → chemical energy in plants.' },
      { label: 'Mitochondria', emoji: '🔋', note: 'The cell’s energy factory.' },
      { label: 'Osmosis', emoji: '💧', note: 'Water moves across a membrane toward solute.' },
    ],
    steps: [
      { number: 1, title: 'Where does photosynthesis happen?', instruction: 'Answer: in the chloroplasts of plant cells.' },
      { number: 2, title: 'What does the mitochondria produce?', instruction: 'Answer: ATP — the cell’s energy currency.' },
      { number: 3, title: 'Osmosis moves water toward…', instruction: 'Answer: the side with the higher solute concentration.' },
    ],
  },
  explore: {
    context: [
      { label: 'Passport', emoji: '🛂', group: 'Packing' },
      { label: 'Sunscreen', emoji: '🧴', group: 'Packing' },
      { label: 'Flights', note: '$420', group: 'Budget' },
      { label: 'Hotel (3 nights)', note: '$540', group: 'Budget' },
    ],
    steps: [
      { number: 1, title: 'Day 1 — Old Town', instruction: 'Walk the historic quarter and the central market.' },
      { number: 2, title: 'Day 2 — Coastline', instruction: 'Take the morning ferry to the cliffside viewpoint.' },
      { number: 3, title: 'Day 3 — Museums', instruction: 'Spend the afternoon at the national gallery.' },
    ],
  },
  practice: {
    context: [
      { label: 'Bonjour', note: 'Hello' },
      { label: 'Merci', note: 'Thank you' },
      { label: 'S’il vous plaît', note: 'Please' },
    ],
    steps: [
      { number: 1, title: 'Greeting drill', instruction: 'Say "Bonjour, comment allez-vous?" out loud three times.' },
      { number: 2, title: 'Numbers drill', instruction: 'Count from un to dix without pausing.' },
      { number: 3, title: 'Ordering drill', instruction: 'Practice "Je voudrais un café, s’il vous plaît."' },
    ],
  },
  listen: {
    context: [
      { label: 'Dr. Maya Lin', emoji: '🎤', note: 'Climate scientist', group: 'Guests' },
      { label: 'Carbon markets', group: 'Topics' },
      { label: 'Grid storage', group: 'Topics' },
    ],
    steps: [
      { number: 1, title: 'Intro & guest bio', instruction: 'The host frames the episode and introduces the guest.', timestamp: 0 },
      { number: 2, title: 'The carbon-market debate', instruction: 'Why offsets are contested and what actually works.', timestamp: 420 },
      { number: 3, title: 'Closing thoughts', instruction: 'Where to focus over the next decade.', timestamp: 1980 },
    ],
  },
};

const WHATS_NEW: Record<string, string> = {
  cooking: 'mode=cooking · migrated, unchanged',
  workout: 'mode=workout · warmup/cooldown context + exercise sequence',
  build: 'mode=build · materials + code context (tech / project)',
  study: 'mode=study · concepts context + quiz-as-steps sequence',
  explore: 'mode=explore · packing/budget context + itinerary stops',
  practice: 'mode=practice · vocabulary context + drill sequence',
  listen: 'mode=listen · guests/topics context + segment sequence',
};

// ── Public component ──

export function ModesShowcase() {
  return (
    <div className="space-y-6" data-section="modes-root">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Enter Modes</h2>
        <p className="text-sm text-muted-foreground">
          Every immersive FlowPlayer runner, one card per registry mode. The same{' '}
          <code className="rounded bg-muted/40 px-1 py-0.5 text-xs">FlowPlayer</code> shell drives
          all of them — only the context panel and step sequence change per mode.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {FLOW_MODE_REGISTRY.map((mode, idx) => {
          const mock = MODE_MOCKS[mode.id];
          return (
            <SectionCard
              key={mode.id}
              index={idx + 1}
              name={mode.label}
              description={`${mode.emoji} Context = ${mode.contextLabel.toLowerCase()}; sequence = ${mode.stepNoun} run one at a time through the generic FlowPlayer shell.`}
              whatsNew={WHATS_NEW[mode.id] ?? `mode=${mode.id}`}
              testId={`showcase-mode-${mode.id}`}
            >
              <DemoBoundary label={mode.label}>
                {mock ? (
                  <TabStateProvider videoId={`showcase-mode-${mode.id}`}>
                    <FlowPlayer
                      emoji={mode.emoji}
                      modeLabel={mode.label}
                      stepNoun={mode.stepNoun}
                      contextLabel={mode.contextLabel}
                      contextCount={mock.context.length}
                      renderContext={() => (
                        <FlowContextPanel items={mock.context} label={mode.contextLabel} />
                      )}
                      sequenceLength={mock.steps.length}
                      renderStep={(args) => (
                        <RecipeStepView
                          steps={mock.steps}
                          currentStep={args.currentStep}
                          onStepChange={args.onStepChange}
                          onComplete={args.onComplete}
                        />
                      )}
                      completionMessage={mode.completionMessage}
                      onExit={() => undefined}
                    />
                  </TabStateProvider>
                ) : (
                  <p className="rounded-md border border-dashed border-border/40 bg-muted/10 p-3 text-sm text-muted-foreground">
                    No mock data yet for <code>{mode.id}</code> mode.
                  </p>
                )}
              </DemoBoundary>
            </SectionCard>
          );
        })}
      </div>
    </div>
  );
}
