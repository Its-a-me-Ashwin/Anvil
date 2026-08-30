import { memo } from 'react';
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type EdgeProps, type Edge } from '@xyflow/react';

export interface WiringEdgeData extends Record<string, unknown> {
  color?: string;
  hoveredEdge?: string | null;
  setHoveredEdge?: (id: string | null) => void;
  tooltip?: string;
}

const DEFAULT_COLOR = '#3b82f6';

export default memo(function WiringEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps<Edge<WiringEdgeData>>) {
  const color = data?.color || DEFAULT_COLOR;
  const hovered = data?.hoveredEdge === id;
  const setHover = data?.setHoveredEdge;
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      <BaseEdge id={id} path={path} style={{ stroke: color, strokeWidth: hovered ? 3 : 2 }} />
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth={10}
        onMouseEnter={() => setHover?.(id)}
        onMouseLeave={() => setHover?.(null)}
      />
      <EdgeLabelRenderer>
        {hovered && data?.tooltip && (
          <div
            className="absolute px-1.5 py-0.5 rounded bg-anvil-panelHover border border-anvil-border text-[10px] text-anvil-text"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          >
            {data.tooltip}
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  );
});
