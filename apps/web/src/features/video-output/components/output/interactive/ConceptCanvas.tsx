import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Handle,
  Position,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
  type NodeMouseHandler,
  type NodeTypes,
  type OnNodeDrag,
} from '@xyflow/react';

import { VieCanvas } from '@/components/vie/canvas/CanvasShell';
import { GlassCard } from '@/components/vie';
import { cn } from '@/lib/utils';
import type { ConceptItem } from '@vie/types';

// ─── Props ───

interface ConceptCanvasProps {
  concepts: ConceptItem[];
  onSeek?: (seconds: number) => void;
  videoId?: string;
  nextTab?: string;
  onNavigateTab?: (id: string) => void;
}

// ─── Persistence ───

interface StoredPositions {
  [nodeId: string]: { x: number; y: number };
}

function storageKey(videoId?: string): string | null {
  if (!videoId) return null;
  return `vie:concept-canvas:${videoId}`;
}

function readStoredPositions(videoId?: string): StoredPositions {
  const key = storageKey(videoId);
  if (!key || typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as StoredPositions;
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function writeStoredPositions(videoId: string | undefined, positions: StoredPositions): void {
  const key = storageKey(videoId);
  if (!key || typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(positions));
  } catch {
    // Best-effort persistence; ignore quota errors.
  }
}

// ─── Layout ───

const CANVAS_RADIUS = 220;

function radialLayout(count: number, stored: StoredPositions): Array<{ x: number; y: number }> {
  if (count === 0) return [];
  return Array.from({ length: count }, (_, index) => {
    const id = nodeIdFor(index);
    const saved = stored[id];
    if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
      return saved;
    }
    if (index === 0) return { x: 0, y: 0 };
    const ringCount = Math.max(count - 1, 1);
    const angle = ((index - 1) / ringCount) * Math.PI * 2;
    return {
      x: Math.cos(angle) * CANVAS_RADIUS,
      y: Math.sin(angle) * CANVAS_RADIUS,
    };
  });
}

function nodeIdFor(index: number): string {
  return `concept-${index}`;
}

function buildNameIndex(concepts: ConceptItem[]): Map<string, number> {
  const index = new Map<string, number>();
  concepts.forEach((concept, i) => {
    if (concept?.name) {
      index.set(concept.name.toLowerCase(), i);
    }
  });
  return index;
}

/**
 * Builds the edge list from each concept's `connections[]` adjacency list.
 * Unmatched connection names (typos, hallucinations) and self-references are
 * filtered out. Exported for unit testing — the rendered xyflow edge layer
 * needs a real viewport to mount in.
 */
export function buildConceptEdges(concepts: ConceptItem[]): Edge[] {
  if (!concepts?.length) return [];
  const nameIndex = buildNameIndex(concepts);
  const edges: Edge[] = [];
  concepts.forEach((concept, sourceIndex) => {
    const sourceId = nodeIdFor(sourceIndex);
    concept.connections?.forEach((connectionName) => {
      const targetIndex = nameIndex.get(connectionName.toLowerCase());
      if (targetIndex == null || targetIndex === sourceIndex) return;
      const targetId = nodeIdFor(targetIndex);
      edges.push({
        id: `${sourceId}->${targetId}`,
        source: sourceId,
        target: targetId,
        type: 'smoothstep',
        style: { stroke: 'var(--vie-accent, var(--primary))', strokeWidth: 1.4 },
      });
    });
  });
  return edges;
}

// ─── Node component ───

interface ConceptNodeData extends Record<string, unknown> {
  concept: ConceptItem;
  expanded: boolean;
  onToggle: (id: string) => void;
  nodeId: string;
}

const ConceptNode = memo(function ConceptNode({
  data,
}: {
  data: ConceptNodeData;
}) {
  const { concept, expanded, onToggle, nodeId } = data;
  return (
    <div data-slot="vie-concept-node" className="relative">
      <Handle
        type="target"
        position={Position.Top}
        className="!h-2 !w-2 !border-0 !bg-[var(--vie-accent,var(--primary))]"
      />
      <GlassCard
        variant={expanded ? 'interactive' : 'default'}
        className={cn(
          'min-w-[160px] max-w-[260px] cursor-pointer p-3 text-start transition-colors',
          'hover:border-[color:var(--vie-accent,var(--primary))]/60',
          'focus-within:ring-2 focus-within:ring-[color:var(--vie-accent,var(--primary))]/50',
          expanded && 'border-[color:var(--vie-accent,var(--primary))]/60',
        )}
      >
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggle(nodeId);
          }}
          className="flex w-full items-center gap-2 text-start outline-none focus-visible:underline"
          aria-expanded={expanded}
        >
          <span className="text-2xl leading-none" aria-hidden="true">
            {concept.emoji || '💡'}
          </span>
          <span className="flex-1 truncate text-sm font-semibold text-foreground">
            {concept.name}
          </span>
        </button>
        {expanded && (
          <div className="mt-3 space-y-2 text-xs leading-snug text-muted-foreground">
            <p className="text-sm text-foreground/90">{concept.definition}</p>
            {concept.example && (
              <p>
                <span className="me-1 text-[10px] font-semibold uppercase tracking-wider text-foreground/70">
                  Example
                </span>
                {concept.example}
              </p>
            )}
            {concept.analogy && (
              <p>
                <span className="me-1 text-[10px] font-semibold uppercase tracking-wider text-foreground/70">
                  Analogy
                </span>
                {concept.analogy}
              </p>
            )}
          </div>
        )}
      </GlassCard>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-2 !w-2 !border-0 !bg-[var(--vie-accent,var(--primary))]"
      />
    </div>
  );
});

const NODE_TYPES: NodeTypes = { concept: ConceptNode };

// ─── Canvas ───

/**
 * Concept map rendered on top of @xyflow/react. Lays concepts out radially
 * (first concept at center, others on a circle), wires connections from the
 * `connections[]` adjacency list, and persists per-video node positions to
 * `localStorage` so the user's manual layout survives reloads.
 *
 * Falls back to a friendly empty card when no concepts are provided.
 */
export const ConceptCanvas = memo(function ConceptCanvas({
  concepts,
  videoId,
}: ConceptCanvasProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const handleToggle = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  const initialNodes = useMemo<Node<ConceptNodeData>[]>(() => {
    if (!concepts?.length) return [];
    const stored = readStoredPositions(videoId);
    const positions = radialLayout(concepts.length, stored);
    return concepts.map((concept, index) => {
      const id = nodeIdFor(index);
      return {
        id,
        type: 'concept',
        position: positions[index],
        data: {
          concept,
          expanded: false,
          onToggle: handleToggle,
          nodeId: id,
        },
      };
    });
    // We intentionally ignore handleToggle in deps because it's stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [concepts, videoId]);

  const initialEdges = useMemo<Edge[]>(() => buildConceptEdges(concepts), [concepts]);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<ConceptNodeData>>(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState<Edge>(initialEdges);

  // When concepts or layout change, replace nodes/edges wholesale.
  useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes, setNodes]);

  // Re-sync expanded flag into node data without losing positions.
  useEffect(() => {
    setNodes((prev) =>
      prev.map((node) => ({
        ...node,
        data: {
          ...node.data,
          expanded: node.id === expandedId,
        },
      })),
    );
  }, [expandedId, setNodes]);

  const handleNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => handleToggle(node.id),
    [handleToggle],
  );

  const handleNodeDragStop: OnNodeDrag = useCallback(
    (_event, _node, draggedNodes) => {
      if (!videoId) return;
      const positions = readStoredPositions(videoId);
      draggedNodes.forEach((dn) => {
        positions[dn.id] = { x: dn.position.x, y: dn.position.y };
      });
      writeStoredPositions(videoId, positions);
    },
    [videoId],
  );

  if (!concepts?.length) {
    return (
      <GlassCard variant="outlined" className="text-center text-sm text-muted-foreground">
        No concepts to map yet.
      </GlassCard>
    );
  }

  return (
    <div className="space-y-3">
      <VieCanvas
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onNodeDragStop={handleNodeDragStop}
        height={520}
      />
    </div>
  );
});
