/**
 * Interactive Block Showcase — Dev Only
 *
 * Showcases FlashCard, ScenarioCard, ScoreRing, and SpotCard components
 * with live interaction. These are non-ContentBlock components from the
 * design-system-v3 work.
 */

// Production guard
if (!import.meta.env.DEV) {
  throw new Error('InteractiveBlockShowcase should not be imported in production');
}

import { FlashCard } from '@/components/video-detail/blocks/FlashCard';
import { ScenarioCard } from '@/components/video-detail/blocks/ScenarioCard';
import { ScoreRing } from '@/components/video-detail/blocks/ScoreRing';
import { SpotCard } from '@/components/video-detail/blocks/SpotCard';
import {
  createMockFlashCards,
  createMockScenarios,
  createMockSpots,
  scoreRingConfigs,
} from '@/lib/dev/mock-interactive-blocks';

const flashCards = createMockFlashCards();
const scenarios = createMockScenarios();
const spots = createMockSpots();

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

export function InteractiveBlockShowcase() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold tracking-tight">Interactive Components</h3>
        <p className="text-sm text-muted-foreground">
          Standalone interactive components — not ContentBlock-based. Fully functional demos.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
        {/* FlashCard */}
        <ShowcaseCard label="Flash Cards" type="FlashCard">
          <FlashCard cards={flashCards} />
        </ShowcaseCard>

        {/* ScenarioCard */}
        <ShowcaseCard label="Scenario Challenge" type="ScenarioCard">
          <ScenarioCard scenarios={scenarios} />
        </ShowcaseCard>

        {/* ScoreRing */}
        <ShowcaseCard label="Score Ring" type="ScoreRing">
          <div className="flex items-end justify-around py-4">
            {scoreRingConfigs.map((config) => (
              <ScoreRing
                key={config.label}
                score={config.score}
                maxScore={config.maxScore}
                label={config.label}
                size={config.size}
              />
            ))}
          </div>
        </ShowcaseCard>

        {/* SpotCard */}
        <ShowcaseCard label="Spot Cards" type="SpotCard">
          <div className="space-y-2">
            {spots.map((spot) => (
              <SpotCard key={spot.name} spot={spot} />
            ))}
          </div>
        </ShowcaseCard>
      </div>
    </div>
  );
}
