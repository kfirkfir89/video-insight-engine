/**
 * Cards & Output Showcase — Dev Only
 *
 * Showcases the composable output system infrastructure:
 * - GlassCard (4 variants)
 * - DisplaySection (generic data renderer)
 * - ProgressBar
 * - Celebration
 * - CrossTabLink
 */

// Production guard
if (!import.meta.env.DEV) {
  throw new Error('CardsShowcase should not be imported in production');
}

import { useState } from 'react';
import { GlassCard, ProgressBar } from '@/components/vie';
import { DisplaySection } from '@/features/video-output/components/output/DisplaySection';
import { Celebration } from '@/features/video-output/components/output/Celebration';
import { CrossTabLink } from '@/features/video-output/components/output/CrossTabLink';

function ShowcaseSection({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  );
}

const GLASS_VARIANTS = ['default', 'elevated', 'outlined', 'interactive'] as const;

// DisplaySection sample data
const displaySamples = {
  keyPoints: [
    { emoji: '⚡', title: 'Performance First', detail: 'React 19 introduces automatic batching for all state updates, reducing unnecessary re-renders.' },
    { emoji: '🔒', title: 'Type Safety', detail: 'TypeScript strict mode catches 40% more bugs at compile time compared to loose mode.' },
    { emoji: '🎨', title: 'Design Tokens', detail: 'OKLCH color space provides perceptually uniform color manipulation across themes.' },
  ],
  tips: [
    { type: 'tip', text: 'Always use semantic HTML elements for better accessibility and SEO.' },
    { type: 'warning', text: 'Avoid using index as key in lists — it causes subtle bugs with reordering.' },
    { type: 'chef_tip', text: 'Let the dough rest for 30 minutes before rolling for a flakier crust.' },
  ],
  quotes: [
    { text: 'The best way to predict the future is to invent it.', speaker: 'Alan Kay' },
    { text: 'Simplicity is the ultimate sophistication.', speaker: 'Leonardo da Vinci' },
  ],
  strings: ['Use feature branches for all new work', 'Write tests before refactoring', 'Keep PRs under 400 lines', 'Review your own PR first'],
  plainText: 'This is a plain text string rendered by DisplaySection. It handles simple strings, arrays, objects, key points, tips, quotes, and more — choosing the right block automatically based on data shape.',
  object: { framework: 'React', version: '19.0', language: 'TypeScript', bundler: 'Vite', styling: 'Tailwind v4' },
  specs: [
    { key: 'CPU', value: 'Apple M2 Pro' },
    { key: 'RAM', value: '16 GB' },
    { key: 'Storage', value: '512 GB SSD' },
    { key: 'Display', value: '14.2" Liquid Retina XDR' },
  ],
};

export function CardsShowcase() {
  const [navigatedTab, setNavigatedTab] = useState<string | null>(null);

  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Output System Infrastructure</h2>
        <p className="text-sm text-muted-foreground">
          Glass surfaces, data display, progress tracking, celebrations, and navigation — the foundation of the composable output system.
        </p>
      </div>

      {/* GlassCard variants */}
      <ShowcaseSection
        title="GlassCard"
        description="Glass-morphism card with 4 variants. Uses global CSS variables for backdrop blur and border effects."
      >
        <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
          {GLASS_VARIANTS.map((variant) => (
            <GlassCard key={variant} variant={variant}>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm capitalize">{variant}</span>
                  <code className="text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    variant=&quot;{variant}&quot;
                  </code>
                </div>
                <p className="text-sm text-muted-foreground">
                  {variant === 'default' && 'Standard glass surface with subtle backdrop blur.'}
                  {variant === 'elevated' && 'Enhanced shadow for elevated surfaces.'}
                  {variant === 'outlined' && 'Transparent background with prominent border.'}
                  {variant === 'interactive' && 'Hover to see lift and shadow transition.'}
                </p>
              </div>
            </GlassCard>
          ))}
        </div>
      </ShowcaseSection>

      {/* DisplaySection */}
      <ShowcaseSection
        title="DisplaySection"
        description="Generic data renderer for non-interactive tabs. Detects data shape (key points, tips, quotes, strings, objects, specs) and picks the right block automatically."
      >
        <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
          <div className="rounded-xl border border-border/40 bg-card/80 overflow-hidden shadow-sm">
            <div className="flex items-center gap-2 border-b border-border/30 px-4 py-3 bg-muted/20">
              <span className="font-medium text-sm">Key Points</span>
              <code className="text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{'{ emoji, title, detail }[]'}</code>
            </div>
            <div className="p-4">
              <DisplaySection data={displaySamples.keyPoints} />
            </div>
          </div>

          <div className="rounded-xl border border-border/40 bg-card/80 overflow-hidden shadow-sm">
            <div className="flex items-center gap-2 border-b border-border/30 px-4 py-3 bg-muted/20">
              <span className="font-medium text-sm">Tips</span>
              <code className="text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{'{ type, text }[]'}</code>
            </div>
            <div className="p-4">
              <DisplaySection data={displaySamples.tips} />
            </div>
          </div>

          <div className="rounded-xl border border-border/40 bg-card/80 overflow-hidden shadow-sm">
            <div className="flex items-center gap-2 border-b border-border/30 px-4 py-3 bg-muted/20">
              <span className="font-medium text-sm">Quotes</span>
              <code className="text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{'{ text, speaker }[]'}</code>
            </div>
            <div className="p-4">
              <DisplaySection data={displaySamples.quotes} />
            </div>
          </div>

          <div className="rounded-xl border border-border/40 bg-card/80 overflow-hidden shadow-sm">
            <div className="flex items-center gap-2 border-b border-border/30 px-4 py-3 bg-muted/20">
              <span className="font-medium text-sm">String Array</span>
              <code className="text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">string[]</code>
            </div>
            <div className="p-4">
              <DisplaySection data={displaySamples.strings} />
            </div>
          </div>

          <div className="rounded-xl border border-border/40 bg-card/80 overflow-hidden shadow-sm">
            <div className="flex items-center gap-2 border-b border-border/30 px-4 py-3 bg-muted/20">
              <span className="font-medium text-sm">Plain Text</span>
              <code className="text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">string</code>
            </div>
            <div className="p-4">
              <DisplaySection data={displaySamples.plainText} />
            </div>
          </div>

          <div className="rounded-xl border border-border/40 bg-card/80 overflow-hidden shadow-sm">
            <div className="flex items-center gap-2 border-b border-border/30 px-4 py-3 bg-muted/20">
              <span className="font-medium text-sm">Specs (key/value)</span>
              <code className="text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{'{ key, value }[]'}</code>
            </div>
            <div className="p-4">
              <DisplaySection data={displaySamples.specs} />
            </div>
          </div>

          <div className="rounded-xl border border-border/40 bg-card/80 overflow-hidden shadow-sm">
            <div className="flex items-center gap-2 border-b border-border/30 px-4 py-3 bg-muted/20">
              <span className="font-medium text-sm">Generic Object</span>
              <code className="text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Record&lt;string, unknown&gt;</code>
            </div>
            <div className="p-4">
              <DisplaySection data={displaySamples.object} />
            </div>
          </div>

          <div className="rounded-xl border border-border/40 bg-card/80 overflow-hidden shadow-sm">
            <div className="flex items-center gap-2 border-b border-border/30 px-4 py-3 bg-muted/20">
              <span className="font-medium text-sm">Null / Empty</span>
              <code className="text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">null</code>
            </div>
            <div className="p-4">
              <DisplaySection data={null} />
            </div>
          </div>
        </div>
      </ShowcaseSection>

      {/* ProgressBar */}
      <ShowcaseSection
        title="ProgressBar"
        description="Linear progress bar with animated fill. Used by interactive components to show completion state."
      >
        <div className="space-y-4 max-w-md">
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">0% — Not started</span>
            <ProgressBar value={0} max={10} label="Not started" />
          </div>
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">30% — In progress</span>
            <ProgressBar value={3} max={10} label="In progress" />
          </div>
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">70% — Most done</span>
            <ProgressBar value={7} max={10} label="Most done" />
          </div>
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">100% — Complete</span>
            <ProgressBar value={10} max={10} label="Complete" />
          </div>
        </div>
      </ShowcaseSection>

      {/* Celebration */}
      <ShowcaseSection
        title="Celebration"
        description="Completion celebration with popIn animation. Optional next-tab navigation button."
      >
        <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
          <div className="rounded-xl border border-border/40 bg-card/80 overflow-hidden shadow-sm">
            <div className="flex items-center gap-2 border-b border-border/30 px-4 py-3 bg-muted/20">
              <span className="font-medium text-sm">With next tab</span>
              <code className="text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">nextTabId + nextLabel</code>
            </div>
            <div className="p-4" style={{ '--vie-accent': 'oklch(0.65 0.2 250)' } as React.CSSProperties}>
              <Celebration
                emoji="🎉"
                title="All Done!"
                subtitle="You completed every scenario."
                nextTabId="flashcards"
                nextLabel="Try Flashcards"
                onNavigateTab={(id) => setNavigatedTab(id)}
              />
              {navigatedTab && (
                <p className="text-xs text-muted-foreground text-center mt-2">
                  Navigated to: <code className="bg-muted px-1 rounded">{navigatedTab}</code>
                </p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border/40 bg-card/80 overflow-hidden shadow-sm">
            <div className="flex items-center gap-2 border-b border-border/30 px-4 py-3 bg-muted/20">
              <span className="font-medium text-sm">Without next tab</span>
              <code className="text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">minimal</code>
            </div>
            <div className="p-4">
              <Celebration
                emoji="✅"
                title="Quiz Complete"
                subtitle="You scored 8/10!"
              />
            </div>
          </div>
        </div>
      </ShowcaseSection>

      {/* CrossTabLink */}
      <ShowcaseSection
        title="CrossTabLink"
        description="Full-width navigation buttons between tabs. Uses VIE accent CSS variables for theming."
      >
        <div
          className="space-y-2 max-w-md"
          style={{
            '--vie-accent': 'oklch(0.65 0.2 250)',
            '--vie-accent-muted': 'oklch(0.65 0.2 250 / 0.1)',
            '--vie-accent-border': 'oklch(0.65 0.2 250 / 0.25)',
          } as React.CSSProperties}
        >
          <CrossTabLink
            tabId="concepts"
            label="Explore Key Concepts"
            onNavigate={(id) => setNavigatedTab(id)}
          />
          <CrossTabLink
            tabId="quiz"
            label="Test Your Knowledge"
            onNavigate={(id) => setNavigatedTab(id)}
          />
        </div>
      </ShowcaseSection>

    </div>
  );
}
