import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type Active,
  type Announcements,
  type DragEndEvent,
  type ScreenReaderInstructions,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, RotateCcw, Trophy } from 'lucide-react';
import type { TierListItem, TierRank } from '@vie/types';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/vie';
import { EmptyTabState } from './EmptyTabState';

interface TierListProps {
  items: TierListItem[];
  videoId?: string;
  tabId?: string;
}

/** Ordered tiers plus the "unranked" bench where unplaced items wait. */
const TIERS: TierRank[] = ['S', 'A', 'B', 'C', 'D'];
const UNRANKED = '__unranked__';
type Slot = TierRank | typeof UNRANKED;

interface TierStyle {
  /** Letter-box fill — a single-hue ramp of the domain accent. */
  bg: string;
  /** Letter color, picked to stay legible on `bg` in every theme. */
  fg: string;
}

/**
 * Per-tier styling — a single-hue ramp of the domain accent token. S is the
 * strongest fill and D the faintest, so the ranking reads as one domain color
 * varied only by alpha (never a second hue).
 *
 * The label color can't be one fixed token: `--vie-accent-foreground` is only
 * contrast-safe on a *solid* accent. The near-solid top tiers (S/A) use it; the
 * faint tiers (B/C/D) blend toward the surface, so their letter uses
 * `--foreground` (defined to contrast that surface). Without this split, a dark
 * domain accent in light theme (or a light one in dark theme) renders the lower
 * tiers' letters near-invisible.
 */
const TIER_STYLE: Record<TierRank, TierStyle> = {
  S: { bg: 'oklch(from var(--vie-accent) l c h / 1)', fg: 'var(--vie-accent-foreground)' },
  A: { bg: 'oklch(from var(--vie-accent) l c h / 0.8)', fg: 'var(--vie-accent-foreground)' },
  B: { bg: 'oklch(from var(--vie-accent) l c h / 0.6)', fg: 'var(--foreground)' },
  C: { bg: 'oklch(from var(--vie-accent) l c h / 0.4)', fg: 'var(--foreground)' },
  D: { bg: 'oklch(from var(--vie-accent) l c h / 0.25)', fg: 'var(--foreground)' },
};

/** Human-readable slot name for screen-reader announcements. */
function slotName(slot: string): string {
  return slot === UNRANKED ? 'the unranked bench' : `tier ${slot}`;
}

const SCREEN_READER_INSTRUCTIONS: ScreenReaderInstructions = {
  draggable:
    'To pick up a rankable item, press space or enter. Use the arrow keys to move it over a tier row, then press space or enter again to drop it there. Press escape to cancel.',
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
      aria-label={item.reason ? `Drag ${item.item}: ${item.reason}` : `Drag ${item.item}`}
      title={item.reason}
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
      <span className="min-w-0 max-w-[14rem] truncate">{item.item}</span>
    </div>
  );
}

interface RowProps {
  slot: Slot;
  label: string;
  accent?: TierStyle;
  indices: number[];
  items: TierListItem[];
}

function TierRow({ slot, label, accent, indices, items }: RowProps) {
  const { setNodeRef, isOver } = useDroppable({ id: slot });

  return (
    <div className="flex items-stretch gap-2">
      <div
        className="flex w-14 shrink-0 items-center justify-center rounded-lg text-xl font-extrabold"
        style={
          accent
            ? { backgroundColor: accent.bg, color: accent.fg }
            : { color: 'var(--foreground)' }
        }
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

  // Creator rationales, ordered by suggested tier (S→D, then unranked). The
  // reasons explain the CREATOR's placement, so this list stays stable while
  // the viewer drags items around.
  const reasoned = useMemo(
    () =>
      items
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => Boolean(item.reason))
        .sort(
          (a, b) =>
            (a.item.tier ? TIERS.indexOf(a.item.tier) : TIERS.length) -
            (b.item.tier ? TIERS.indexOf(b.item.tier) : TIERS.length),
        ),
    [items],
  );

  const announcements = useMemo<Announcements>(() => {
    const nameOf = (active: Active): string => {
      const index = active.data.current?.index;
      return typeof index === 'number' ? (items[index]?.item ?? 'item') : 'item';
    };
    return {
      onDragStart({ active }) {
        return `Picked up ${nameOf(active)}.`;
      },
      onDragOver({ active, over }) {
        return over ? `${nameOf(active)} is over ${slotName(String(over.id))}.` : undefined;
      },
      onDragEnd({ active, over }) {
        return over
          ? `${nameOf(active)} was dropped into ${slotName(String(over.id))}.`
          : `${nameOf(active)} was dropped.`;
      },
      onDragCancel({ active }) {
        return `Dragging ${nameOf(active)} was cancelled.`;
      },
    };
  }, [items]);

  if (items.length === 0) {
    return <EmptyTabState message="No items to rank for this video." icon={Trophy} />;
  }

  return (
    <DndContext
      sensors={sensors}
      onDragEnd={handleDragEnd}
      accessibility={{ announcements, screenReaderInstructions: SCREEN_READER_INSTRUCTIONS }}
    >
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
              accent={TIER_STYLE[tier]}
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

        {/* Creator rationale — surfaces the extracted `reason` field that the
            drag chips can only hint at via title/aria-label. */}
        {reasoned.length > 0 && (
          <div>
            <h4 className="mb-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Why these rankings
            </h4>
            <ul className="space-y-1.5">
              {reasoned.map(({ item, index }) => (
                <li key={index} className="flex items-start gap-2.5">
                  <span
                    className="flex size-6 shrink-0 items-center justify-center rounded-md text-xs font-bold"
                    style={
                      item.tier
                        ? {
                            backgroundColor: TIER_STYLE[item.tier].bg,
                            color: TIER_STYLE[item.tier].fg,
                          }
                        : { color: 'var(--foreground)' }
                    }
                  >
                    {/* aria-label is unreliable on non-interactive spans —
                        expose the tier via visually-hidden text instead. */}
                    <span aria-hidden="true">{item.tier ?? '—'}</span>
                    <span className="sr-only">{item.tier ? `Tier ${item.tier}` : 'Unranked'}</span>
                  </span>
                  <div className="min-w-0">
                    <span className="text-sm font-medium">
                      {item.emoji ? <span aria-hidden="true">{item.emoji} </span> : null}
                      {item.item}
                    </span>
                    <p className="text-sm text-muted-foreground">{item.reason}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </DndContext>
  );
});
