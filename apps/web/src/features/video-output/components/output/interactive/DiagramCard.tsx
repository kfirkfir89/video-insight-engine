import { memo, useMemo } from 'react';
import {
  Handle,
  Position,
  type Edge,
  type Node,
  type NodeTypes,
} from '@xyflow/react';

import { VieCanvas } from '@/components/vie/canvas/CanvasShell';
import { cn } from '@/lib/utils';

export interface DiagramCardItem {
  label: string;
  detail?: string;
  emoji?: string;
}

/** A directed edge between two diagram nodes, addressed by node index. */
export interface DiagramCardEdge {
  source: number;
  target: number;
}

interface DiagramCardProps {
  nodes: DiagramCardItem[];
  /** Optional explicit edges (from concept connections). When omitted the
   *  diagram falls back to a left-to-right chain (step ordering). */
  edges?: DiagramCardEdge[];
  caption?: string;
  className?: string;
}

// ─── Layout ───

const COLUMN_OFFSET = 220;
const ROW_SPACING = 120;

/** Left-to-right staggered layout — keeps a readable flow without overlap for
 *  the small node counts a diagram_card carries (capped well under 10). */
function diagramLayout(count: number): Array<{ x: number; y: number }> {
  return Array.from({ length: count }, (_, index) => ({
    x: index * COLUMN_OFFSET,
    y: (index % 2) * ROW_SPACING,
  }));
}

function diagramNodeId(index: number): string {
  return `diagram-${index}`;
}

// ─── Node ───

interface DiagramNodeData extends Record<string, unknown> {
  item: DiagramCardItem;
}

const DiagramNode = memo(function DiagramNode({ data }: { data: DiagramNodeData }) {
  const { item } = data;
  return (
    <div data-slot="vie-diagram-node" className="relative">
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2 !w-2 !border-0 !bg-[var(--vie-accent,var(--primary))]"
      />
      <div className="flex min-w-[7rem] max-w-[14rem] flex-col gap-0.5 rounded-lg border border-border bg-card px-3 py-2">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          {item.emoji ? (
            <span aria-hidden="true" className="shrink-0 leading-none">
              {item.emoji}
            </span>
          ) : null}
          {item.label}
        </span>
        {item.detail ? (
          <span className="text-xs leading-snug text-muted-foreground">{item.detail}</span>
        ) : null}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!h-2 !w-2 !border-0 !bg-[var(--vie-accent,var(--primary))]"
      />
    </div>
  );
});

const NODE_TYPES: NodeTypes = { diagram: DiagramNode };

/**
 * Build the edge list. Explicit edges (from concept connections) win; otherwise
 * fall back to a sequential chain (node[i] → node[i+1]) so step orderings still
 * render a flow. Exported for unit testing.
 */
export function buildDiagramEdges(count: number, edges?: DiagramCardEdge[]): Edge[] {
  if (edges && edges.length > 0) {
    return edges
      .filter(
        (e) =>
          Number.isInteger(e.source) &&
          Number.isInteger(e.target) &&
          e.source >= 0 &&
          e.target >= 0 &&
          e.source < count &&
          e.target < count &&
          e.source !== e.target,
      )
      .map((e) => ({
        id: `${diagramNodeId(e.source)}->${diagramNodeId(e.target)}`,
        source: diagramNodeId(e.source),
        target: diagramNodeId(e.target),
        type: 'smoothstep',
        style: { stroke: 'var(--vie-accent, var(--primary))', strokeWidth: 1.4 },
      }));
  }
  return Array.from({ length: Math.max(count - 1, 0) }, (_, index) => ({
    id: `${diagramNodeId(index)}->${diagramNodeId(index + 1)}`,
    source: diagramNodeId(index),
    target: diagramNodeId(index + 1),
    type: 'smoothstep',
    style: { stroke: 'var(--border)', strokeWidth: 1.4 },
  }));
}

/**
 * DiagramCard — a read-only ReactFlow diagram of labelled nodes wired by edges.
 * Secondary-tier (attachment-only). Gives a sparse tab a quick "how the pieces
 * connect" sketch — pan-only (`nodesDraggable={false}`), no interaction beyond
 * panning. Edges come from concept connections when available, else a sequential
 * chain (step ordering). The heavier interactive maps live in `concept_canvas` /
 * `step_flow_canvas`.
 */
export const DiagramCard = memo(function DiagramCard({
  nodes,
  edges,
  caption,
  className,
}: DiagramCardProps) {
  const clean = useMemo(() => nodes.filter((n) => n && n.label?.trim()), [nodes]);

  const flowNodes = useMemo<Node<DiagramNodeData>[]>(() => {
    const positions = diagramLayout(clean.length);
    return clean.map((item, index) => ({
      id: diagramNodeId(index),
      type: 'diagram',
      position: positions[index],
      data: { item },
      draggable: false,
    }));
  }, [clean]);

  const flowEdges = useMemo<Edge[]>(
    () => buildDiagramEdges(clean.length, edges),
    [clean.length, edges],
  );

  if (clean.length === 0) return null;

  return (
    <figure className={cn('space-y-2', className)}>
      <VieCanvas
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={NODE_TYPES}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        zoomOnScroll={false}
        height={Math.min(420, 200 + Math.ceil(clean.length / 2) * 80)}
        aria-label="Diagram"
      />
      {caption ? (
        <figcaption className="text-xs text-muted-foreground">{caption}</figcaption>
      ) : null}
    </figure>
  );
});
