import { type ReactNode } from 'react';
import type { TravelDay, SpotItem, FlashcardItem } from '@vie/types';
import {
  ChecklistInteractive,
  FlashDeckInteractive,
  SpotExplorer,
  StepByStepInteractive,
  MomentTrack,
  type MomentItem,
  ComparisonInteractive,
  // Video-to-action overhaul: legacy tab-ids forward to the new components
  CodePlayground,
  QuizArena,
  WorkoutRoom,
  type QuizArenaQuestion,
} from './interactive';
import { formatTimestamp } from './display-type-guards';

/** Set of tab IDs that have interactive components (v1 fallback). */
export const INTERACTIVE_TABS = new Set([
  'ingredients', 'packing', 'materials', 'tools',
  'quizzes', 'flashcards', 'concepts', 'scenarios',
  'itinerary', 'spots',
  'steps',
  'exercises', 'timer',
  'key_moments', 'timestamps', 'highlights', 'moment_track',
  'code', 'cheat_sheet',
  'pros_cons',
  'verdict',
]);

function normalizeMomentItems(data: unknown): MomentItem[] {
  if (!Array.isArray(data)) return [];
  return data
    .filter((item): item is Record<string, unknown> => item != null && typeof item === 'object')
    .map((item, i) => {
      const secondsRaw = item.seconds ?? item.startSeconds ?? item.timestamp ?? 0;
      const endRaw = item.endSeconds ?? item.endTimestamp ?? item.end_time;
      const seconds = typeof secondsRaw === 'number' ? secondsRaw : parseInt(String(secondsRaw), 10) || 0;
      const endSeconds = endRaw != null ? (typeof endRaw === 'number' ? endRaw : parseInt(String(endRaw), 10)) : undefined;
      // Mirror the Python normalizer in services/summarizer/.../assemblers.py:
      // explicit label > description-derived (capped at 60 chars) > generic placeholder.
      // Without the cap, a multi-sentence description renders as the moment title.
      const explicitLabel = item.label ?? item.title ?? item.name;
      const description = typeof item.description === 'string' ? item.description : '';
      const descriptionFallback = description.length > 0
        ? description.slice(0, 60) + (description.length > 60 ? '…' : '')
        : null;
      const label = (typeof explicitLabel === 'string' && explicitLabel.length > 0)
        ? explicitLabel
        : descriptionFallback ?? `Moment ${i + 1}`;
      const rawTime = item.time;
      const time = typeof rawTime === 'string' && rawTime.length > 0 ? rawTime : formatTimestamp(seconds);
      return {
        ...(item as object),
        seconds,
        endSeconds: endSeconds != null && Number.isFinite(endSeconds) && endSeconds > seconds + 1 ? endSeconds : undefined,
        time,
        label,
      } as MomentItem;
    });
}

// ── Data normalizers ──

export function normalizeChecklistItems(data: unknown): Array<{ label: string; note?: string; emoji?: string }> {
  if (!Array.isArray(data)) return [];
  return data.map((item) => {
    if (typeof item === 'string') return { label: item };
    if (typeof item !== 'object' || item === null) return { label: String(item) };
    const obj = item as Record<string, unknown>;
    if ('name' in obj && ('amount' in obj || 'unit' in obj || 'displayAmount' in obj)) {
      const da = obj.displayAmount ? String(obj.displayAmount).trim() : '';
      if (da) return { label: `${da} ${String(obj.name)}`, note: obj.notes ? String(obj.notes) : undefined };
      const parts: string[] = [];
      if (obj.amount != null && obj.amount !== 0) parts.push(String(obj.amount));
      if (obj.unit) parts.push(String(obj.unit));
      parts.push(String(obj.name));
      return { label: parts.join(' '), note: obj.notes ? String(obj.notes) : undefined };
    }
    if ('item' in obj) return { label: String(obj.item), note: obj.category ? String(obj.category) : undefined, emoji: obj.essential ? '⚠️' : undefined };
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

function normalizeItineraryProps(data: unknown): { spots: SpotItem[]; sections?: Array<{ label: string; spotIndices: number[] }> } {
  if (!Array.isArray(data)) return { spots: [] };
  if (data.length === 0) return { spots: [] };
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
  return { spots: data as SpotItem[] };
}

function normalizeFlashcards(data: unknown): unknown[] {
  if (!Array.isArray(data)) return [];
  return data.map((item) => {
    if (typeof item !== 'object' || item === null) return item;
    const obj = item as Record<string, unknown>;
    if ('name' in obj && 'definition' in obj && !('front' in obj)) {
      return { front: obj.name, back: obj.definition, emoji: obj.emoji };
    }
    return item;
  });
}

interface NavProps {
  nextTab: string | undefined;
  onNavigateTab: (id: string) => void;
}

/**
 * v1 fallback: Render interactive component by tab ID, mapping generic data to typed props.
 */
export function renderInteractive(
  tabId: string,
  data: unknown,
  nextTab: string | undefined,
  onNavigateTab: (id: string) => void,
): ReactNode {
  const nav: NavProps = { nextTab, onNavigateTab };
  const arr = Array.isArray(data) ? data : [];

  switch (tabId) {
    case 'ingredients':
    case 'packing':
    case 'materials':
    case 'tools':
      return <ChecklistInteractive items={normalizeChecklistItems(data)} tabLabel={CHECKLIST_TAB_LABELS[tabId] ?? tabId} {...nav} />;
    case 'quizzes':
      return <QuizArena questions={arr as QuizArenaQuestion[]} {...nav} />;
    case 'flashcards':
      return <FlashDeckInteractive cards={arr} {...nav} />;
    case 'concepts':
      return <FlashDeckInteractive cards={normalizeFlashcards(data) as FlashcardItem[]} {...nav} />;
    case 'scenarios': {
      // Legacy `scenarios` tab → QuizArena absorbs scenarios via context+kind
      const scenarios = Array.isArray(arr) ? arr as Array<Record<string, unknown>> : [];
      const questions: QuizArenaQuestion[] = scenarios.map((s) => {
        const options = Array.isArray(s.options) ? s.options as Array<{ text: string; correct: boolean; explanation?: string }> : [];
        return {
          question: typeof s.question === 'string' ? s.question : '',
          options: options.map((o) => o.text || ''),
          correctIndex: Math.max(0, options.findIndex((o) => o.correct)),
          explanation: options.find((o) => o.correct)?.explanation,
          context: typeof s.context === 'string' ? s.context : undefined,
          kind: 'scenario' as const,
        };
      });
      return <QuizArena questions={questions} {...nav} />;
    }
    case 'itinerary': {
      const { spots, sections } = normalizeItineraryProps(data);
      return <SpotExplorer spots={spots} sections={sections} {...nav} />;
    }
    case 'spots':
      return <SpotExplorer spots={arr} {...nav} />;
    case 'steps':
      return <StepByStepInteractive steps={arr} {...nav} />;
    case 'exercises':
    case 'timer': {
      const obj = (typeof data === 'object' && data !== null && !Array.isArray(data)) ? data as Record<string, unknown> : {};
      const exercises = Array.isArray(obj.exercises) ? obj.exercises : arr;
      const warmup = Array.isArray(obj.warmup) ? obj.warmup : undefined;
      const cooldown = Array.isArray(obj.cooldown) ? obj.cooldown : undefined;
      return <WorkoutRoom exercises={exercises} warmup={warmup as never} cooldown={cooldown as never} />;
    }
    case 'key_moments':
    case 'timestamps':
    case 'highlights':
    case 'moment_track':
      return <MomentTrack items={normalizeMomentItems(data)} {...nav} />;
    case 'code':
    case 'cheat_sheet':
      return <CodePlayground snippets={arr as never} />;
    case 'pros_cons': {
      const obj = (typeof data === 'object' && data !== null && !Array.isArray(data)) ? data as Record<string, unknown> : {};
      const comparisons = Array.isArray(obj.comparisons) ? obj.comparisons : [];
      const pros = Array.isArray(obj.pros) ? obj.pros : undefined;
      const cons = Array.isArray(obj.cons) ? obj.cons : undefined;
      return <ComparisonInteractive comparisons={comparisons} pros={pros} cons={cons} {...nav} />;
    }
    case 'verdict': {
      if (typeof data !== 'object' || data === null || Array.isArray(data)) return null;
      const v = data as Record<string, unknown>;
      const bottomLine = typeof v.bottomLine === 'string' ? v.bottomLine : '';
      if (!bottomLine) return null;
      return (
        <ComparisonInteractive
          verdict={{
            badge: typeof v.badge === 'string' ? v.badge : undefined,
            bottomLine,
            bestFor: Array.isArray(v.bestFor) ? (v.bestFor as string[]) : undefined,
            notFor: Array.isArray(v.notFor) ? (v.notFor as string[]) : undefined,
            score: typeof v.score === 'number' ? v.score : undefined,
            maxScore: typeof v.maxScore === 'number' ? v.maxScore : undefined,
          }}
          {...nav}
        />
      );
    }
    default:
      return null;
  }
}
