import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Luggage, Plus, X, AlertTriangle } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { GlassCard, FadeIn, Badge, TextBlock } from '@/components/vie';
import { Celebration } from '../Celebration';

export interface PackingItem {
  item: string;
  category?: string;
  essential?: boolean;
  weight?: number;
  emoji?: string;
}

interface PackingMissionProps {
  items: PackingItem[];
  videoId?: string;
  tabId?: string;
  nextTab?: string;
  onNavigateTab?: (id: string) => void;
}

const ALL_CATEGORIES = '__all__';
const SUITCASE_DROPPABLE_ID = 'packing-mission-suitcase';

function storageKey(videoId: string | undefined): string | null {
  return videoId ? `vie:packing:${videoId}` : null;
}

function loadPackedFromStorage(videoId: string | undefined): Set<number> | null {
  const key = storageKey(videoId);
  if (!key) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    const numeric = parsed.filter((n): n is number => typeof n === 'number');
    return new Set(numeric);
  } catch {
    return null;
  }
}

function persistPackedToStorage(videoId: string | undefined, packed: Set<number>): void {
  const key = storageKey(videoId);
  if (!key) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(Array.from(packed)));
  } catch {
    // Silent: storage may be unavailable (private mode, quota).
  }
}

function formatWeight(kg: number): string {
  return `${kg.toFixed(1)} kg`;
}

interface DraggableRowProps {
  index: number;
  item: PackingItem;
  onPack: (index: number) => void;
}

function DraggableRow({ index, item, onPack }: DraggableRowProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `packing-item-${index}`,
    data: { index },
  });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  return (
    <li>
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          'group flex items-center gap-2 rounded-lg border border-border/40 bg-card/60 px-3 py-2',
          'transition-shadow',
          isDragging && 'opacity-50 shadow-lg',
        )}
      >
        <button
          type="button"
          {...listeners}
          {...attributes}
          aria-label={`Drag ${item.item}`}
          className="touch-none text-muted-foreground/60 hover:text-foreground cursor-grab active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4" aria-hidden="true" />
        </button>

        <div className="flex-1 min-w-0">
          {/* Name owns its own line and wraps up to 2 lines — it's the thing the
              user is recognizing, so it never gets truncated to a few glyphs. */}
          <div className="flex items-start gap-1.5">
            {item.emoji && (
              <span aria-hidden="true" className="text-base leading-snug">
                {item.emoji}
              </span>
            )}
            <span className="text-sm font-medium leading-snug line-clamp-2">{item.item}</span>
          </div>
          {(item.essential || item.category || typeof item.weight === 'number') && (
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
              {item.essential && (
                <Badge variant="warning" className="text-[10px]">
                  essential
                </Badge>
              )}
              {item.category && <span className="capitalize">{item.category}</span>}
              {typeof item.weight === 'number' && (
                <span className="tabular-nums">{formatWeight(item.weight)}</span>
              )}
            </div>
          )}
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onPack(index)}
          aria-label={`Pack ${item.item}`}
          className="gap-1 text-xs"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          Pack
        </Button>
      </div>
    </li>
  );
}

interface SuitcaseProps {
  packedIndices: number[];
  items: PackingItem[];
  totalWeight: number;
  onUnpack: (index: number) => void;
}

function Suitcase({ packedIndices, items, totalWeight, onUnpack }: SuitcaseProps) {
  const { setNodeRef, isOver } = useDroppable({ id: SUITCASE_DROPPABLE_ID });

  return (
    <GlassCard
      variant="default"
      className={cn(
        'min-h-[200px] transition-colors',
        isOver && 'ring-2 ring-[var(--vie-accent)]/40',
      )}
    >
      <div ref={setNodeRef} className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <Luggage className="h-3.5 w-3.5" aria-hidden="true" />
            Suitcase
          </h4>
          <span className="text-xs tabular-nums text-muted-foreground">
            {packedIndices.length} packed
            {totalWeight > 0 && (
              <>
                {' '}
                · <span className="font-medium">{formatWeight(totalWeight)}</span>
              </>
            )}
          </span>
        </div>

        {packedIndices.length === 0 ? (
          <p className="text-xs text-muted-foreground/70 text-center py-6">
            Drag items here or tap Pack to add them.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-1.5" role="list">
            {packedIndices.map((index) => {
              const item = items[index];
              if (!item) return null;
              return (
                <li key={index}>
                  <button
                    type="button"
                    onClick={() => onUnpack(index)}
                    aria-label={`Unpack ${item.item}`}
                    className={cn(
                      'group inline-flex items-center gap-1 rounded-full',
                      'bg-[var(--vie-accent)]/10 px-2.5 py-1 text-xs font-medium text-[var(--vie-accent)]',
                      'transition-colors hover:bg-destructive/10 hover:text-destructive',
                    )}
                  >
                    {item.emoji && (
                      <span aria-hidden="true">{item.emoji}</span>
                    )}
                    <span>{item.item}</span>
                    <X
                      className="h-3 w-3 opacity-50 group-hover:opacity-100"
                      aria-hidden="true"
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </GlassCard>
  );
}

export const PackingMission = memo(function PackingMission({
  items,
  videoId,
  tabId: _tabId,
  nextTab,
  onNavigateTab,
}: PackingMissionProps) {
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor));
  const [packed, setPacked] = useState<Set<number>>(() => {
    const restored = loadPackedFromStorage(videoId);
    if (!restored) return new Set();
    // Clamp to valid indices in case items list changed.
    return new Set(Array.from(restored).filter((i) => i >= 0 && i < items.length));
  });
  const [categoryFilter, setCategoryFilter] = useState<string>(ALL_CATEGORIES);

  // Re-seed packed state when the video/item-count identity changes so a reused
  // component instance can't persist one video's progress under another's key.
  const packedKey = `${videoId ?? ''}:${items.length}`;
  const [prevPackedKey, setPrevPackedKey] = useState(packedKey);
  if (packedKey !== prevPackedKey) {
    setPrevPackedKey(packedKey);
    const restored = loadPackedFromStorage(videoId);
    setPacked(
      restored
        ? new Set(Array.from(restored).filter((i) => i >= 0 && i < items.length))
        : new Set(),
    );
  }

  useEffect(() => {
    persistPackedToStorage(videoId, packed);
  }, [videoId, packed]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const it of items) {
      if (it.category) set.add(it.category);
    }
    return Array.from(set);
  }, [items]);

  const pack = useCallback((index: number) => {
    setPacked((prev) => {
      if (prev.has(index)) return prev;
      const next = new Set(prev);
      next.add(index);
      return next;
    });
  }, []);

  const unpack = useCallback((index: number) => {
    setPacked((prev) => {
      if (!prev.has(index)) return prev;
      const next = new Set(prev);
      next.delete(index);
      return next;
    });
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (event.over?.id !== SUITCASE_DROPPABLE_ID) return;
      const dataIndex = event.active.data.current?.index;
      if (typeof dataIndex === 'number') pack(dataIndex);
    },
    [pack],
  );

  const remainingIndices = useMemo(
    () =>
      items
        .map((_, i) => i)
        .filter((i) => !packed.has(i))
        .filter((i) => {
          if (categoryFilter === ALL_CATEGORIES) return true;
          return items[i].category === categoryFilter;
        }),
    [items, packed, categoryFilter],
  );

  const packedIndices = useMemo(
    () => items.map((_, i) => i).filter((i) => packed.has(i)),
    [items, packed],
  );

  const totalWeight = useMemo(
    () =>
      packedIndices.reduce((sum, i) => {
        const w = items[i]?.weight;
        return sum + (typeof w === 'number' ? w : 0);
      }, 0),
    [packedIndices, items],
  );

  const allPacked = items.length > 0 && packed.size === items.length;

  // Essentials-missing warning: surfaces when the user has packed at least 80%
  // of items OR finished all non-essentials, but still has essentials waiting.
  const { essentialsMissing, showEssentialWarning } = useMemo(() => {
    const missing = items
      .map((it, i) => ({ ...it, _idx: i }))
      .filter((it) => it.essential && !packed.has(it._idx));
    if (missing.length === 0) {
      return { essentialsMissing: missing, showEssentialWarning: false };
    }
    const eightyPercentPacked = packed.size >= Math.ceil(items.length * 0.8);
    const allNonEssentialsPacked = items.every(
      (it, i) => it.essential || packed.has(i),
    );
    return {
      essentialsMissing: missing,
      showEssentialWarning: eightyPercentPacked || allNonEssentialsPacked,
    };
  }, [items, packed]);

  if (items.length === 0) return null;

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="space-y-4">
        {/* Header row with progress + filter */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground tabular-nums">
              {packed.size}
            </span>
            <span> / </span>
            <span className="tabular-nums">{items.length}</span>
            <span> packed</span>
          </div>

          {categories.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              <button
                type="button"
                onClick={() => setCategoryFilter(ALL_CATEGORIES)}
                className={cn(
                  'rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors',
                  categoryFilter === ALL_CATEGORIES
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/40 text-muted-foreground hover:text-foreground',
                )}
              >
                All
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(cat)}
                  className={cn(
                    'rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors capitalize',
                    categoryFilter === cat
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/40 text-muted-foreground hover:text-foreground',
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </div>

        {showEssentialWarning && (
          <TextBlock
            intent="warning"
            icon={<AlertTriangle aria-hidden="true" />}
          >
            Don&rsquo;t forget your essentials:{' '}
            <span className="font-medium text-foreground">
              {essentialsMissing.map((it) => it.item).join(', ')}
            </span>
          </TextBlock>
        )}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {/* Left: remaining list */}
          <GlassCard variant="outlined" className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              To pack ({remainingIndices.length})
            </h4>
            {remainingIndices.length === 0 ? (
              <p className="text-xs text-muted-foreground/70 text-center py-6">
                Nothing left in this view.
              </p>
            ) : (
              <ul className="space-y-1.5" role="list">
                {remainingIndices.map((idx, fadeIdx) => {
                  const item = items[idx];
                  if (!item) return null;
                  return (
                    <FadeIn key={idx} index={fadeIdx}>
                      <DraggableRow index={idx} item={item} onPack={pack} />
                    </FadeIn>
                  );
                })}
              </ul>
            )}
          </GlassCard>

          {/* Right: suitcase */}
          <Suitcase
            packedIndices={packedIndices}
            items={items}
            totalWeight={totalWeight}
            onUnpack={unpack}
          />
        </div>

        {allPacked && (
          <Celebration
            emoji="🧳"
            title="Bag&rsquo;s packed!"
            subtitle={`You stowed all ${items.length} items.`}
            nextTabId={nextTab}
            nextLabel={nextTab ? 'Continue' : undefined}
            onNavigateTab={onNavigateTab}
          />
        )}
      </div>
    </DndContext>
  );
});
