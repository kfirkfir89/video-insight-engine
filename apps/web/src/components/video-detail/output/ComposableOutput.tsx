import { memo, useMemo, type ReactNode } from 'react';
import type { VIEResponse, ContentTag, TravelDay, SpotItem, FlashcardItem } from '@vie/types';
import { DisplaySection } from './DisplaySection';
import { CrossTabLink } from './CrossTabLink';
import { resolveCrossTabLinks } from './link-rules';
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
} from './interactive';

interface ComposableOutputProps {
  response: VIEResponse;
  activeTab: string;
  onNavigateTab: (tabId: string) => void;
}

/** Set of tab IDs that have interactive components. */
const INTERACTIVE_TABS = new Set([
  'ingredients', 'packing', 'materials', 'tools',
  'quizzes', 'flashcards', 'concepts', 'scenarios',
  'itinerary', 'budget', 'spots',
  'steps',
  'exercises', 'timer',
  'key_moments', 'timestamps',
  'code', 'cheat_sheet', 'setup', 'patterns',
  'pros_cons', 'specs',
]);

/**
 * Extract the correct data slice from VIEResponse for a given tab.
 */
function getTabData(response: VIEResponse, tabId: string, dataSource: string): unknown {
  const domainKey = dataSource.split('.')[0] as ContentTag;
  const domainData = response[domainKey as keyof VIEResponse] as unknown;
  if (domainData == null) return null;

  // If dataSource has a dot path like "learning.keyPoints", extract the nested field
  const parts = dataSource.split('.');
  if (parts.length > 1) {
    const field = parts[1];
    if (typeof domainData === 'object' && domainData !== null && field in (domainData as Record<string, unknown>)) {
      return (domainData as Record<string, unknown>)[field];
    }
  }

  // Special handling: enrichment data lives at the VIEResponse root
  if (tabId === 'quizzes') return response.quizzes;
  if (tabId === 'flashcards') return response.flashcards;
  if (tabId === 'scenarios') return response.scenarios;

  return domainData;
}

// ── Data normalizers ──

/**
 * Normalize heterogeneous checklist data (FoodIngredient, PackingItem, etc.)
 * to the { label, note?, emoji? } shape that ChecklistInteractive expects.
 */
function normalizeChecklistItems(data: unknown): Array<{ label: string; note?: string; emoji?: string }> {
  if (!Array.isArray(data)) return [];
  return data.map((item) => {
    if (typeof item === 'string') return { label: item };
    if (typeof item !== 'object' || item === null) return { label: String(item) };
    const obj = item as Record<string, unknown>;

    // FoodIngredient: { name, amount, displayAmount, unit, group, notes }
    if ('name' in obj && ('amount' in obj || 'unit' in obj || 'displayAmount' in obj)) {
      const parts: string[] = [];
      if (obj.displayAmount) parts.push(String(obj.displayAmount));
      else if (obj.amount != null && obj.amount !== 0) parts.push(String(obj.amount));
      if (obj.unit) parts.push(String(obj.unit));
      parts.push(String(obj.name));
      return {
        label: parts.join(' '),
        note: obj.notes ? String(obj.notes) : undefined,
      };
    }

    // PackingItem: { item, category, essential }
    if ('item' in obj) {
      return {
        label: String(obj.item),
        note: obj.category ? String(obj.category) : undefined,
        emoji: obj.essential ? '⚠️' : undefined,
      };
    }

    // Generic fallback: { name } or { label }
    if ('name' in obj) return { label: String(obj.name), note: obj.notes ? String(obj.notes) : undefined };
    if ('label' in obj) return { label: String(obj.label), note: obj.note ? String(obj.note) : undefined };
    return { label: JSON.stringify(item) };
  });
}

const CHECKLIST_TAB_LABELS: Record<string, string> = {
  ingredients: 'Ingredients',
  packing: 'Pack List',
  materials: 'Materials',
  tools: 'Tools',
};

/**
 * Normalize TravelDay[] into flat SpotItem[] with section groupings,
 * or pass through if data is already SpotItem[].
 */
function normalizeItineraryProps(data: unknown): { spots: SpotItem[]; sections?: Array<{ label: string; spotIndices: number[] }> } {
  if (!Array.isArray(data)) return { spots: [] };
  if (data.length === 0) return { spots: [] };

  // Check if data is TravelDay[] (has 'day' or 'city' or 'spots' fields)
  const first = data[0] as Record<string, unknown>;
  if (typeof first === 'object' && first !== null && ('day' in first || 'city' in first) && 'spots' in first) {
    const allSpots: SpotItem[] = [];
    const sections: Array<{ label: string; spotIndices: number[] }> = [];

    for (const day of data as TravelDay[]) {
      const dayLabel = day.city ? `Day ${day.day}: ${day.city}` : `Day ${day.day}`;
      const daySpots = Array.isArray(day.spots) ? day.spots : [];
      const startIndex = allSpots.length;
      const indices = daySpots.map((_, i) => startIndex + i);
      allSpots.push(...daySpots);
      sections.push({ label: dayLabel, spotIndices: indices });
    }

    return { spots: allSpots, sections };
  }

  // Already SpotItem[]
  return { spots: data as SpotItem[] };
}

/**
 * Normalize ConceptItem[] to FlashcardItem[] shape for FlashDeckInteractive.
 */
function normalizeFlashcards(data: unknown): unknown[] {
  if (!Array.isArray(data)) return [];
  return data.map((item) => {
    if (typeof item !== 'object' || item === null) return item;
    const obj = item as Record<string, unknown>;
    // ConceptItem { name, definition, emoji } → FlashcardItem { front, back, emoji }
    if ('name' in obj && 'definition' in obj && !('front' in obj)) {
      return { front: obj.name, back: obj.definition, emoji: obj.emoji };
    }
    return item;
  });
}

/**
 * Render the interactive component for a tab, mapping generic data to typed props.
 * Returns null if the tab has no interactive component.
 */
function renderInteractive(
  tabId: string,
  data: unknown,
  nextTab: string | undefined,
  onNavigateTab: (id: string) => void,
): ReactNode {
  const nav = { nextTab, onNavigateTab };
  const arr = Array.isArray(data) ? data : [];

  switch (tabId) {
    // Checklists — normalize various item shapes
    case 'ingredients':
    case 'packing':
    case 'materials':
    case 'tools':
      return <ChecklistInteractive items={normalizeChecklistItems(data)} tabLabel={CHECKLIST_TAB_LABELS[tabId] ?? tabId} {...nav} />;

    // Education
    case 'quizzes':
      return <QuizInteractive questions={arr} {...nav} />;
    case 'flashcards':
      return <FlashDeckInteractive cards={arr} {...nav} />;
    case 'concepts':
      return <FlashDeckInteractive cards={normalizeFlashcards(data) as FlashcardItem[]} {...nav} />;
    case 'scenarios':
      return <ScenarioInteractive scenarios={arr} {...nav} />;

    // Navigation / Spots — normalize TravelDay[] to flat spots
    case 'itinerary': {
      const { spots, sections } = normalizeItineraryProps(data);
      return <SpotExplorer spots={spots} sections={sections} {...nav} />;
    }
    case 'budget':
    case 'spots':
      return <SpotExplorer spots={arr} {...nav} />;

    // Steps
    case 'steps':
      return <StepByStepInteractive steps={arr} {...nav} />;

    // Fitness
    case 'exercises':
    case 'timer': {
      const obj = (typeof data === 'object' && data !== null && !Array.isArray(data)) ? data as Record<string, unknown> : {};
      const exercises = Array.isArray(obj.exercises) ? obj.exercises : arr;
      const warmup = Array.isArray(obj.warmup) ? obj.warmup : undefined;
      const cooldown = Array.isArray(obj.cooldown) ? obj.cooldown : undefined;
      return <ExerciseInteractive exercises={exercises} warmup={warmup} cooldown={cooldown} {...nav} />;
    }

    // Timeline
    case 'key_moments':
    case 'timestamps':
      return <TimelineExplorer entries={arr} {...nav} />;

    // Code
    case 'code':
    case 'cheat_sheet':
    case 'setup':
    case 'patterns':
      return <CodeExplorer snippets={arr} {...nav} />;

    // Comparison
    case 'pros_cons':
    case 'specs': {
      const obj = (typeof data === 'object' && data !== null && !Array.isArray(data)) ? data as Record<string, unknown> : {};
      const comparisons = Array.isArray(obj.comparisons) ? obj.comparisons : [];
      const pros = Array.isArray(obj.pros) ? obj.pros : undefined;
      const cons = Array.isArray(obj.cons) ? obj.cons : undefined;
      return <ComparisonInteractive comparisons={comparisons} pros={pros} cons={cons} {...nav} />;
    }

    default:
      return null;
  }
}

/**
 * Composable output renderer.
 * Routes tabs to interactive components or falls back to DisplaySection.
 */
export const ComposableOutput = memo(function ComposableOutput({
  response,
  activeTab,
  onNavigateTab,
}: ComposableOutputProps) {
  const activeTabDef = useMemo(
    () => response.tabs.find((t) => t.id === activeTab),
    [response.tabs, activeTab],
  );

  const tabIds = useMemo(() => response.tabs.map((t) => t.id), [response.tabs]);
  const crossTabLinkMap = useMemo(() => resolveCrossTabLinks(tabIds), [tabIds]);
  const linksForTab = crossTabLinkMap[activeTab] ?? [];

  if (!activeTabDef) return null;

  const data = getTabData(response, activeTab, activeTabDef.dataSource);
  const isInteractive = INTERACTIVE_TABS.has(activeTab);
  const interactiveContent = isInteractive
    ? renderInteractive(activeTab, data, linksForTab[0]?.targetTab, onNavigateTab)
    : null;

  return (
    <div className="flex flex-col gap-4">
      {interactiveContent ?? <DisplaySection data={data} tabId={activeTab} />}

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
