import { memo, useMemo } from 'react';
import { type Node, type NodeTypes } from '@xyflow/react';
import type { FormationPosition } from '@vie/types';

import { VieCanvas } from '@/components/vie/canvas/CanvasShell';

interface FormationDiagramProps {
  positions: FormationPosition[];
  name?: string;
  team?: string;
}

// Pitch canvas dimensions (px). x/y percentages map onto this box; a margin
// keeps edge players off the touchlines.
const PITCH_WIDTH = 640;
const PITCH_HEIGHT = 440;
const MARGIN = 32;

/** Map a 0-100 percentage onto the pitch box. y is inverted so 100 (attacking
 *  end) sits at the TOP of the diagram — the natural "attacking upward" view. */
function projectX(x: number): number {
  const clamped = Math.max(0, Math.min(100, x));
  return MARGIN + (clamped / 100) * (PITCH_WIDTH - 2 * MARGIN);
}

function projectY(y: number): number {
  const clamped = Math.max(0, Math.min(100, y));
  return MARGIN + ((100 - clamped) / 100) * (PITCH_HEIGHT - 2 * MARGIN);
}

interface PlayerNodeData extends Record<string, unknown> {
  position: FormationPosition;
}

const PlayerNode = memo(function PlayerNode({ data }: { data: PlayerNodeData }) {
  const { position } = data;
  return (
    <div data-slot="vie-formation-node" className="flex flex-col items-center gap-0.5">
      <div className="flex size-9 items-center justify-center rounded-full border border-[var(--vie-accent,var(--primary))] bg-card text-xs font-bold tabular-nums text-foreground shadow-sm">
        {position.number != null ? position.number : (position.role ?? '•')}
      </div>
      <span className="max-w-[6rem] truncate rounded bg-background/80 px-1 text-[10px] font-medium leading-tight text-foreground">
        {position.player}
      </span>
    </div>
  );
});

const NODE_TYPES: NodeTypes = { player: PlayerNode };

/**
 * FormationDiagram — the sport signature surface. Renders players as nodes on
 * a read-only ReactFlow pitch (`nodesDraggable={false}`), positioned by their
 * 0-100 x/y coordinates. A tactical overview of who lined up where — not an
 * editable canvas; the heavier interactive maps live in concept_canvas.
 */
export const FormationDiagram = memo(function FormationDiagram({
  positions,
  name,
  team,
}: FormationDiagramProps) {
  const clean = useMemo(
    () => positions.filter((p) => p && p.player?.trim()),
    [positions],
  );

  const flowNodes = useMemo<Node<PlayerNodeData>[]>(
    () =>
      clean.map((position, index) => ({
        id: `player-${index}`,
        type: 'player',
        position: { x: projectX(position.x), y: projectY(position.y) },
        data: { position },
        draggable: false,
        selectable: false,
      })),
    [clean],
  );

  if (clean.length === 0) return null;

  const caption = [team, name].filter(Boolean).join(' · ');

  return (
    <figure className="space-y-2">
      <VieCanvas
        nodes={flowNodes}
        edges={[]}
        nodeTypes={NODE_TYPES}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        zoomOnScroll={false}
        height={PITCH_HEIGHT}
        className="bg-[color-mix(in_oklch,var(--vie-forest)_12%,var(--background))]"
        aria-label={caption ? `Formation: ${caption}` : 'Formation'}
      />
      {caption ? (
        <figcaption className="text-xs text-muted-foreground">{caption}</figcaption>
      ) : null}
    </figure>
  );
});
