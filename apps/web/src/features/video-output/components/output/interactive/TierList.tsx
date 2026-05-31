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
import { GripVertical, RotateCcw } from 'lucide-react';
import type { TierListItem, TierRank } from '@vie/types';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/vie';

interface TierListProps {
  items: TierListItem[];
  videoId?: string;
  tabId?: string;
}

/** Ordered tiers plus the "unranked" bench where unplaced items wait. */
const TIERS: TierRank[] = ['S', 'A', 'B', 'C', 'D'];
const UNRANKED = '__unranked__';
type Slot = TierRank | typeof UNRANKED;

/** Per-tier accent token — top tiers warmer, lower tiers cooler/muted. */
const TIER_ACCENT: Record<TierRank, string> = {
  S: 'var(--vie-coral)',
  A: 'var(--vie-honey)',
  B: 'var(--vie-mint)',
  C: 'var(--vie-sky)',
  D: 'var(--vie-plum)',
};

function storageKey(videoId: string | undefined, tabId: string | undefined): string | null {
  if (!videoId) return null;
  return `vie:tier-list:${videoId}:${tabId ?? 'default'}`;
}

/** Initial placement: the creator's suggested tier, else the unranked bench. */
function initialPlacement(items: TierListItem[]): Record<number, Slot> {
  const placement: Record<number, Slot> = {};
  items.forEach((item, index) => {
    placement[index] = item.tier ?? UNRANKED;
  });
  return placement;
}

function loadPlacement(
  videoId: string | undefined,
  tabId: string | undefined,
  items: TierListItem[],
): Record<number, Slot> {
  const key = storageKey(videoId, tabId);
  const base = initialPlacement(items);
  if (!key) return base;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return base;
    const stored = parsed as Record<string, unknown>;
    const valid: Slot[] = [...TIERS, UNRANKED];
    for (let i = 0; i < items.length; i++) {
      const slot = stored[String(i)];
      if (typeof slot === 'string' && (valid as string[]).includes(slot)) {
        base[i] = slot as Slot;
      }
    }
    return base;
  } catch {
    return base;
  }
}

function persistPlacement(
  videoId: string | undefined,
  tabId: string | undefined,
  placement: Record<number, Slot>,
): void {
  const key = storageKey(videoId, tabId);
  if (!key) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(placement));
  } catch {
    // Silent: storage may be unavailable (private mode, quota).
  }
}

interface ChipProps {
  index: number;
  item: TierListItem;
}

function TierChip({ index, item }: ChipProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `tier-item-${index}`,
    data: { index },
  });

  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      role="button"
      tabIndex={0}
      aria-label={`Drag ${item.item}`}
      className={cn(
        'inline-flex cursor-grab touch-none items-center gap-1.5 rounded-full',
        'border border-border/60 bg-card px-2.5 py-1 text-xs font-medium',
        'active:cursor-grabbing',
        isDragging && 'opacity-50 shadow-lg',
      )}
    >
      <GripVertical className="size-3 shrink-0 text-muted-foreground/60" aria-hidden="true" />
      {item.emoji ? (
        <span aria-hidden="true" className="leading-none">
          {item.emoji}
        </span>
      ) : null}
      <span className="truncate">{item.item}</span>
    </div>
  );
}

interface RowProps {
  slot: Slot;
  label: string;
  accent?: string;
  indices: number[];
  items: TierListItem[];
}

function TierRow({ slot, label, accent, indices, items }: RowProps) {
  const { setNodeRef, isOver } = useDroppable({ id: slot });

  return (
    <div className="flex items-stretch gap-2">
      <div
        className="flex w-12 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-foreground"
        style={accent ? { backgroundColor: `color-mix(in oklch, ${accent} 30%, transparent)` } : undefined}
      >
        {label}
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          'flex min-h-[3rem] flex-1 flex-wrap content-start gap-1.5 rounded-lg border border-dashed border-border/60 p-2 transition-colors',
          isOver && 'border-[var(--vie-accent)] bg-[var(--vie-accent)]/5',
        )}
      >
        {indices.length === 0 ? (
          <span className="self-center text-xs text-muted-foreground/60">Drop items here</span>
        ) : (
          indices.map((idx) => {
            const item = items[idx];
            if (!item) return null;
            return <TierChip key={idx} index={idx} item={item} />;
          })
        )}
      </div>
    </div>
  );
}

/**
 * TierList — the gaming signature surface. Items start in the creator's
 * suggested S/A/B/C/D tier (or an unranked bench); the viewer drags them
 * between tiers and the ranking persists per video to localStorage. A reset
 * restores the creator's placement.
 */
export const TierList = memo(function TierList({ items, videoId, tabId }: TierListProps) {
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor));
  const [placement, setPlacement] = useState<Record<number, Slot>>(() =>
    loadPlacement(videoId, tabId, items),
  );

  // Re-seed placement when the video/tab/item-count identity changes so a reused
  // component instance can't persist one video's ranking under another's key.
  // (Render-phase reset — the React-recommended "adjust state on prop change".)
  const placementKey = `${videoId ?? ''}:${tabId ?? ''}:${items.length}`;
  const [prevKey, setPrevKey] = useState(placementKey);
  if (placementKey !== prevKey) {
    setPrevKey(placementKey);
    setPlacement(loadPlacement(videoId, tabId, items));
  }

  useEffect(() => {
    persistPlacement(videoId, tabId, placement);
  }, [videoId, tabId, placement]);

  const bySlot = useMemo(() => {
    const map: Record<Slot, number[]> = {
      S: [], A: [], B: [], C: [], D: [], [UNRANKED]: [],
    };
    items.forEach((_, index) => {
      const slot = placement[index] ?? UNRANKED;
      map[slot].push(index);
    });
    return map;
  }, [items, placement]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const target = event.over?.id;
    const index = event.active.data.current?.index;
    if (typeof index !== 'number' || typeof target !== 'string') return;
    const valid: Slot[] = [...TIERS, UNRANKED];
    if (!(valid as string[]).includes(target)) return;
    setPlacement((prev) => {
      if (prev[index] === target) return prev;
      return { ...prev, [index]: target as Slot };
    });
  }, []);

  const handleReset = useCallback(() => {
    setPlacement(initialPlacement(items));
  }, [items]);

  if (items.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground" role="status">
        No items to rank for this video.
      </p>
    );
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Drag items to build your tier list — your ranking saves automatically.
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="gap-1 text-xs"
          >
            <RotateCcw className="size-3.5 shrink-0" aria-hidden="true" />
            Reset
          </Button>
        </div>

        <GlassCard variant="outlined" className="flex flex-col gap-2 p-3">
          {TIERS.map((tier) => (
            <TierRow
              key={tier}
              slot={tier}
              label={tier}
              accent={TIER_ACCENT[tier]}
              indices={bySlot[tier]}
              items={items}
            />
          ))}
        </GlassCard>

        <div>
          <h4 className="mb-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Unranked ({bySlot[UNRANKED].length})
          </h4>
          <TierRow
            slot={UNRANKED}
            label="—"
            indices={bySlot[UNRANKED]}
            items={items}
          />
        </div>
      </div>
    </DndContext>
  );
});
