import { memo, useState, useMemo, type ReactNode } from 'react';
import type { VIEResponse, SpotItem, FlashcardItem, TabEntry, TechSnippet, StepItem, FitnessExercise, QuizItem, ScenarioItem, ReviewComparison } from '@vie/types';
import { DisplaySection } from './DisplaySection';
import { CrossTabLink } from './CrossTabLink';
import { TabIntro } from './TabIntro';
import { resolveCrossTabLinks } from './link-rules';
import { resolveTabData } from '@/features/video-output/components/output/lib/tab-data-resolver';
import { INTERACTIVE_TABS, renderInteractive } from './ComposableOutputV1';
import { useVideoPlayer } from '@/features/video-output/contexts/VideoPlayerContext';
import { RecipePlayer } from './RecipePlayer';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { EmojiMarker } from '@/components/vie';
import { stripLeadingEmoji } from '@/lib/string-utils';
import {
  ChecklistInteractive,
  QuizInteractive,
  FlashDeckInteractive,
  ScenarioInteractive,
  SpotExplorer,
  StepByStepInteractive,
  ExerciseInteractive,
  MomentTrack,
  type MomentItem,
  CodeExplorer,
  ComparisonInteractive,
  VerdictInteractive,
  BudgetInteractive,
  OverviewInteractive,
  InfoGridInteractive,
  GalleryInteractive,
  LyricsPlayerInteractive,
} from './interactive';
import type { OverviewCrossTabLink } from './interactive/OverviewInteractive';

interface ComposableOutputProps {
  /** v1: VIEResponse with domain-keyed data (null when using assembled tabs). */
  response: VIEResponse | null;
  /** Pre-assembled tabs from backend (component-addressed). */
  tabs?: TabEntry[] | null;
  activeTab: string;
  onNavigateTab: (tabId: string) => void;
  /** Primary content tag (for cooking mode detection). */
  primaryTag?: string;
  /** Stable per-video id used for per-video local state (e.g. overview bookmarks). */
  videoSummaryId?: string;
}

// ─── Component Registry (v2: component name → renderer) ───

interface NavProps {
  nextTab?: string;
  onNavigateTab: (id: string) => void;
  onSeek?: (seconds: number) => void;
  tabId?: string;
  currentTime?: number;
  contentTag?: string;
  /** Full tab list — used by hub-style renderers (overview) to build sibling
   *  navigation. Optional so renderers that don't need it can ignore it. */
  allTabs?: TabEntry[];
  /** Stable per-video id — wired through for renderers that persist per-video
   *  local state (overview bookmarks). */
  videoId?: string;
  /** Pre-computed Overview cross-tab links, memoized at the parent so the
   *  reference is stable across `currentTime` ticks (would otherwise defeat
   *  `memo()` on OverviewInteractive). */
  derivedOverviewLinks?: OverviewCrossTabLink[];
}

/** Component name → the props key holding its primary item list. Used by the
 *  Overview nav grid to surface "how many things are inside this tab". Kept as
 *  a single source of truth next to the renderers so new components only need
 *  to register their count-prop here. */
const COUNT_PROP_BY_COMPONENT: Record<string, string> = {
  quiz: 'questions',
  flash_deck: 'cards',
  step_player: 'steps',
  checklist: 'items',
  info_grid: 'items',
  spot_explorer: 'spots',
  moment_track: 'items',
  timeline: 'items',
  clip_player: 'clips',
  code_explorer: 'snippets',
  exercise_tracker: 'exercises',
  scenario: 'scenarios',
  gallery: 'images',
  lyrics_player: 'sections',
  budget: 'breakdown',
};

/** Pull the most-meaningful item count out of an assembled tab's props.
 *  Returns undefined when the count is ambiguous — the nav card still renders
 *  without a number rather than guessing. */
function inferItemCount(tab: TabEntry): number | undefined {
  const props = tab.props ?? {};
  // Comparison has no single "items" list — it's pros + cons + rows together.
  if (tab.component === 'comparison') {
    const pros = Array.isArray(props.pros) ? props.pros.length : 0;
    const cons = Array.isArray(props.cons) ? props.cons.length : 0;
    const rows = Array.isArray(props.comparisons) ? props.comparisons.length : 0;
    const total = rows + pros + cons;
    return total > 0 ? total : undefined;
  }
  const key = COUNT_PROP_BY_COMPONENT[tab.component];
  if (!key) return undefined;
  const value = props[key];
  // moment_track / timeline historically also used `entries` — fall through
  // when `items` is missing so older assembler outputs still display a count.
  if (!Array.isArray(value) && (tab.component === 'moment_track' || tab.component === 'timeline')) {
    const entries = props.entries;
    return Array.isArray(entries) ? entries.length : undefined;
  }
  return Array.isArray(value) ? value.length : undefined;
}

/** Build the cross-tab nav grid shown inside the Overview tab. Sources sibling
 *  tabs from the assembled response, drops the overview itself, and annotates
 *  each entry with an emoji + best-effort item count. */
function buildOverviewCrossTabLinks(
  allTabs: TabEntry[] | undefined,
  activeTabId: string,
): OverviewCrossTabLink[] {
  if (!allTabs || allTabs.length === 0) return [];
  const siblings = allTabs.filter((t) => t.id !== activeTabId && t.component !== 'overview');
  return siblings.map((t) => ({
    targetTab: t.id,
    label: stripLeadingEmoji(t.label),
    emoji: t.emoji || undefined,
    count: inferItemCount(t),
  }));
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
  moment_track: (props, nav) => (
    <MomentTrack
      items={asArray(props.items)}
      filters={typeof props.filters === 'boolean' ? props.filters : undefined}
      onSeek={nav.onSeek}
      currentTime={nav.currentTime}
      {...nav}
    />
  ),
  // Legacy aliases — cached `assembledTabs` rows in MongoDB written before the
  // moment_track unification still reference these component names. Translate
  // their prop shapes into MomentTrack's items[] so they keep rendering as a
  // proper interactive instead of degrading to DisplaySection. Safe to remove
  // once the cache rolls over (currently keyed by youtubeId+promptVersion).
  timeline: (props, nav) => (
    <MomentTrack
      items={asArray<MomentItem>(props.entries)}
      onSeek={nav.onSeek}
      currentTime={nav.currentTime}
      {...nav}
    />
  ),
  clip_player: (props, nav) => {
    const items = asArray<Record<string, unknown>>(props.clips).map((clip) => {
      const seconds = typeof clip.seconds === 'number'
        ? clip.seconds
        : (typeof clip.startSeconds === 'number' ? clip.startSeconds : 0);
      return { ...clip, seconds } as MomentItem;
    });
    return (
      <MomentTrack
        items={items}
        filters={typeof props.filters === 'boolean' ? props.filters : undefined}
        onSeek={nav.onSeek}
        currentTime={nav.currentTime}
        {...nav}
      />
    );
  },
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
      leftLabel={typeof props.leftLabel === 'string' ? props.leftLabel : undefined}
      rightLabel={typeof props.rightLabel === 'string' ? props.rightLabel : undefined}
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
    // Overview props are nested inside props.data from the assembler.
    const d = (typeof props.data === 'object' && props.data !== null ? props.data : props) as Record<string, unknown>;
    const dur = typeof d.duration === 'number'
      ? `${Math.round(Number(d.duration) / 60)} min`
      : typeof d.duration === 'string' ? d.duration : undefined;
    // Sibling-tab nav grid is computed once at the parent (memoized on
    // `tabs` + `activeTab`) so `memo()` on OverviewInteractive holds across
    // `currentTime` ticks. We deliberately stop forwarding
    // title / subtitle / summary / masterSummary — they duplicate the page
    // hero above this tab.
    const derivedLinks = nav.derivedOverviewLinks ?? [];
    return (
      <OverviewInteractive
        tips={Array.isArray(d.tips) ? d.tips as string[] : undefined}
        keyTakeaways={Array.isArray(d.keyTakeaways) ? d.keyTakeaways as string[] : undefined}
        highlights={Array.isArray(d.highlights) ? d.highlights as Array<{ emoji: string; text: string }> : undefined}
        quote={typeof d.quote === 'string' ? d.quote : undefined}
        quoteAuthor={typeof d.quoteAuthor === 'string' ? d.quoteAuthor : undefined}
        duration={dur}
        level={typeof d.level === 'string' ? d.level : typeof d.difficulty === 'string' ? d.difficulty as string : undefined}
        crossTabLinks={derivedLinks.length > 0 ? derivedLinks : undefined}
        videoId={nav.videoId}
        onNavigateTab={nav.onNavigateTab}
      />
    );
  },
  info_grid: (props, nav) => (
    <InfoGridInteractive
      items={Array.isArray(props.items) ? props.items as Array<{ key: string; value: string }> : []}
      mode={typeof props.mode === 'string' ? props.mode as 'key_value' | 'table' | 'tag_cloud' : undefined}
      sections={Array.isArray(props.sections) ? props.sections as Array<{ label: string; indices: number[] }> : undefined}
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
  videoSummaryId,
}: ComposableOutputProps) {
  const { seekTo, currentTime } = useVideoPlayer();
  const [cookingMode, setCookingMode] = useState(false);

  // Memoize derived structures on `tabs` so per-tab filtering and the Overview
  // cross-tab nav don't allocate fresh arrays on every `currentTime` tick.
  // This is what makes `memo()` on individual tab renderers actually hold.
  const filteredCrossLinks = useMemo(() => {
    const map = new Map<string, NonNullable<TabEntry['crossTabLinks']>>();
    if (tabs) {
      for (const t of tabs) {
        map.set(t.id, (t.crossTabLinks ?? []).filter((l) => l.targetTab !== 'overview'));
      }
    }
    return map;
  }, [tabs]);

  const derivedOverviewLinks = useMemo(
    () => buildOverviewCrossTabLinks(tabs ?? undefined, activeTab),
    [tabs, activeTab],
  );

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
    // Pull pre-filtered crossLinks from the memoized map. The Overview tab is
    // filtered from the strip at the OutputRouter layer; legacy backend rules
    // can still target "overview" and the parent-level filter drops those.
    const crossLinks = filteredCrossLinks.get(tab.id) ?? [];
    // Don't pass nextTab — ComposableOutput renders CrossTabLink after each tab.
    // Passing nextTab causes duplicate "Next" buttons inside Celebration components.
    const nav: NavProps = {
      onNavigateTab,
      onSeek: seekTo,
      tabId: tab.id,
      currentTime,
      allTabs: tabs,
      videoId: videoSummaryId,
      derivedOverviewLinks,
    };

    return (
      <div className="flex flex-col gap-4">
        {/* Cooking mode toggle */}
        {cookingModeData && !cookingMode && (
          <button
            onClick={() => setCookingMode(true)}
            className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-primary/30 bg-primary/5 px-4 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
          >
            <EmojiMarker emoji="🍳" size="sm" animated={false} />
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
