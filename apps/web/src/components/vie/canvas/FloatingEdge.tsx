import { BaseEdge, getStraightPath, useInternalNode, type EdgeProps } from '@xyflow/react';
import { NODE_WIDTH, NODE_HEIGHT } from './useGraphLayout';
import type { ConceptRelation } from '@vie/types';

/**
 * Floating edge for the concept canvas — connects node *centers* (clipped to the
 * node border) so the handle-less compact nodes don't need anchor points. The
 * relationship type is encoded by line-style + arrowhead on a single accent
 * colour (never hue — DESIGN.md "One Domain, One Accent"):
 *   causes / requires → solid + arrowhead   (directional dependency)
 *   contrasts         → dashed               (opposition / trade-off)
 *   partOf / relatesTo → dotted              (loose association)
 *
 * At rest the whole edge layer is de-emphasised; selecting a node brightens its
 * neighbourhood (`active`) and dims everything else (`dimmed`).
 */

export type EdgeVisualState = 'rest' | 'active' | 'dimmed';

export interface FloatingEdgeData extends Record<string, unknown> {
  relation: ConceptRelation;
  state: EdgeVisualState;
}

const ACCENT = 'var(--vie-accent, var(--primary))';

/** Directional relations get an arrowhead; associative ones don't. */
export function isDirectionalRelation(relation: ConceptRelation): boolean {
  return relation === 'causes' || relation === 'requires';
}

function dashFor(relation: ConceptRelation): string | undefined {
  if (relation === 'contrasts') return '7 5';
  if (relation === 'partOf' || relation === 'relatesTo') return '1.5 6';
  return undefined; // solid — causes / requires
}

/** Pure style map — exported for unit testing (style differs by relation type
 *  and brightens/dims by selection state). */
export function edgeStyleForRelation(
  relation: ConceptRelation,
  state: EdgeVisualState,
): React.CSSProperties {
  const dash = dashFor(relation);
  const byState =
    state === 'active'
      ? { strokeWidth: 2.4, opacity: 1 }
      : state === 'dimmed'
        ? { strokeWidth: 1.1, opacity: 0.1 }
        : { strokeWidth: 1.5, opacity: 0.42 };
  return {
    stroke: ACCENT,
    strokeLinecap: 'round',
    strokeDasharray: dash,
    ...byState,
  };
}

interface XY {
  x: number;
  y: number;
}

interface Rect extends XY {
  width: number;
  height: number;
}

/** Point where the center→center line crosses the node's border rectangle. */
function getNodeIntersection(node: Rect, other: XY): XY {
  const w = node.width / 2;
  const h = node.height / 2;
  const cx = node.x + w;
  const cy = node.y + h;
  const dx = other.x - cx;
  const dy = other.y - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const scale = 1 / Math.max(Math.abs(dx) / w, Math.abs(dy) / h);
  return { x: cx + dx * scale, y: cy + dy * scale };
}

export function FloatingEdge({ id, source, target, markerEnd, data }: EdgeProps) {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);
  if (!sourceNode || !targetNode) return null;

  const sourceRect: Rect = {
    x: sourceNode.internals.positionAbsolute.x,
    y: sourceNode.internals.positionAbsolute.y,
    width: sourceNode.measured.width ?? NODE_WIDTH,
    height: sourceNode.measured.height ?? NODE_HEIGHT,
  };
  const targetRect: Rect = {
    x: targetNode.internals.positionAbsolute.x,
    y: targetNode.internals.positionAbsolute.y,
    width: targetNode.measured.width ?? NODE_WIDTH,
    height: targetNode.measured.height ?? NODE_HEIGHT,
  };
  const targetCenter = { x: targetRect.x + targetRect.width / 2, y: targetRect.y + targetRect.height / 2 };
  const sourceCenter = { x: sourceRect.x + sourceRect.width / 2, y: sourceRect.y + sourceRect.height / 2 };

  const start = getNodeIntersection(sourceRect, targetCenter);
  const end = getNodeIntersection(targetRect, sourceCenter);

  const [path] = getStraightPath({
    sourceX: start.x,
    sourceY: start.y,
    targetX: end.x,
    targetY: end.y,
  });

  const edgeData = data as FloatingEdgeData | undefined;
  const relation = edgeData?.relation ?? 'relatesTo';
  const state = edgeData?.state ?? 'rest';

  return (
    <BaseEdge id={id} path={path} markerEnd={markerEnd} style={edgeStyleForRelation(relation, state)} />
  );
}
