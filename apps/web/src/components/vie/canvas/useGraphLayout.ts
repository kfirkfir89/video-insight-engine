import { useMemo } from 'react';
import dagre from '@dagrejs/dagre';

/**
 * Deterministic, static graph layout for the concept canvas. Each group is laid
 * out as its own Dagre sub-graph (tiered top→bottom by connection rank), then the
 * groups are placed side-by-side in horizontal lanes. Cross-group edges are drawn
 * as floating edges and deliberately do NOT influence ranking, so the lanes stay
 * clean. Pure + SSR-safe (Dagre never touches `document`/`window`).
 */

export interface GraphLayoutNode {
  id: string;
  group: string;
}

export interface GraphLayoutEdge {
  source: string;
  target: string;
}

export interface NodePosition {
  x: number;
  y: number;
}

export interface GroupBounds {
  group: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GraphLayout {
  positions: Record<string, NodePosition>;
  groupBounds: GroupBounds[];
  width: number;
  height: number;
}

export const NODE_WIDTH = 184;
export const NODE_HEIGHT = 56;
const LANE_GAP = 96;
const RANK_SEP = 64;
const NODE_SEP = 28;
const LANE_PAD = 24;

/** Lay out a single group's nodes with Dagre; returns top-left positions local
 *  to the group's own origin plus the sub-graph extent. */
function layoutGroup(
  nodeIds: string[],
  edges: GraphLayoutEdge[],
): { positions: Record<string, NodePosition>; width: number; height: number } {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'TB', ranksep: RANK_SEP, nodesep: NODE_SEP, marginx: 0, marginy: 0 });
  g.setDefaultEdgeLabel(() => ({}));

  const idSet = new Set(nodeIds);
  for (const id of nodeIds) {
    g.setNode(id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }
  for (const edge of edges) {
    // Only intra-group edges affect ranking.
    if (idSet.has(edge.source) && idSet.has(edge.target) && edge.source !== edge.target) {
      g.setEdge(edge.source, edge.target);
    }
  }

  dagre.layout(g);

  const positions: Record<string, NodePosition> = {};
  for (const id of nodeIds) {
    const node = g.node(id);
    // Dagre reports center coords; React Flow wants top-left.
    positions[id] = { x: node.x - NODE_WIDTH / 2, y: node.y - NODE_HEIGHT / 2 };
  }
  const graph = g.graph();
  return {
    positions,
    width: Number.isFinite(graph.width) ? (graph.width ?? NODE_WIDTH) : NODE_WIDTH,
    height: Number.isFinite(graph.height) ? (graph.height ?? NODE_HEIGHT) : NODE_HEIGHT,
  };
}

export function computeGraphLayout(
  nodes: GraphLayoutNode[],
  edges: GraphLayoutEdge[],
  groups: string[],
): GraphLayout {
  const positions: Record<string, NodePosition> = {};
  const groupBounds: GroupBounds[] = [];

  // Preserve the caller's group order; append any groups present on nodes but
  // missing from the ordered list (defensive — assembler should keep them synced).
  const ordered = [...groups];
  for (const node of nodes) {
    if (!ordered.includes(node.group)) ordered.push(node.group);
  }

  let laneX = 0;
  let maxHeight = 0;

  for (const group of ordered) {
    const groupNodeIds = nodes.filter((n) => n.group === group).map((n) => n.id);
    if (groupNodeIds.length === 0) continue;

    const local = layoutGroup(groupNodeIds, edges);
    for (const id of groupNodeIds) {
      const p = local.positions[id];
      positions[id] = { x: p.x + laneX + LANE_PAD, y: p.y + LANE_PAD };
    }
    const laneWidth = local.width + LANE_PAD * 2;
    groupBounds.push({
      group,
      x: laneX,
      y: 0,
      width: laneWidth,
      height: local.height + LANE_PAD * 2,
    });
    laneX += laneWidth + LANE_GAP;
    maxHeight = Math.max(maxHeight, local.height + LANE_PAD * 2);
  }

  // Normalize every lane to the tallest so the bounds boxes line up.
  for (const bounds of groupBounds) bounds.height = maxHeight;

  return {
    positions,
    groupBounds,
    width: Math.max(laneX - LANE_GAP, NODE_WIDTH),
    height: Math.max(maxHeight, NODE_HEIGHT),
  };
}

export function useGraphLayout(
  nodes: GraphLayoutNode[],
  edges: GraphLayoutEdge[],
  groups: string[],
): GraphLayout {
  return useMemo(
    () => computeGraphLayout(nodes, edges, groups),
    // Recompute only when the structural inputs change. Serializing is cheap
    // (≤30 concepts) and keeps the memo key stable across referential churn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(nodes), JSON.stringify(edges), JSON.stringify(groups)],
  );
}
