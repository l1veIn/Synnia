import dagre from 'dagre';
import { Node, Edge, Position } from '@xyflow/react';

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

// --- Collision Helpers ---

interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
    x2: number;
    y2: number;
}

export const getBounds = (node: Node): Rect => {
    const x = node.position.x;
    const y = node.position.y;
    const width = node.measured?.width || (typeof node.style?.width === 'number' ? node.style.width : 280) as number || 280;
    const height = node.measured?.height || (typeof node.style?.height === 'number' ? node.style.height : 200) as number || 200;
    
    return {
        x, y, width, height,
        x2: x + width,
        y2: y + height
    };
};

// Check if innerNode's center is inside outerNode
export const isNodeInside = (innerNode: Node, outerNode: Node): boolean => {
    const inner = getBounds(innerNode);
    const outer = getBounds(outerNode);
    
    const centerX = inner.x + inner.width / 2;
    const centerY = inner.y + inner.height / 2;

    return (
        centerX >= outer.x &&
        centerX <= outer.x2 &&
        centerY >= outer.y &&
        centerY <= outer.y2
    );
};

// nodeWidth/height should match your AssetNode size roughly
// const nodeWidth = 240;
// const nodeHeight = 200; 

export const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'LR') => {
  const isHorizontal = direction === 'LR';
  dagreGraph.setGraph({ rankdir: direction });

  nodes.forEach((node) => {
    // Use measured dimensions if available (React Flow 12+), fallback to style or default
    const width = node.measured?.width || (typeof node.style?.width === 'number' ? node.style.width : 240);
    const height = node.measured?.height || (typeof node.style?.height === 'number' ? node.style.height : 200);
    
    dagreGraph.setNode(node.id, { width, height });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    const width = node.measured?.width || (typeof node.style?.width === 'number' ? node.style.width : 240);
    const height = node.measured?.height || (typeof node.style?.height === 'number' ? node.style.height : 200);

    return {
      ...node,
      targetPosition: isHorizontal ? Position.Left : Position.Top,
      sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
      position: {
        x: nodeWithPosition.x - width / 2,
        y: nodeWithPosition.y - height / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};
