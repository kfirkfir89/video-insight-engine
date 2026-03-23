import { memo, useState, useMemo, type ReactNode } from 'react';
import type { VIEResponse, SpotItem, FlashcardItem, TabEntry, TechSnippet, StepItem, FitnessExercise, QuizItem, ScenarioItem, ReviewComparison } from '@vie/types';
import { DisplaySection } from './DisplaySection';
import { CrossTabLink } from './CrossTabLink';
import { TabIntro } from './TabIntro';
import { resolveCrossTabLinks } from './link-rules';
import { resolveTabData } from '@/lib/tab-data-resolver';
import { INTERACTIVE_TABS, renderInteractive } from './ComposableOutputV1';
import { useVideoPlayer } from '@/contexts/VideoPlayerContext';
import { RecipePlayer } from './RecipePlayer';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import {
  ChecklistInteractive,
  QuizInteractive,
  FlashDeckInteractive,
  ScenarioInteractive,
  SpotExplorer,
  StepByStepInteractive,
  ExerciseInteractive,
  TimelineExplorer,
  CodeExplorer,
  ComparisonInteractive,
  VerdictInteractive,
  BudgetInteractive,
  OverviewInteractive,
  InfoGridInteractive,
  GalleryInteractive,
  ClipPlayerInteractive,
  LyricsPlayerInteractive,
} from './interactive';

interface ComposableOutputProps {
  /** v1: VIEResponse with domain-keyed data (null when using assembled tabs). */
  response: VIEResponse | null;
  /** Pre-assembled tabs from backend (component-addressed). */
  tabs?: TabEntry[] | null;
  activeTab: string;
  onNavigateTab: (tabId: string) => void;
  /** Primary content tag (for cooking mode detection). */
  primaryTag?: string;
}

// ─── Component Registry (v2: component name → renderer) ───

interface NavProps {
  nextTab?: string;
  onNavigateTab: (id: string) => void;
  onSeek?: (seconds: number) => void;
  tabId?: string;
  currentTime?: number;
}

interface ExerciseMeta {
  type?: string;
  difficulty?: string;
  duration?: number;
  equipment?: string[];
  muscleGroups?: string[];
}

/** Loose array cast — returns items that are non-null objects. Does NOT validate individual item shape. */
function asArray<T>(val: unknown): T[] {
  if (!Array.isArray(val)) return [];
  return val.filter((item): item is T => item != null && typeof item === 'object') as T[];
}

/**
 * Registry mapping component names to render functions.
 * Each function receives pre-assembled props from the backend.
 */
const COMPONENT_REGISTRY: Record<string, (props: Record<string, unknown>, nav: NavProps) => ReactNode> = {
  spot_explorer: (props, nav) => (
    <SpotExplorer
      spots={asArray<SpotItem>(props.spots)}
      sections={props.sections as Array<{ label: string; spotIndices: number[] }> | undefined}
      {...nav}
    />
  ),
  timeline: (props, nav) => (
    <TimelineExplorer entries={asArray(props.entries)} onSeek={nav.onSeek} currentTime={nav.currentTime} {...nav} />
  ),
  code_explorer: (props, nav) => (
    <CodeExplorer
      snippets={asArray<TechSnippet>(props.snippets)}
      mode={typeof props.mode === 'string' ? props.mode as 'navigate' | 'showAll' : undefined}
      onSeek={nav.onSeek}
      {...nav}
    />
  ),
  comparison: (props, nav) => (
    <ComparisonInteractive
      comparisons={asArray<ReviewComparison>(props.comparisons)}
      pros={Array.isArray(props.pros) ? props.pros as string[] : undefined}
      cons={Array.isArray(props.cons) ? props.cons as string[] : undefined}
      type={typeof props.type === 'string' ? props.type as 'table' | 'pros_cons' | 'versus' : undefined}
      {...nav}
    />
  ),
  checklist: (props, nav) => (
    <ChecklistInteractive
      items={Array.isArray(props.items) ? props.items as Array<{ label: string; note?: string; emoji?: string }> : []}
      tabLabel={typeof props.tabLabel === 'string' ? props.tabLabel : 'Items'}
      groups={Array.isArray(props.groups) ? props.groups as string[] : undefined}
      scalable={typeof props.scalable === 'boolean' ? props.scalable : undefined}
      baseServings={typeof props.baseServings === 'number' ? props.baseServings : undefined}
      tabId={nav.tabId}
      {...nav}
    />
  ),
  step_player: (props, nav) => (
    <StepByStepInteractive
      steps={asArray<StepItem>(props.steps)}
      mode={typeof props.mode === 'string' ? props.mode as 'scrollable' | 'one_at_a_time' : undefined}
      timers={typeof props.timers === 'boolean' ? props.timers : undefined}
      onSeek={nav.onSeek}
      tabId={nav.tabId}
      {...nav}
    />
  ),
  exercise_tracker: (props, nav) => (
    <ExerciseInteractive
      exercises={asArray<FitnessExercise>(props.exercises)}
      warmup={Array.isArray(props.warmup) ? (props.warmup as string[] | FitnessExercise[]) : undefined}
      cooldown={Array.isArray(props.cooldown) ? (props.cooldown as string[] | FitnessExercise[]) : undefined}
      meta={typeof props.meta === 'object' && props.meta !== null ? (props.meta as ExerciseMeta) : undefined}
      {...nav}
    />
  ),
  quiz: (props, nav) => (
    <QuizInteractive questions={asArray<QuizItem>(props.questions)} tabId={nav.tabId} {...nav} />
  ),
  flash_deck: (props, nav) => (
    <FlashDeckInteractive
      cards={asArray<FlashcardItem>(props.cards)}
      shuffleable={typeof props.shuffleable === 'boolean' ? props.shuffleable : undefined}
      tabId={nav.tabId}
      {...nav}
    />
  ),
  scenario: (props, nav) => (
    <ScenarioInteractive scenarios={asArray<ScenarioItem>(props.scenarios)} {...nav} />
  ),

  // New interactives
  verdict: (props, nav) => (
    <VerdictInteractive
      product={typeof props.product === 'string' ? props.product : ''}
      score={typeof props.score === 'number' ? props.score : undefined}
      maxScore={typeof props.maxScore === 'number' ? props.maxScore : undefined}
      badge={typeof props.badge === 'string' ? props.badge : undefined}
      bottomLine={typeof props.bottomLine === 'string' ? props.bottomLine : ''}
      bestFor={Array.isArray(props.bestFor) ? props.bestFor as string[] : undefined}
      notFor={Array.isArray(props.notFor) ? props.notFor as string[] : undefined}
      price={typeof props.price === 'string' ? props.price : undefined}
      {...nav}
    />
  ),
  budget: (props, nav) => (
    <BudgetInteractive
      total={typeof props.total === 'number' ? props.total : 0}
      currency={typeof props.currency === 'string' ? props.currency : undefined}
      breakdown={asArray(props.breakdown)}
      savingTips={Array.isArray(props.savingTips) ? props.savingTips as string[] : undefined}
      {...nav}
    />
  ),
  overview: (props, nav) => {
    // Overview props are nested inside props.data from the assembler
    const d = (typeof props.data === 'object' && props.data !== null ? props.data : props) as Record<string, unknown>;
    const dur = typeof d.duration === 'number' ? `${Math.round(Number(d.duration) / 60)} min` : typeof d.duration === 'string' ? d.duration : undefined;
    return (
      <OverviewInteractive
        title={typeof d.title === 'string' ? d.title : typeof props.title === 'string' ? props.title : 'Overview'}
        emoji={typeof d.emoji === 'string' ? d.emoji : undefined}
        subtitle={typeof d.subtitle === 'string' ? d.subtitle : undefined}
        stats={Array.isArray(d.stats) ? d.stats as Array<{ label: string; value: string }> : undefined}
        highlights={Array.isArray(d.highlights) ? d.highlights as Array<{ emoji: string; text: string }> : undefined}
        tips={Array.isArray(d.tips) ? d.tips as string[] : undefined}
        summary={typeof d.summary === 'string' ? d.summary : undefined}
        masterSummary={typeof d.masterSummary === 'string' ? d.masterSummary : undefined}
        keyTakeaways={Array.isArray(d.keyTakeaways) ? d.keyTakeaways as string[] : undefined}
        quote={typeof d.quote === 'string' ? d.quote : undefined}
        quoteAuthor={typeof d.quoteAuthor === 'string' ? d.quoteAuthor : undefined}
        duration={dur}
        level={typeof d.level === 'string' ? d.level : typeof d.difficulty === 'string' ? d.difficulty as string : undefined}
        itemCount={typeof d.itemCount === 'number' ? d.itemCount : undefined}
        crossTabLinks={Array.isArray(props.crossTabLinks) ? props.crossTabLinks as Array<{ targetTab: string; label: string }> : undefined}
        {...nav}
      />
    );
  },
  info_grid: (props, nav) => (
    <InfoGridInteractive
      items={Array.isArray(props.items) ? props.items as Array<{ key: string; value: string }> : []}
      mode={typeof props.mode === 'string' ? props.mode as 'key_value' | 'table' | 'tag_cloud' : undefined}
      {...nav}
    />
  ),
  gallery: (props, nav) => (
    <GalleryInteractive
      images={asArray(props.images)}
      layout={typeof props.layout === 'string' ? props.layout as 'grid' | 'carousel' | 'hero_stack' : undefined}
      onSeek={nav.onSeek}
      {...nav}
    />
  ),
  clip_player: (props, nav) => (
    <ClipPlayerInteractive
      clips={asArray(props.clips)}
      filters={typeof props.filters === 'boolean' ? props.filters : undefined}
      onSeek={nav.onSeek}
      {...nav}
    />
  ),
  lyrics_player: (props, nav) => (
    <LyricsPlayerInteractive
      sections={asArray(props.sections)}
      artist={typeof props.artist === 'string' ? props.artist : undefined}
      onSeek={nav.onSeek}
      {...nav}
    />
  ),

  // Fallback to DisplaySection
  display_section: (props) => (
    <DisplaySection data={props.data} />
  ),
};

/**
 * Composable output renderer.
 *
 * tabs path: Uses COMPONENT_REGISTRY to render by component name + pre-assembled props.
 * response path (v1 fallback): Routes tabs to interactive components via tab ID, resolving data from VIEResponse.
 */
export const ComposableOutput = memo(function ComposableOutput({
  response,
  tabs,
  activeTab,
  onNavigateTab,
  primaryTag,
}: ComposableOutputProps) {
  const { seekTo, currentTime } = useVideoPlayer();
  const [cookingMode, setCookingMode] = useState(false);

  // Detect cooking mode availability: food domain + has checklist + has step_player
  const cookingModeData = useMemo(() => {
    if (primaryTag !== 'food' || !tabs || tabs.length === 0) return null;
    const checklistTab = tabs.find(t => t.component === 'checklist');
    const stepTab = tabs.find(t => t.component === 'step_player');
    if (!checklistTab?.props || !stepTab?.props) return null;
    const ingredients = checklistTab.props.items as Array<{ label: string; note?: string; emoji?: string; amount?: number; displayAmount?: string; unit?: string; essential?: boolean; group?: string }> | undefined;
    const steps = stepTab.props.steps as StepItem[] | undefined;
    if (!ingredients || !steps) return null;
    return {
      ingredients,
      steps,
      tips: stepTab.props.tips as string[] | undefined,
      scalable: checklistTab.props.scalable as boolean | undefined,
      baseServings: checklistTab.props.baseServings as number | undefined,
      tabLabel: (checklistTab.props.tabLabel as string) ?? 'Ingredients',
    };
  }, [primaryTag, tabs]);

  // ─── Component-addressed rendering ───
  if (tabs && tabs.length > 0) {
    const tab = tabs.find((t: TabEntry) => t.id === activeTab) ?? tabs[0];
    if (!tab) return null;

    const renderer = COMPONENT_REGISTRY[tab.component];
    if (!renderer && tab.component && import.meta.env.DEV) {
      console.warn(`[ComposableOutput] Unknown component "${tab.component}" for tab "${tab.id}", falling back to DisplaySection`);
    }
    const crossLinks = tab.crossTabLinks ?? [];
    // Don't pass nextTab — ComposableOutput renders CrossTabLink after each tab.
    // Passing nextTab causes duplicate "Next" buttons inside Celebration components.
    const nav: NavProps = { onNavigateTab, onSeek: seekTo, tabId: tab.id, currentTime };

    return (
      <div className="flex flex-col gap-4">
        {/* Cooking mode toggle */}
        {cookingModeData && !cookingMode && (
          <button
            onClick={() => setCookingMode(true)}
            className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-primary/30 bg-primary/5 px-4 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
          >
            <span aria-hidden="true">{'🍳'}</span>
            Enter Cooking Mode
          </button>
        )}

        {/* Cooking mode player */}
        {cookingMode && cookingModeData ? (
          <RecipePlayer
            ingredients={cookingModeData.ingredients}
            steps={cookingModeData.steps}
            scalable={cookingModeData.scalable}
            baseServings={cookingModeData.baseServings}
            tabLabel={cookingModeData.tabLabel}
            onExit={() => setCookingMode(false)}
            onSeek={seekTo}
          />
        ) : (
          <>
            {tab.goal && <TabIntro goal={tab.goal} />}
            <ErrorBoundary fallback={<div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">Failed to render this tab. Try refreshing the page.</div>}>
              {renderer
                ? renderer(tab.props, nav)
                : <DisplaySection data={tab.props} />}
            </ErrorBoundary>

            {crossLinks.length > 0 && (
              <div className="flex flex-col gap-2 mt-2">
                {crossLinks.map((link) => {
                  const targetTabDef = tabs!.find((t: TabEntry) => t.id === link.targetTab);
                  return (
                    <CrossTabLink
                      key={link.targetTab}
                      tabId={link.targetTab}
                      label={link.label}
                      description={targetTabDef?.goal}
                      onNavigate={onNavigateTab}
                    />
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // ─── v1: Legacy VIEResponse-based rendering ───
  if (!response) return null;

  const activeTabDef = response.tabs.find((t) => t.id === activeTab);
  const tabIds = response.tabs.map((t) => t.id);
  const crossTabLinkMap = resolveCrossTabLinks(tabIds);
  const linksForTab = crossTabLinkMap[activeTab] ?? [];

  if (!activeTabDef) return null;

  const data = resolveTabData(response, activeTab, activeTabDef.dataSource);
  const isInteractive = INTERACTIVE_TABS.has(activeTab);
  const interactiveContent = isInteractive
    ? renderInteractive(activeTab, data, undefined, onNavigateTab)
    : null;

  return (
    <div className="flex flex-col gap-4">
      {interactiveContent ?? <DisplaySection data={data} />}

      {linksForTab.length > 0 && (
        <div className="flex flex-col gap-2 mt-2">
          {linksForTab.map((link) => (
            <CrossTabLink
              key={link.targetTab}
              tabId={link.targetTab}
              label={link.label}
              onNavigate={onNavigateTab}
            />
          ))}
        </div>
      )}
    </div>
  );
});
