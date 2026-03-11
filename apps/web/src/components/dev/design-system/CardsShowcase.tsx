/**
 * Cards & Output Showcase — Dev Only
 *
 * Showcases GlassCard, Celebration, and CrossTabLink
 * from the composable output system.
 */

// Production guard
if (!import.meta.env.DEV) {
  throw new Error('CardsShowcase should not be imported in production');
}

import { useState } from 'react';
import { GlassCard } from '@/components/video-detail/output/GlassCard';
import { Celebration } from '@/components/video-detail/output/Celebration';
import { CrossTabLink } from '@/components/video-detail/output/CrossTabLink';

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

export function CardsShowcase() {
  const [navigatedTab, setNavigatedTab] = useState<string | null>(null);

  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Cards & Output</h2>
        <p className="text-sm text-muted-foreground">
          Components from the composable output system — glass surfaces, celebrations, and navigation.
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
