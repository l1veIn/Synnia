import React, { useState } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  useReactFlow,
  EdgeProps,
} from '@xyflow/react';
import { X } from 'lucide-react';

export default function DeletableEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  selected,
}: EdgeProps) {
  const { deleteElements } = useReactFlow();
  const [isHovered, setIsHovered] = useState(false);

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const onEdgeClick = (evt: React.MouseEvent) => {
    evt.stopPropagation();
    deleteElements({ edges: [{ id }] });
  };

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: selected || isHovered ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
          strokeWidth: selected || isHovered ? 2 : 1.5,
          transition: 'stroke 0.2s, stroke-width 0.2s',
        }}
      />

      {/* Invisible wider path for easier interaction - Rendered AFTER BaseEdge to be on TOP */}
      <path
        d={edgePath}
        fill="none"
        strokeOpacity={0}
        strokeWidth={30}
        className="react-flow__edge-interaction"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{ cursor: 'pointer' }}
      />

      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
            opacity: isHovered || selected ? 1 : 0,
            transition: 'opacity 0.2s',
            zIndex: 10,
          }}
          className="nodrag nopan"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <button
            className="w-6 h-6 bg-destructive text-white rounded-full flex items-center justify-center cursor-pointer shadow-md hover:scale-110 transition-transform"
            onClick={onEdgeClick}
            title="Delete connection"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
