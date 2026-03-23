/**
 * VIE Component Library Showcase — Dev Only
 *
 * Comprehensive showcase of all vie/ primitives organized by category:
 * Cards, Content, Data, Feedback, Interactive, Navigation, Output Helpers.
 *
 * Each component is rendered with realistic mock data and labeled with its
 * import path and key props.
 */

// Production guard
if (!import.meta.env.DEV) {
  throw new Error('VIELibraryShowcase should not be imported in production');
}

import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Lightbulb, AlertTriangle, Info, ShieldAlert, Sparkles } from 'lucide-react';

// ── vie/ imports ──
import {
  // Cards
  GlassCard,
  ExpandableCard,
  HeroCard,
  ImageCard,
  VideoHero,
  // Content
  TextBlock,
  CodeSnippet,
  QuoteBlock as VieQuoteBlock,
  DefinitionItem,
  ListItems,
  // Data
  ScoreRing,
  StatPill,
  Badge as VieBadge,
  KeyValue,
  CostDisplay,
  Timer,
  Timestamp,
  // Feedback
  Celebration as VieCelebration,
  CelebrationNextButton,
  FadeIn,
  InlineScore,
  Shake,
  // Interactive
  CheckItem,
  FlipCard,
  OptionGrid,
  ActionButton,
  EmojiMarker,
  MapLink,
  // Navigation
  ProgressBar,
  CrossTabButton,
  TabBar,
  SectionNav,
  Stepper,
  BackForward,
} from '@/components/vie';

// Output helpers (not in vie/ but part of the output system)
import { DisplaySection } from '@/features/video-output/components/output/DisplaySection';

// ── Shared layout helpers ──

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
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

function DemoCard({ label, type, children }: { label: string; type: string; children: React.ReactNode }) {
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

type LibrarySection = 'all' | 'cards' | 'content' | 'data' | 'feedback' | 'interactive' | 'navigation' | 'output';

const SECTIONS: { id: LibrarySection; label: string; count: number }[] = [
  { id: 'all', label: 'All', count: 36 },
  { id: 'cards', label: 'Cards & Surfaces', count: 5 },
  { id: 'content', label: 'Content', count: 5 },
  { id: 'data', label: 'Data Display', count: 7 },
  { id: 'feedback', label: 'Feedback', count: 4 },
  { id: 'interactive', label: 'Interactive', count: 6 },
  { id: 'navigation', label: 'Navigation', count: 6 },
  { id: 'output', label: 'Output Helpers', count: 1 },
];

// ── Section Components ──

function CardsSection() {
  return (
    <Section title="Cards & Surfaces" description="Glass-morphism containers, expandable panels, hero headers, and image cards.">
      <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
        <DemoCard label="GlassCard" type="vie/cards">
          <div className="space-y-3">
            {(['default', 'elevated', 'outlined', 'interactive'] as const).map((variant) => (
              <GlassCard key={variant} variant={variant}>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm capitalize">{variant}</span>
                  <code className="text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    variant=&quot;{variant}&quot;
                  </code>
                </div>
              </GlassCard>
            ))}
          </div>
        </DemoCard>

        <DemoCard label="ExpandableCard" type="vie/cards">
          <div className="space-y-3">
            <ExpandableCard
              header={<span className="font-medium text-sm">Click to expand — default collapsed</span>}
            >
              <p className="text-sm text-muted-foreground">
                Hidden content revealed on click. Great for secondary details, long descriptions, or advanced settings.
              </p>
            </ExpandableCard>
            <ExpandableCard
              header={<span className="font-medium text-sm">Pre-expanded card</span>}
              defaultExpanded
            >
              <p className="text-sm text-muted-foreground">
                This card starts open. Use <code className="bg-muted px-1 rounded text-xs">defaultExpanded</code> prop.
              </p>
            </ExpandableCard>
          </div>
        </DemoCard>

        <DemoCard label="HeroCard" type="vie/cards">
          <HeroCard
            emoji="⚡"
            title="React Performance Masterclass"
            subtitle="A comprehensive guide to optimizing React applications"
          />
        </DemoCard>

        <DemoCard label="VideoHero" type="vie/cards">
          <VideoHero
            title="React Performance Masterclass"
            creator="Tech Channel"
            duration={3847}
            tldr="A deep-dive into React rendering optimization, covering memo, useMemo, code splitting, and real-world profiling techniques."
            keyTakeaways={[
              'Use React DevTools Profiler before optimizing',
              'Component splits beat memo in most cases',
              'Lazy load routes, not individual components',
            ]}
            masterSummary="This video walks through the full React performance toolkit. Starting with the Profiler, the presenter demonstrates how to identify unnecessary re-renders and fix them with targeted component splits rather than blanket memoization. The second half covers code splitting with React.lazy and Suspense boundaries."
            youtubeId="dQw4w9WgXcQ"
          />
        </DemoCard>

        <DemoCard label="ImageCard" type="vie/cards">
          <div className="space-y-3">
            <ImageCard
              src="https://placehold.co/640x360/1a1a2e/e0e0e0?text=16:9+Video"
              alt="Video aspect ratio demo"
              aspectRatio="video"
            >
              <p className="text-sm font-medium">Video (16:9)</p>
            </ImageCard>
          </div>
        </DemoCard>
      </div>
    </Section>
  );
}

function ContentSection() {
  return (
    <Section title="Content Blocks" description="Domain-free text, code, quotes, definitions, and lists.">
      <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
        <DemoCard label="TextBlock" type="vie/content">
          <div className="space-y-3">
            <TextBlock intent="tip" icon={<Lightbulb />}>
              Pro tip: Always use TypeScript for better type safety and IDE support.
            </TextBlock>
            <TextBlock intent="warning" icon={<AlertTriangle />}>
              Warning: This action cannot be undone. Proceed with caution.
            </TextBlock>
            <TextBlock intent="note" icon={<Info />}>
              Note: This feature requires React 19 or later.
            </TextBlock>
            <TextBlock intent="security" icon={<ShieldAlert />}>
              Never commit API keys to version control.
            </TextBlock>
          </div>
        </DemoCard>

        <DemoCard label="CodeSnippet" type="vie/content">
          <CodeSnippet
            code={`function useCounter(initial = 0) {
  const [count, setCount] = useState(initial);
  return { count, increment: () => setCount(c => c + 1) };
}`}
            explanation="Custom hook with copy-to-clipboard button."
          />
        </DemoCard>

        <DemoCard label="QuoteBlock" type="vie/content">
          <div className="space-y-4">
            <VieQuoteBlock
              text="The best way to predict the future is to invent it."
              attribution="Alan Kay"
              variant="speaker"
            />
            <VieQuoteBlock
              text="The key insight is that simplicity always wins."
              variant="highlight"
            />
          </div>
        </DemoCard>

        <DemoCard label="DefinitionItem" type="vie/content">
          <div className="space-y-2">
            <DefinitionItem
              term="React Hook"
              meaning="A special function that lets you use state and other React features in functional components without writing a class."
            />
            <DefinitionItem
              term="Closure"
              meaning="A function that retains access to variables from its outer scope."
            />
          </div>
        </DemoCard>

        <DemoCard label="ListItems" type="vie/content">
          <ListItems
            label="Best Practices"
            items={[
              'Use feature branches for all new work',
              'Write tests before refactoring',
              'Keep PRs under 400 lines',
              'Review your own PR first',
            ]}
          />
        </DemoCard>
      </div>
    </Section>
  );
}

function DataSection() {
  return (
    <Section title="Data Display" description="Scores, stats, badges, key-value pairs, costs, timers, and timestamps.">
      <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
        <DemoCard label="ScoreRing" type="vie/data">
          <div className="flex items-end justify-around py-4">
            <ScoreRing score={85} total={100} label="Percentage" size="sm" />
            <ScoreRing score={7.5} total={10} label="Rating" size="md" />
            <ScoreRing score={42} total={50} label="Fraction" size="lg" />
          </div>
        </DemoCard>

        <DemoCard label="StatPill" type="vie/data">
          <div className="flex flex-wrap items-center justify-around gap-4 py-2">
            <StatPill value="2.4M" label="Users" trend="up" />
            <StatPill value="99.9%" label="Uptime" trend="neutral" />
            <StatPill value="12ms" label="Latency" trend="down" context="p99" />
          </div>
        </DemoCard>

        <DemoCard label="Badge" type="vie/data">
          <div className="flex flex-wrap gap-2">
            {(['default', 'success', 'warning', 'destructive', 'info', 'muted'] as const).map((v) => (
              <VieBadge key={v} variant={v}>{v}</VieBadge>
            ))}
          </div>
        </DemoCard>

        <DemoCard label="KeyValue" type="vie/data">
          <KeyValue
            label="Tech Stack"
            items={[
              { key: 'Framework', value: 'React 19' },
              { key: 'Language', value: 'TypeScript 5.4' },
              { key: 'Bundler', value: 'Vite 6' },
              { key: 'Styling', value: 'Tailwind v4' },
            ]}
          />
        </DemoCard>

        <DemoCard label="CostDisplay" type="vie/data">
          <div className="flex items-end justify-around py-2">
            <CostDisplay amount={29} label="Monthly" size="sm" />
            <CostDisplay amount={2600} currency="€" label="Trip Total" size="md" />
            <CostDisplay amount={99} label="Enterprise" size="lg" />
          </div>
        </DemoCard>

        <DemoCard label="Timer" type="vie/data">
          <Timer duration={90} />
        </DemoCard>

        <DemoCard label="Timestamp" type="vie/data">
          <div className="flex items-center gap-6 py-2">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Static</span>
              <div><Timestamp seconds={323} /></div>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Clickable</span>
              <div><Timestamp seconds={945} onClick={() => {}} /></div>
            </div>
          </div>
        </DemoCard>
      </div>
    </Section>
  );
}

function FeedbackSection() {
  const [shakeActive, setShakeActive] = useState(false);

  const triggerShake = useCallback(() => {
    setShakeActive(true);
    setTimeout(() => setShakeActive(false), 500);
  }, []);

  return (
    <Section title="Feedback & Animation" description="Celebrations, entrance animations, scores, and error shake.">
      <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
        <DemoCard label="Celebration" type="vie/feedback">
          <VieCelebration
            emoji="🎉"
            title="All Done!"
            subtitle="You completed every scenario."
            action={<CelebrationNextButton label="Try Flashcards" onClick={() => {}} />}
          />
        </DemoCard>

        <DemoCard label="FadeIn" type="vie/feedback">
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <FadeIn key={i} index={i}>
                <div className="rounded-lg bg-muted/30 p-3 text-sm text-muted-foreground">
                  Item {i + 1} — stagger delay {i * 75}ms
                </div>
              </FadeIn>
            ))}
          </div>
        </DemoCard>

        <DemoCard label="InlineScore" type="vie/feedback">
          <div className="flex items-center gap-6 py-2">
            <div className="text-center space-y-1">
              <InlineScore correct={9} total={10} />
              <p className="text-xs text-muted-foreground">High</p>
            </div>
            <div className="text-center space-y-1">
              <InlineScore correct={5} total={10} />
              <p className="text-xs text-muted-foreground">Medium</p>
            </div>
            <div className="text-center space-y-1">
              <InlineScore correct={2} total={10} />
              <p className="text-xs text-muted-foreground">Low</p>
            </div>
          </div>
        </DemoCard>

        <DemoCard label="Shake" type="vie/feedback">
          <div className="space-y-3">
            <Shake active={shakeActive}>
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-center">
                Wrong answer! This element shakes.
              </div>
            </Shake>
            <button
              onClick={triggerShake}
              className="rounded-md bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/20 transition-colors"
            >
              Trigger Shake
            </button>
          </div>
        </DemoCard>
      </div>
    </Section>
  );
}

function InteractiveSection() {
  const [checked, setChecked] = useState([false, true, false]);
  const [quizAnswer, setQuizAnswer] = useState<number | undefined>(undefined);

  return (
    <Section title="Interactive Primitives" description="Check items, flip cards, option grids, action buttons, emoji markers, and map links.">
      <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
        <DemoCard label="CheckItem" type="vie/interactive">
          <div className="space-y-0">
            {[
              { label: '2 cups flour', note: 'sifted' },
              { label: '1 cup whole milk' },
              { label: '3 large eggs', note: 'room temperature' },
            ].map((item, i) => (
              <CheckItem
                key={i}
                label={item.label}
                note={item.note}
                checked={checked[i]}
                onToggle={() => setChecked((prev) => prev.map((v, j) => (j === i ? !v : v)))}
              />
            ))}
          </div>
        </DemoCard>

        <DemoCard label="FlipCard" type="vie/interactive">
          <FlipCard
            front="What is the time complexity of binary search?"
            back="O(log n) — the search space is halved each step."
            emoji="🔍"
            category="Algorithms"
          />
        </DemoCard>

        <DemoCard label="OptionGrid" type="vie/interactive">
          <div className="space-y-2">
            <p className="text-sm font-medium">Which data structure for O(1) lookups?</p>
            <OptionGrid
              options={['Array', 'Set', 'Linked List', 'Stack']}
              selectedIndex={quizAnswer}
              correctIndex={1}
              onSelect={setQuizAnswer}
            />
            {quizAnswer !== undefined && (
              <button
                onClick={() => setQuizAnswer(undefined)}
                className="text-xs text-primary hover:underline"
              >
                Reset
              </button>
            )}
          </div>
        </DemoCard>

        <DemoCard label="ActionButton + EmojiMarker + MapLink" type="vie/interactive">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <ActionButton variant="primary" icon={<Sparkles />} onClick={() => {}}>
                Primary
              </ActionButton>
              <ActionButton variant="ghost" onClick={() => {}}>
                Ghost
              </ActionButton>
              <ActionButton variant="outline" onClick={() => {}}>
                Outline
              </ActionButton>
            </div>
            <div className="flex items-center gap-3">
              <EmojiMarker emoji="🍜" size="sm" />
              <EmojiMarker emoji="🏛️" size="md" />
              <EmojiMarker emoji="🌸" size="lg" />
            </div>
            <MapLink name="Fushimi Inari Shrine" query="Fushimi Inari Taisha Kyoto" />
          </div>
        </DemoCard>
      </div>
    </Section>
  );
}

function NavigationSection() {
  const [activeTab, setActiveTab] = useState('overview');
  const [activeSection, setActiveSection] = useState('day1');
  const [stepperIndex, setStepperIndex] = useState(1);

  return (
    <Section title="Navigation" description="Progress bars, tab bars, steppers, section navs, cross-tab buttons, and back/forward controls.">
      <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
        <DemoCard label="ProgressBar" type="vie/navigation">
          <div className="space-y-4">
            {[
              { value: 0, max: 10, label: '0%' },
              { value: 3, max: 10, label: '30%' },
              { value: 7, max: 10, label: '70%' },
              { value: 10, max: 10, label: '100%' },
            ].map((p) => (
              <div key={p.label} className="space-y-1">
                <span className="text-xs text-muted-foreground">{p.label}</span>
                <ProgressBar value={p.value} max={p.max} label={p.label} />
              </div>
            ))}
          </div>
        </DemoCard>

        <DemoCard label="TabBar" type="vie/navigation">
          <TabBar
            tabs={[
              { id: 'overview', label: 'Overview', emoji: '📖' },
              { id: 'concepts', label: 'Concepts', emoji: '💡' },
              { id: 'quiz', label: 'Quiz', emoji: '🧠' },
            ]}
            activeId={activeTab}
            onTabChange={setActiveTab}
            completedIds={new Set(['overview'])}
            activeGradient="linear-gradient(135deg, oklch(0.55 0.15 250), oklch(0.45 0.2 280))"
          />
          <p className="text-xs text-muted-foreground mt-2">Active: <code className="bg-muted px-1 rounded">{activeTab}</code></p>
        </DemoCard>

        <DemoCard label="SectionNav" type="vie/navigation">
          <SectionNav
            sections={[
              { id: 'day1', label: 'Day 1: Tokyo' },
              { id: 'day2', label: 'Day 2: Kyoto' },
              { id: 'day3', label: 'Day 3: Osaka' },
            ]}
            activeId={activeSection}
            onSelect={setActiveSection}
          />
          <p className="text-xs text-muted-foreground mt-2">Active: <code className="bg-muted px-1 rounded">{activeSection}</code></p>
        </DemoCard>

        <DemoCard label="Stepper" type="vie/navigation">
          <div className="space-y-3">
            <Stepper
              total={5}
              current={stepperIndex}
              completedSteps={new Set([0])}
              onStepClick={setStepperIndex}
            />
            <p className="text-xs text-muted-foreground text-center">
              Step {stepperIndex + 1} of 5 — click dots to navigate
            </p>
          </div>
        </DemoCard>

        <DemoCard label="CrossTabButton" type="vie/navigation">
          <div
            className="space-y-2"
            style={{
              '--vie-accent': 'oklch(0.65 0.2 250)',
              '--vie-accent-muted': 'oklch(0.65 0.2 250 / 0.1)',
              '--vie-accent-border': 'oklch(0.65 0.2 250 / 0.25)',
            } as React.CSSProperties}
          >
            <CrossTabButton label="Explore Key Concepts" onClick={() => {}} />
            <CrossTabButton label="Test Your Knowledge" onClick={() => {}} />
          </div>
        </DemoCard>

        <DemoCard label="BackForward" type="vie/navigation">
          <BackForward
            onBack={() => {}}
            onForward={() => {}}
            backLabel="Previous"
            forwardLabel="Next"
          />
          <div className="mt-3">
            <BackForward
              onBack={() => {}}
              onForward={() => {}}
              backDisabled
              forwardLabel="Get Started"
            />
          </div>
        </DemoCard>
      </div>
    </Section>
  );
}

function OutputHelpersSection() {
  const sampleData = {
    keyPoints: [
      { emoji: '⚡', title: 'Performance', detail: 'React 19 automatic batching reduces re-renders.' },
      { emoji: '🔒', title: 'Type Safety', detail: 'Strict mode catches 40% more bugs at compile time.' },
    ],
    specs: [
      { key: 'CPU', value: 'Apple M2 Pro' },
      { key: 'RAM', value: '16 GB' },
      { key: 'Storage', value: '512 GB SSD' },
    ],
    strings: ['Use feature branches', 'Write tests first', 'Keep PRs small'],
  };

  return (
    <Section title="Output Helpers" description="Higher-level composed components used by the output system.">
      <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
        <DemoCard label="DisplaySection — Key Points" type="output/DisplaySection">
          <DisplaySection data={sampleData.keyPoints} />
        </DemoCard>

        <DemoCard label="DisplaySection — Specs" type="output/DisplaySection">
          <DisplaySection data={sampleData.specs} />
        </DemoCard>

        <DemoCard label="DisplaySection — Strings" type="output/DisplaySection">
          <DisplaySection data={sampleData.strings} />
        </DemoCard>

        <DemoCard label="DisplaySection — Null" type="output/DisplaySection">
          <DisplaySection data={null} />
        </DemoCard>
      </div>
    </Section>
  );
}

// ── Main Export ──

export function VIELibraryShowcase() {
  const [section, setSection] = useState<LibrarySection>('all');

  const show = (id: LibrarySection) => section === 'all' || section === id;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">VIE Component Library</h2>
        <p className="text-sm text-muted-foreground">
          35 domain-free primitives across 7 categories. Props-first, no @vie/types dependency.
        </p>
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-1.5">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={cn(
              'rounded-md px-2.5 py-1 text-xs transition-colors',
              section === s.id
                ? 'bg-foreground text-background font-medium'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            )}
          >
            {s.label} ({s.count})
          </button>
        ))}
      </div>

      {/* Sections */}
      <div className="space-y-10">
        {show('cards') && <CardsSection />}
        {show('content') && <ContentSection />}
        {show('data') && <DataSection />}
        {show('feedback') && <FeedbackSection />}
        {show('interactive') && <InteractiveSection />}
        {show('navigation') && <NavigationSection />}
        {show('output') && <OutputHelpersSection />}
      </div>
    </div>
  );
}
