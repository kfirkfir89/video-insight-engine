import { useEffect, useImperativeHandle, forwardRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { TabDefinition, ContentTag } from '@vie/types';
import { getDomainGradient } from '@vie/shared/config';
import { useTabCoordination } from './TabCoordinationContext';
import { Check } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

/** Preview descriptions shown in tooltips so users know what a tab contains before clicking. */
const TAB_PREVIEWS: Record<string, string> = {
  // Learning
  key_points: 'Essential takeaways from the video',
  concepts: 'Core concepts explained with examples',
  takeaways: 'Action items and insights',
  timestamps: 'Navigate to key moments in the video',
  quizzes: 'Test your understanding with questions',
  flashcards: 'Flip cards to memorize key facts',
  scenarios: 'Branching what-would-you-do situations',
  // Tech
  overview: 'A high-level summary',
  setup: 'Setup and installation steps',
  code: 'Code snippets with explanations',
  patterns: 'Patterns and best practices',
  cheat_sheet: 'Quick reference',
  // Fitness
  exercises: 'Step-by-step exercise instructions',
  timer: 'Timed workout guidance',
  tips: 'Tips and technique pointers',
  // Food
  ingredients: 'Full ingredients list with scaling',
  steps: 'Step-by-step recipe instructions',
  // Music
  analysis: 'Musical analysis and structure',
  structure: 'Song structure breakdown',
  lyrics: 'Synced lyrics with timestamps',
  credits: 'Credits and attributions',
  // Travel
  itinerary: 'Day-by-day trip plan',
  packing: 'Packing checklist',
  budget: 'Cost breakdown',
  // Review
  verdict: 'Final verdict and scoring',
  pros_cons: 'Pros and cons side by side',
  specs: 'Specifications and features',
  // Project
  materials: 'Materials needed',
  tools: 'Tools required',
  safety: 'Safety considerations',
  // Narrative
  key_moments: 'Pivotal moments',
  quotes: 'Memorable quotes',
  // Language
  phrases: 'Useful phrases with translations',
  rules: 'Grammar rules explained',
  drills: 'Practice exercises',
  vocabulary: 'Vocabulary cards',
  // Science
  key_facts: 'Verified facts',
  experiments: 'Experiments and demonstrations',
};

/** Get human-readable preview for a tab id. */
function getTabPreview(tabId: string): string | null {
  return TAB_PREVIEWS[tabId] ?? null;
}

interface TabLayoutProps {
  tabs: TabDefinition[];
  primaryTag: ContentTag;
  children: (activeTabId: string, onNavigateTab: (id: string) => void) => ReactNode;
  className?: string;
  /** Whether the summary is still streaming — shows the progress pill above the tab bar. */
  isStreaming?: boolean;
  /** Expected total tab count (from meta event). Used for the "N of M" progress indicator. */
  totalCount?: number;
  /** Current streaming phase label (e.g. "Generating study aids…"). */
  phaseLabel?: string;
}

export interface TabLayoutHandle {
  setActiveTab: (tabId: string) => void;
}

/** Strip leading emoji from label if it duplicates the separate emoji field. */
function dedupEmojiLabel(label: string, emoji?: string): string {
  if (!emoji || !label) return label;
  // Check if label starts with the emoji (with optional trailing space)
  if (label.startsWith(emoji)) {
    return label.slice(emoji.length).trimStart();
  }
  return label;
}

export const TabLayout = forwardRef<TabLayoutHandle, TabLayoutProps>(
  function TabLayout(
    { tabs, primaryTag, children, className, isStreaming = false, totalCount = 0, phaseLabel },
    ref,
  ) {
    const coordination = useTabCoordination();
    const activeTab = coordination?.activeTab ?? tabs[0]?.id ?? '';
    const setActiveTab = coordination?.setActiveTab ?? (() => {});
    const completedTabs = coordination?.completedTabs ?? new Set<string>();

    // Ensure activeTab is valid
    useEffect(() => {
      if (tabs.length > 0 && !tabs.some(t => t.id === activeTab)) {
        setActiveTab(tabs[0].id);
      }
    }, [tabs, activeTab, setActiveTab]);

    useImperativeHandle(ref, () => ({ setActiveTab }), [setActiveTab]);

    const gradient = getDomainGradient(primaryTag);
    const domainAccent: React.CSSProperties = {
      ['--domain-gradient' as string]: gradient,
    };

    const renderedCount = tabs.length;
    const expectedCount = Math.max(totalCount, renderedCount);
    const showProgress = isStreaming || (renderedCount > 0 && renderedCount < totalCount);

    return (
      <div className={cn('flex flex-col gap-6', className)} data-domain={primaryTag} style={domainAccent}>
        {/* Status row — eyebrow + progress counter.
            Only rendered while streaming (or when a stale stream left partial tabs),
            so finished videos stay quiet and unchanged. */}
        {showProgress && (
          <div className="flex items-center justify-between gap-4 px-1 animate-[fadeUp_0.35s_var(--ease-out-expo)_both]">
            <div className="flex items-baseline gap-2.5">
              <span
                className="text-[10px] font-bold uppercase tracking-[0.22em]"
                style={{
                  backgroundImage: gradient,
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  color: 'transparent',
                }}
              >
                {isStreaming ? 'Generating' : 'Ready'}
              </span>
              <span className="text-xs font-medium tabular-nums text-muted-foreground">
                {renderedCount} <span className="text-muted-foreground/50">of</span> {expectedCount}
              </span>
            </div>
            {phaseLabel && (
              <span className="hidden sm:block truncate text-xs text-muted-foreground/80">
                {phaseLabel}
              </span>
            )}
          </div>
        )}

        {/* Tab bar — sticky so users always see which tab they're on.
            Active tab is dramatically heavier than inactive (size + weight + shadow)
            to create a clear primary-action focal point. */}
        <TooltipProvider delayDuration={300}>
        <div
          className="sticky top-0 z-10 flex items-center gap-2 overflow-x-auto overflow-y-hidden overscroll-x-contain [touch-action:pan-x] bg-background/80 backdrop-blur-sm pb-3 pt-2 border-b border-border/40 scrollbar-none relative after:absolute after:inset-x-0 after:-bottom-px after:h-px after:opacity-60 after:[background:var(--domain-gradient)]"
          role="tablist"
        >
          {tabs.map((tab, idx) => {
            const isActive = tab.id === activeTab;
            const isCompleted = completedTabs.has(tab.id);
            const preview = getTabPreview(tab.id);
            const position = String(idx + 1).padStart(2, '0');
            const button = (
              <button
                key={tab.id}
                id={`tab-${tab.id}`}
                role="tab"
                aria-selected={isActive}
                aria-controls={`panel-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'group relative flex shrink-0 items-center rounded-full transition-all duration-300',
                  isActive
                    ? 'gap-2 px-5 py-2.5 text-base font-bold text-primary-foreground shadow-lg shadow-primary/25'
                    : 'gap-1.5 px-3.5 py-2 text-sm font-medium bg-muted/40 text-muted-foreground/90 hover:bg-muted hover:text-foreground',
                )}
                style={isActive ? { background: gradient } : undefined}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'font-mono tabular-nums text-[10px] leading-none',
                    isActive ? 'text-primary-foreground/75' : 'text-muted-foreground/55',
                  )}
                >
                  {position}
                </span>
                <span role="img" aria-hidden="true" className={cn(isActive ? 'text-lg' : 'text-base')}>
                  {tab.emoji}
                </span>
                <span>{dedupEmojiLabel(tab.label, tab.emoji)}</span>
                {isCompleted && !isActive && (
                  <Check className="h-3.5 w-3.5 shrink-0 text-success" aria-label="Completed" />
                )}
              </button>
            );
            if (!preview) return button;
            return (
              <Tooltip key={tab.id}>
                <TooltipTrigger asChild>{button}</TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs max-w-[220px]">
                  {preview}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
        </TooltipProvider>

        {/* Content area */}
        <div
          id={`panel-${activeTab}`}
          role="tabpanel"
          aria-labelledby={`tab-${activeTab}`}
          className="animate-[fadeUp_0.3s_var(--ease-out-expo,ease)_both]"
          key={activeTab}
        >
          {children(activeTab, setActiveTab)}
        </div>
      </div>
    );
  }
);
