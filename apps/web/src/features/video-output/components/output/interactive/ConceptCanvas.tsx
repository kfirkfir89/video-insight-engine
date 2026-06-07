import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Handle,
  MarkerType,
  Position,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
  type NodeMouseHandler,
  type NodeTypes,
  type EdgeTypes,
} from '@xyflow/react';

import { VieCanvas } from '@/components/vie/canvas/CanvasShell';
import {
  FloatingEdge,
  type EdgeVisualState,
  isDirectionalRelation,
} from '@/components/vie/canvas/FloatingEdge';
import {
  CanvasInspector,
  type InspectorNeighbor,
} from '@/components/vie/canvas/CanvasInspector';
import { useGraphLayout } from '@/components/vie/canvas/useGraphLayout';
import { GlassCard } from '@/components/vie';
import { useIsDesktop } from '@/hooks/use-media-query';
import { cn } from '@/lib/utils';
import type { ConceptItem, ConceptConnection, ConceptRelation } from '@vie/types';

// ─── Props ───

interface ConceptCanvasProps {
  concepts: ConceptItem[];
  groups?: string[];
  onSeek?: (seconds: number) => void;
}

// ─── Model ───

const DEFAULT_GROUP = 'Concepts';
const ACCENT = 'var(--vie-accent, var(--primary))';
const GROUP_DOT_CLASSES = [
  'bg-foreground/30',
  'bg-foreground/45',
  'bg-foreground/60',
  'bg-foreground/75',
  'bg-foreground/90',
];

function groupDotClass(index: number): string {
  return GROUP_DOT_CLASSES[index % GROUP_DOT_CLASSES.length];
}

function conceptNodeId(index: number): string {
  return `concept-${index}`;
}

/** Coerce a connection (legacy bare string OR typed object) to `{to, type}`. */
function normalizeConnection(conn: string | ConceptConnection): ConceptConnection {
  if (typeof conn === 'string') return { to: conn, type: 'relatesTo' };
  return { to: conn.to, type: conn.type ?? 'relatesTo' };
}

export interface ConceptGraphModel {
  nodes: Array<{ id: string; concept: ConceptItem; group: string; groupIndex: number }>;
  edges: Array<{ id: string; source: string; target: string; relation: ConceptRelation }>;
  /** id → connected neighbours (both directions), with the relation that links them. */
  adjacency: Map<string, InspectorNeighbor[]>;
  groups: string[];
}

/**
 * Build the concept graph from raw props. Resolves typed/legacy connections to
 * real concept ids (dropping hallucinated / self references), assigns a group
 * lane per concept, and collects an undirected adjacency map for the inspector.
 * Pure + exported for unit testing.
 */
export function buildConceptGraph(
  concepts: ConceptItem[],
  groupsProp?: string[],
): ConceptGraphModel {
  const safe = (concepts ?? []).filter((c) => c && c.name && c.definition);

  // Group lanes: prefer the assembler's ordered list, else derive from concepts.
  const orderedGroups: string[] = [...(groupsProp ?? [])];
  const groupForConcept = safe.map((c) => (c.group?.trim() ? c.group.trim() : DEFAULT_GROUP));
  for (const group of groupForConcept) {
    if (!orderedGroups.includes(group)) orderedGroups.push(group);
  }
  if (orderedGroups.length === 0) orderedGroups.push(DEFAULT_GROUP);

  const nameToId = new Map<string, string>();
  safe.forEach((concept, i) => nameToId.set(concept.name.trim().toLowerCase(), conceptNodeId(i)));

  const nodes = safe.map((concept, i) => {
    const group = groupForConcept[i];
    return { id: conceptNodeId(i), concept, group, groupIndex: Math.max(0, orderedGroups.indexOf(group)) };
  });

  const adjacency = new Map<string, InspectorNeighbor[]>();
  const pushNeighbor = (fromId: string, toId: string, relation: ConceptRelation): void => {
    const node = nodes.find((n) => n.id === toId);
    if (!node) return;
    const list = adjacency.get(fromId) ?? [];
    if (list.some((n) => n.id === toId)) return;
    list.push({ id: toId, name: node.concept.name, emoji: node.concept.emoji, relation });
    adjacency.set(fromId, list);
  };

  const edges: ConceptGraphModel['edges'] = [];
  const seenPairs = new Set<string>();
  safe.forEach((concept, i) => {
    const sourceId = conceptNodeId(i);
    for (const raw of concept.connections ?? []) {
      const { to, type } = normalizeConnection(raw);
      const targetId = nameToId.get(to.trim().toLowerCase());
      if (!targetId || targetId === sourceId) continue;
      // Adjacency is undirected (inspector shows everything connected).
      pushNeighbor(sourceId, targetId, type);
      pushNeighbor(targetId, sourceId, type);
      // One drawn edge per unordered pair to avoid overlapping reciprocal lines.
      const pairKey = [sourceId, targetId].sort().join('|');
      if (seenPairs.has(pairKey)) continue;
      seenPairs.add(pairKey);
      edges.push({ id: `${sourceId}->${targetId}`, source: sourceId, target: targetId, relation: type });
    }
  });

  return { nodes, edges, adjacency, groups: orderedGroups };
}

// ─── Node component ───

interface ConceptNodeData extends Record<string, unknown> {
  concept: ConceptItem;
  groupIndex: number;
  selected: boolean;
  dimmed: boolean;
  onSelect: (id: string) => void;
  nodeId: string;
}

const ConceptNode = memo(function ConceptNode({ data }: { data: ConceptNodeData }) {
  const { concept, groupIndex, selected, dimmed, onSelect, nodeId } = data;
  return (
    <div
      data-slot="vie-concept-node"
      data-selected={selected || undefined}
      className={cn('transition-opacity duration-200', dimmed && 'opacity-30')}
    >
      {/* Hidden handles — FloatingEdge computes its own center-to-center geometry,
          but React Flow still requires a source + target handle to wire an edge. */}
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={false}
        className="!h-px !w-px !min-w-0 !border-0 !bg-transparent !opacity-0"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={false}
        className="!h-px !w-px !min-w-0 !border-0 !bg-transparent !opacity-0"
      />
      <GlassCard
        variant={selected ? 'interactive' : 'default'}
        className={cn(
          'w-[184px] cursor-pointer p-2.5 text-start transition-colors',
          'hover:border-[color:var(--vie-accent,var(--primary))]/60',
          selected &&
            'border-[color:var(--vie-accent,var(--primary))] ring-2 ring-[color:var(--vie-accent,var(--primary))]/40',
        )}
      >
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onSelect(nodeId);
          }}
          className="flex w-full items-center gap-2 text-start outline-none focus-visible:underline"
          aria-pressed={selected}
        >
          <span className="text-xl leading-none" aria-hidden="true">
            {concept.emoji || '💡'}
          </span>
          <span className="flex-1 truncate text-sm font-semibold text-foreground">
            {concept.name}
          </span>
          <span
            className={cn('h-2.5 w-2.5 shrink-0 rounded-full', groupDotClass(groupIndex))}
            aria-hidden="true"
          />
        </button>
      </GlassCard>
    </div>
  );
});

const NODE_TYPES: NodeTypes = { concept: ConceptNode };
const EDGE_TYPES: EdgeTypes = { floating: FloatingEdge };

// ─── Legends ───

const RELATION_LEGEND: Array<{ label: string; dash?: string }> = [
  { label: 'causes / requires' },
  { label: 'contrasts', dash: '7 5' },
  { label: 'related', dash: '1.5 6' },
];

function RelationLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {RELATION_LEGEND.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <svg width="22" height="6" viewBox="0 0 22 6" aria-hidden="true">
            <line
              x1="1"
              y1="3"
              x2="21"
              y2="3"
              stroke={ACCENT}
              strokeWidth="1.6"
              strokeDasharray={item.dash}
              strokeLinecap="round"
            />
          </svg>
          {item.label}
        </span>
      ))}
    </div>
  );
}

// ─── Canvas ───

/**
 * Concept map rendered on @xyflow/react. Concepts are laid out by a deterministic
 * Dagre layout — tiered top→bottom by connection rank, clustered into per-group
 * horizontal lanes (`useGraphLayout`). Nodes are locked (`nodesDraggable={false}`)
 * with bounded pan; there is no localStorage persistence. Relationship type is
 * encoded on the edges by line-style + arrowhead (`FloatingEdge`), never hue.
 *
 * Selecting a concept docks the `CanvasInspector` (rendered outside the flow
 * node tree so it is never z-trapped), brightens the selected neighbourhood and
 * dims the rest. A Map/Groups toggle swaps the graph for group list-cards;
 * mobile defaults to Groups, desktop to Map.
 */
export const ConceptCanvas = memo(function ConceptCanvas({
  concepts,
  groups: groupsProp,
  onSeek,
}: ConceptCanvasProps) {
  const isDesktop = useIsDesktop();
  const model = useMemo(() => buildConceptGraph(concepts, groupsProp), [concepts, groupsProp]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<'map' | 'groups'>(() => (isDesktop ? 'map' : 'groups'));

  const handleSelect = useCallback((id: string) => setSelectedId(id), []);
  const handleClose = useCallback(() => setSelectedId(null), []);

  const layout = useGraphLayout(
    model.nodes.map((n) => ({ id: n.id, group: n.group })),
    model.edges.map((e) => ({ source: e.source, target: e.target })),
    model.groups,
  );

  // Highlight set = selected node + its neighbours.
  const highlightSet = useMemo(() => {
    if (!selectedId) return null;
    const set = new Set<string>([selectedId]);
    for (const neighbor of model.adjacency.get(selectedId) ?? []) set.add(neighbor.id);
    return set;
  }, [selectedId, model.adjacency]);

  // Selection/highlight decoration is derived during render (single source of
  // truth) rather than pushed in via effects — that previously let edge state
  // desync from the model when `concepts` changed mid-selection.
  const baseNodes = useMemo<Node<ConceptNodeData>[]>(() => {
    return model.nodes.map((n) => ({
      id: n.id,
      type: 'concept',
      position: layout.positions[n.id] ?? { x: 0, y: 0 },
      draggable: false,
      data: {
        concept: n.concept,
        groupIndex: n.groupIndex,
        selected: n.id === selectedId,
        dimmed: highlightSet != null && !highlightSet.has(n.id),
        onSelect: handleSelect,
        nodeId: n.id,
      },
    }));
  }, [model.nodes, layout, handleSelect, selectedId, highlightSet]);

  const baseEdges = useMemo<Edge[]>(() => {
    return model.edges.map((e) => {
      const state: EdgeVisualState =
        selectedId == null
          ? 'rest'
          : e.source === selectedId || e.target === selectedId
            ? 'active'
            : 'dimmed';
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        type: 'floating',
        data: { relation: e.relation, state },
        markerEnd: isDirectionalRelation(e.relation)
          ? { type: MarkerType.ArrowClosed, color: ACCENT, width: 16, height: 16 }
          : undefined,
      };
    });
  }, [model.edges, selectedId]);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<ConceptNodeData>>(baseNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(baseEdges);

  // Keep React Flow's controlled state in sync as the model or selection
  // changes. RF keys node measurements by id, so replacing node objects of the
  // same id preserves the measurements the FloatingEdge geometry depends on.
  useEffect(() => setNodes(baseNodes), [baseNodes, setNodes]);
  useEffect(() => setEdges(baseEdges), [baseEdges, setEdges]);

  const handleNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => setSelectedId(node.id),
    [],
  );

  const selectedConcept = useMemo(
    () => model.nodes.find((n) => n.id === selectedId)?.concept ?? null,
    [model.nodes, selectedId],
  );
  const selectedNeighbors = selectedId ? model.adjacency.get(selectedId) ?? [] : [];

  if (!model.nodes.length) {
    return (
      <GlassCard variant="outlined" className="text-center text-sm text-muted-foreground">
        No concepts to map yet.
      </GlassCard>
    );
  }

  const counts = `${model.nodes.length} concepts · ${model.groups.length} groups · ${model.edges.length} links`;
  const canvasHeight = Math.min(640, Math.max(420, layout.height + 120));

  return (
    <div className="space-y-3" data-slot="concept-canvas">
      {/* Header strip: restrained analytics + view toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium tabular-nums text-muted-foreground" data-testid="concept-canvas-counts">
          {counts}
        </p>
        <div
          role="tablist"
          aria-label="Concept view"
          className="inline-flex items-center rounded-lg border border-border bg-muted/20 p-0.5 text-xs font-semibold"
        >
          {(['map', 'groups'] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={cn(
                'rounded-md px-3 py-1 capitalize transition-colors',
                view === v
                  ? 'bg-[var(--vie-accent,var(--primary))] text-[var(--primary-foreground,white)]'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="relative">
        {view === 'map' ? (
          <VieCanvas
            nodes={nodes}
            edges={edges}
            nodeTypes={NODE_TYPES}
            edgeTypes={EDGE_TYPES}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={handleNodeClick}
            onPaneClick={handleClose}
            nodesDraggable={false}
            nodesConnectable={false}
            height={canvasHeight}
          />
        ) : (
          <GroupsView
            model={model}
            selectedId={selectedId}
            onSelect={handleSelect}
          />
        )}

        {selectedConcept && (
          <CanvasInspector
            concept={selectedConcept}
            neighbors={selectedNeighbors}
            onSelectNeighbor={handleSelect}
            onClose={handleClose}
            onSeek={onSeek}
            isDesktop={isDesktop}
          />
        )}
      </div>

      {/* Legends: relationship key + group key (both single-accent, no hue) */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg border border-border/60 bg-muted/10 px-3 py-2">
        <RelationLegend />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {model.groups.map((group, i) => (
            <span key={group} className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className={cn('h-2.5 w-2.5 rounded-full', groupDotClass(i))} aria-hidden="true" />
              {group}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
});

// ─── Groups list view (mobile default) ───

interface GroupsViewProps {
  model: ConceptGraphModel;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const GroupsView = memo(function GroupsView({ model, selectedId, onSelect }: GroupsViewProps) {
  const byGroup = useMemo(() => {
    const map = new Map<string, ConceptGraphModel['nodes']>();
    for (const group of model.groups) map.set(group, []);
    for (const node of model.nodes) {
      const list = map.get(node.group) ?? [];
      list.push(node);
      map.set(node.group, list);
    }
    return map;
  }, [model]);

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {model.groups.map((group, groupIndex) => {
        const members = byGroup.get(group) ?? [];
        if (members.length === 0) return null;
        return (
          <GlassCard key={group} variant="default" className="space-y-2 p-3">
            <header className="flex items-center gap-2">
              <span className={cn('h-2.5 w-2.5 rounded-full', groupDotClass(groupIndex))} aria-hidden="true" />
              <h4 className="flex-1 text-sm font-semibold text-foreground">{group}</h4>
              <span className="text-xs tabular-nums text-muted-foreground">{members.length}</span>
            </header>
            <ul className="space-y-1">
              {members.map((node) => (
                <li key={node.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(node.id)}
                    aria-pressed={node.id === selectedId}
                    className={cn(
                      'flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-start transition-colors',
                      node.id === selectedId
                        ? 'bg-[color:var(--vie-accent,var(--primary))]/10'
                        : 'hover:bg-muted/40',
                    )}
                  >
                    <span className="text-base leading-none" aria-hidden="true">
                      {node.concept.emoji || '💡'}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {node.concept.name}
                      </span>
                      <span className="line-clamp-1 text-xs text-muted-foreground">
                        {node.concept.definition}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </GlassCard>
        );
      })}
    </div>
  );
});
