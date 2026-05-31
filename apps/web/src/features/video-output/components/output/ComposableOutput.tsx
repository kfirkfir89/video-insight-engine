import { memo, useState, useMemo, lazy, Suspense, type ReactNode } from 'react';
import type { VIEResponse, SpotItem, FlashcardItem, TabEntry, TabAttachment, TechSnippet, StepItem, FitnessExercise, ReviewComparison, FilmstripFrame, PackingMissionItem, QuizArenaQuestion, ConceptItem, LyricsKaraokeSection, StatBannerStat, DiagramCardItem, ConnectPair, ClaimItem, TierListItem, FormationPosition } from '@vie/types';
import { DisplaySection } from './DisplaySection';
import { CrossTabLink } from './CrossTabLink';
import { TabIntro } from './TabIntro';
import { resolveCrossTabLinks } from './link-rules';
import { resolveTabData } from '@/features/video-output/components/output/lib/tab-data-resolver';
import { INTERACTIVE_TABS, renderInteractive } from './ComposableOutputV1';
import { useVideoPlayer } from '@/features/video-output/contexts/VideoPlayerContext';
import { FlowPlayer } from './FlowPlayer';
import { detectFlowMode } from './flow-modes';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { EmojiMarker } from '@/components/vie';
import { stripLeadingEmoji } from '@/lib/string-utils';
import {
  ChecklistInteractive,
  FlashDeckInteractive,
  SpotExplorer,
  StepByStepInteractive,
  MomentTrack,
  ComparisonInteractive,
  BudgetInteractive,
  OverviewInteractive,
  InfoGridInteractive,
  // Video-to-action overhaul: legacy keys now forward to these new components
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
} from './interactive';

// Heavy canvas + radar components — code-split via React.lazy so they only
// load when a tab actually uses them.
const ConceptCanvas = lazy(() =>
  import('./interactive/ConceptCanvas').then((m) => ({ default: m.ConceptCanvas })),
);
const StepFlowCanvas = lazy(() =>
  import('./interactive/StepFlowCanvas').then((m) => ({ default: m.StepFlowCanvas })),
);
const ConnectCanvas = lazy(() =>
  import('./interactive/ConnectCanvas').then((m) => ({ default: m.ConnectCanvas })),
);
const DiagramCard = lazy(() =>
  import('./interactive/DiagramCard').then((m) => ({ default: m.DiagramCard })),
);
// FormationDiagram uses ReactFlow (heavy) — code-split like the other canvases.
const FormationDiagram = lazy(() =>
  import('./interactive/FormationDiagram').then((m) => ({ default: m.FormationDiagram })),
);

function CanvasFallback() {
  return (
    <div
      className="flex items-center justify-center py-12 text-sm text-muted-foreground"
      role="status"
      aria-live="polite"
    >
      <span className="animate-pulse">Loading canvas…</span>
    </div>
  );
}
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

// Strip an assembler-produced count prefix ("10 Ingredients" → "Ingredients").
// The lookahead `(?=\p{L})` keeps numeric content like "1.5 cups" or
// "5-Star Recipe" intact — we only drop the leading digits when the next
// non-whitespace char is a letter in any script. Returns the original label
// unchanged when no prefix is found, so callers can fall back to a default.
function stripCountPrefix(label: string): string {
  return label.replace(/^\d+\s+(?=\p{L})/u, '');
}

// ─── Component Registry (v2: component name → renderer) ───

interface NavProps {
  nextTab?: string;
  onNavigateTab: (id: string) => void;
  onSeek?: (seconds: number) => void;
  tabId?: string;
  /** Current tab's display label (e.g. "10 Ingredients") with count prefix
   *  intact. Renderers that want a section-heading version strip the prefix
   *  themselves. Sourced from the translated `tab.label`. */
  tabLabel?: string;
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
  // Current (post video-to-action overhaul) component set. Retired keys
  // (quiz, timeline, clip_player, code_explorer, exercise_tracker, scenario,
  // gallery, lyrics_player) were dropped in interactive-overhaul-v2 1D.
  flash_deck: 'cards',
  step_player: 'steps',
  step_flow_canvas: 'steps',
  checklist: 'items',
  info_grid: 'items',
  spot_explorer: 'spots',
  moment_track: 'items',
  budget: 'breakdown',
  // Overhaul components
  code_playground: 'snippets',
  quiz_arena: 'questions',
  packing_mission: 'items',
  workout_room: 'exercises',
  video_filmstrip: 'frames',
  concept_canvas: 'concepts',
  connect_canvas: 'pairs',
  comparison_radar: 'comparisons',
  lyrics_karaoke: 'sections',
  claims_tracker: 'claims',
  tier_list: 'items',
  formation_diagram: 'positions',
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
  // moment_track historically also used `entries` — fall through when `items`
  // is missing so assembler outputs that used the older shape still show a count.
  if (!Array.isArray(value) && tab.component === 'moment_track') {
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

/** Loose array cast — returns items that are non-null objects. Does NOT validate individual item shape. */
function asArray<T>(val: unknown): T[] {
  if (!Array.isArray(val)) return [];
  return val.filter((item): item is T => item != null && typeof item === 'object') as T[];
}

interface VerdictHeader {
  badge?: string;
  bottomLine?: string;
  bestFor?: string[];
  notFor?: string[];
  score?: number;
  maxScore?: number;
  subScores?: Array<{ category: string; score: number }>;
}

/** Coerce a loose props object into the verdict header shape ComparisonInteractive
 *  expects. Returns undefined when no bottomLine is provided so the header stays
 *  hidden. Filters subScores to entries with a valid `category` string and
 *  numeric `score`. */
function coerceVerdictHeader(props: Record<string, unknown>): VerdictHeader | undefined {
  const bottomLine = typeof props.bottomLine === 'string' ? props.bottomLine : undefined;
  if (!bottomLine) return undefined;
  const subScoresRaw = Array.isArray(props.subScores) ? props.subScores : [];
  const subScores = subScoresRaw
    .map((s): { category: string; score: number } | null => {
      if (s == null || typeof s !== 'object') return null;
      const obj = s as Record<string, unknown>;
      const category = typeof obj.category === 'string' ? obj.category : null;
      const score = typeof obj.score === 'number' ? obj.score : null;
      return category != null && score != null ? { category, score } : null;
    })
    .filter((s): s is { category: string; score: number } => s !== null);
  return {
    bottomLine,
    badge: typeof props.badge === 'string' ? props.badge : undefined,
    bestFor: Array.isArray(props.bestFor) ? (props.bestFor as string[]) : undefined,
    notFor: Array.isArray(props.notFor) ? (props.notFor as string[]) : undefined,
    score: typeof props.score === 'number' ? props.score : undefined,
    maxScore: typeof props.maxScore === 'number' ? props.maxScore : undefined,
    subScores: subScores.length > 0 ? subScores : undefined,
  };
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
  comparison: (props, nav) => {
    const verdictRaw = typeof props.verdict === 'object' && props.verdict !== null
      ? coerceVerdictHeader(props.verdict as Record<string, unknown>)
      : undefined;
    return (
      <ComparisonInteractive
        comparisons={asArray<ReviewComparison>(props.comparisons)}
        pros={Array.isArray(props.pros) ? props.pros as string[] : undefined}
        cons={Array.isArray(props.cons) ? props.cons as string[] : undefined}
        type={typeof props.type === 'string' ? props.type as 'table' | 'pros_cons' | 'versus' : undefined}
        leftLabel={typeof props.leftLabel === 'string' ? props.leftLabel : undefined}
        rightLabel={typeof props.rightLabel === 'string' ? props.rightLabel : undefined}
        verdict={verdictRaw}
        {...nav}
      />
    );
  },
  checklist: (props, nav) => (
    <ChecklistInteractive
      items={Array.isArray(props.items) ? props.items as Array<{ label: string; note?: string; emoji?: string }> : []}
      tabLabel={stripCountPrefix(nav.tabLabel ?? '') || 'Items'}
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
  flash_deck: (props, nav) => (
    <FlashDeckInteractive
      cards={asArray<FlashcardItem>(props.cards)}
      shuffleable={typeof props.shuffleable === 'boolean' ? props.shuffleable : undefined}
      tabId={nav.tabId}
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
  // ─── Video-to-action overhaul: 2026-05-28 ───
  // Legacy keys (code_explorer, exercise_tracker, lyrics_player, scenario,
  // gallery, verdict, quiz) were retired in 2026-05-29 cleanup. Cached
  // assembledTabs rows with those keys now fall through to display_section.
  // The new keys below are the only valid component names going forward —
  // every category renders the new component directly.
  // freshly-planned tabs.

  video_filmstrip: (props, nav) => (
    <VideoFilmstrip
      frames={asArray<FilmstripFrame>(props.frames)}
      onSeek={nav.onSeek}
      currentTime={nav.currentTime}
      mode={typeof props.mode === 'string' ? props.mode as 'tab' | 'overlay' : 'tab'}
    />
  ),

  code_playground: (props, nav) => {
    void nav;
    return <CodePlayground snippets={asArray<TechSnippet>(props.snippets)} onSeek={nav.onSeek} />;
  },

  quiz_arena: (props, nav) => (
    <QuizArena
      questions={asArray<QuizArenaQuestion>(props.questions)}
      tabId={nav.tabId}
      videoId={nav.videoId}
      nextTab={nav.nextTab}
      onNavigateTab={nav.onNavigateTab}
    />
  ),

  packing_mission: (props, nav) => (
    <PackingMission
      items={asArray<PackingMissionItem>(props.items)}
      videoId={nav.videoId}
      tabId={nav.tabId}
      nextTab={nav.nextTab}
      onNavigateTab={nav.onNavigateTab}
    />
  ),

  workout_room: (props, nav) => (
    <WorkoutRoom
      exercises={asArray<FitnessExercise>(props.exercises)}
      warmup={Array.isArray(props.warmup) ? asArray<FitnessExercise>(props.warmup) : undefined}
      cooldown={Array.isArray(props.cooldown) ? asArray<FitnessExercise>(props.cooldown) : undefined}
      onSeek={nav.onSeek}
    />
  ),

  lyrics_karaoke: (props, nav) => (
    <LyricsKaraoke
      sections={asArray<LyricsKaraokeSection>(props.sections)}
      artist={typeof props.artist === 'string' ? props.artist : undefined}
      onSeek={nav.onSeek}
      currentTime={nav.currentTime}
    />
  ),

  // ─── News signature component (interactive-overhaul-v2 P5b) ───
  claims_tracker: (props, nav) => (
    <ClaimsTracker claims={asArray<ClaimItem>(props.claims)} onSeek={nav.onSeek} />
  ),

  // ─── Gaming signature component (interactive-overhaul-v2 P5c) ───
  tier_list: (props, nav) => (
    <TierList
      items={asArray<TierListItem>(props.items)}
      videoId={nav.videoId}
      tabId={nav.tabId}
    />
  ),

  // ─── Sport signature component (interactive-overhaul-v2 P5d) ───
  // Read-only ReactFlow pitch — lazy-loaded like the other canvases.
  formation_diagram: (props) => (
    <Suspense fallback={<CanvasFallback />}>
      <FormationDiagram
        positions={asArray<FormationPosition>(props.positions)}
        name={typeof props.name === 'string' ? props.name : undefined}
        team={typeof props.team === 'string' ? props.team : undefined}
      />
    </Suspense>
  ),

  // Code-split via React.lazy — each canvas/radar lazy chunk only loads when
  // its tab is opened. Wrap in <Suspense> so the loading flash is contained.
  concept_canvas: (props, nav) => (
    <Suspense fallback={<CanvasFallback />}>
      <ConceptCanvas
        concepts={asArray<ConceptItem>(props.concepts)}
        onSeek={nav.onSeek}
        videoId={nav.videoId}
        nextTab={nav.nextTab}
        onNavigateTab={nav.onNavigateTab}
      />
    </Suspense>
  ),

  step_flow_canvas: (props, nav) => (
    <Suspense fallback={<CanvasFallback />}>
      <StepFlowCanvas
        steps={asArray<StepItem>(props.steps)}
        onSeek={nav.onSeek}
        tabId={nav.tabId}
      />
    </Suspense>
  ),

  connect_canvas: (props, nav) => (
    <Suspense fallback={<CanvasFallback />}>
      <ConnectCanvas
        pairs={asArray<ConnectPair>(props.pairs)}
        videoId={nav.videoId}
        tabId={nav.tabId}
        nextTab={nav.nextTab}
        onNavigateTab={nav.onNavigateTab}
      />
    </Suspense>
  ),

  // comparison_radar is an alias for the unified ComparisonInteractive with the
  // radar hero forced on (view="radar"). The 1A promotion comparison→comparison_radar
  // now just sets the radar view; ComparisonRadar.tsx was merged + deleted in P3C.
  comparison_radar: (props, nav) => {
    const verdictRaw = typeof props.verdict === 'object' && props.verdict !== null
      ? coerceVerdictHeader(props.verdict as Record<string, unknown>)
      : undefined;
    return (
      <ComparisonInteractive
        comparisons={asArray<ReviewComparison>(props.comparisons)}
        pros={Array.isArray(props.pros) ? props.pros as string[] : undefined}
        cons={Array.isArray(props.cons) ? props.cons as string[] : undefined}
        leftLabel={typeof props.leftLabel === 'string' ? props.leftLabel : undefined}
        rightLabel={typeof props.rightLabel === 'string' ? props.rightLabel : undefined}
        verdict={verdictRaw}
        view="radar"
        {...nav}
      />
    );
  },

  // ─── Secondary-tier components (interactive-overhaul-v2 P2) ───
  // Attachment-only: rendered by <TabAttachments> around a primary, never as a
  // standalone tab. Registered here so REGISTERED_COMPONENT_NAMES includes them
  // and the parity test stays green.
  stat_banner: (props) => (
    <StatBanner stats={asArray<StatBannerStat>(props.stats)} />
  ),

  tip_callout: (props) => (
    <TipCallout
      text={typeof props.text === 'string' ? props.text : ''}
      style={props.style === 'warning' || props.style === 'note' ? props.style : 'tip'}
      title={typeof props.title === 'string' ? props.title : undefined}
    />
  ),

  summary_header: (props) => (
    <SummaryHeader
      summary={typeof props.summary === 'string' ? props.summary : ''}
      title={typeof props.title === 'string' ? props.title : undefined}
      emoji={typeof props.emoji === 'string' ? props.emoji : undefined}
    />
  ),

  diagram_card: (props) => (
    <Suspense fallback={<CanvasFallback />}>
      <DiagramCard
        nodes={asArray<DiagramCardItem>(props.nodes)}
        edges={Array.isArray(props.edges) ? (props.edges as Array<{ source: number; target: number }>) : undefined}
        caption={typeof props.caption === 'string' ? props.caption : undefined}
      />
    </Suspense>
  ),

  // frame_strip = VideoFilmstrip in compact overlay mode (reuses primary renderer).
  frame_strip: (props, nav) => (
    <VideoFilmstrip
      frames={asArray<FilmstripFrame>(props.frames)}
      onSeek={nav.onSeek}
      currentTime={nav.currentTime}
      mode="overlay"
    />
  ),

  // quick_quiz = single-question QuizArena (reuses primary renderer).
  quick_quiz: (props, nav) => (
    <QuizArena
      questions={asArray<QuizArenaQuestion>(props.questions)}
      tabId={nav.tabId}
      videoId={nav.videoId}
      onNavigateTab={nav.onNavigateTab}
    />
  ),

  // Fallback to DisplaySection
  display_section: (props) => (
    <DisplaySection data={props.data} />
  ),
};

/** Component names with a registered renderer. Exported for the contract-parity
 *  test (interactive-overhaul-v2 1F), which fails the build if a component the
 *  backend can emit has no frontend renderer (would silently fall to
 *  DisplaySection). */
export const REGISTERED_COMPONENT_NAMES: ReadonlySet<string> = new Set(
  Object.keys(COMPONENT_REGISTRY),
);

interface TabAttachmentsProps {
  attachments: TabAttachment[] | undefined;
  slot: 'top' | 'bottom';
  nav: NavProps;
}

/** Render the secondary-tier attachments for one slot of a tab. Each attachment
 *  is routed through COMPONENT_REGISTRY (secondaries are registered there) and
 *  wrapped in its own ErrorBoundary so a broken attachment can't take down the
 *  primary interactive. Renders nothing when there are no attachments for the
 *  slot — keeping flat tabs byte-for-byte unchanged. */
function TabAttachments({ attachments, slot, nav }: TabAttachmentsProps) {
  if (!attachments || attachments.length === 0) return null;
  const forSlot = attachments.filter((a) => a.slot === slot && COMPONENT_REGISTRY[a.component]);
  if (forSlot.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      {forSlot.map((attachment, i) => {
        const renderer = COMPONENT_REGISTRY[attachment.component];
        return (
          <ErrorBoundary
            key={`${slot}-${attachment.component}-${i}`}
            fallback={null}
          >
            {renderer(attachment.props ?? {}, nav)}
          </ErrorBoundary>
        );
      })}
    </div>
  );
}

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
  const [flowModeActive, setFlowModeActive] = useState(false);

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

  // Detect the applicable enter-mode (cooking, workout, build, study, explore,
  // practice). Returns null — and shows no enter-mode button — when the
  // domain's required tabs/props aren't present. Cooking is migrated verbatim:
  // the resolved cooking mode produces the same ingredients context + steps
  // sequence the old hardcoded `cookingModeData` did.
  const flowMode = useMemo(
    () => detectFlowMode(tabs, primaryTag),
    [tabs, primaryTag],
  );

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
      tabLabel: tab.label,
      currentTime,
      allTabs: tabs,
      videoId: videoSummaryId,
      derivedOverviewLinks,
    };

    return (
      <div className="flex flex-col gap-4">
        {/* Enter-mode toggle (cooking, workout, build, study, explore, practice) */}
        {flowMode && !flowModeActive && (
          <button
            onClick={() => setFlowModeActive(true)}
            className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-primary/30 bg-primary/5 px-4 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
          >
            <EmojiMarker emoji={flowMode.emoji} size="sm" animated={false} />
            Enter {flowMode.label}
          </button>
        )}

        {/* Enter-mode player */}
        {flowModeActive && flowMode ? (
          <FlowPlayer
            emoji={flowMode.emoji}
            modeLabel={flowMode.label}
            stepNoun={flowMode.stepNoun}
            contextLabel={flowMode.contextLabel}
            contextCount={flowMode.contextCount}
            renderContext={flowMode.renderContext}
            sequenceLength={flowMode.sequenceLength}
            renderStep={(args) => flowMode.renderStep(args, seekTo)}
            completionMessage={flowMode.completionMessage}
            onExit={() => setFlowModeActive(false)}
          />
        ) : (
          <>
            {tab.goal && <TabIntro goal={tab.goal} />}
            <TabAttachments attachments={tab.attachments} slot="top" nav={nav} />
            <ErrorBoundary fallback={<div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">Failed to render this tab. Try refreshing the page.</div>}>
              {renderer
                ? renderer(tab.props, nav)
                : <DisplaySection data={tab.props} />}
            </ErrorBoundary>
            <TabAttachments attachments={tab.attachments} slot="bottom" nav={nav} />

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
