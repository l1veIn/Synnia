import { Node } from '@xyflow/react';
import { SynniaNode, NodeType } from '@/types/project';

// Helper: 检测 node 是否在 group 内部
export const isNodeInsideGroup = (node: Node, group: Node) => {
  if (!node.measured || !group.measured) return false;
  
  const nX = node.position.x;
  const nY = node.position.y;
  const nW = node.measured.width || 0;
  const nH = node.measured.height || 0;

  const gX = group.position.x;
  const gY = group.position.y;
  const gW = group.measured.width || 0;
  const gH = group.measured.height || 0;

  // Calculate Overlap Area
  const x_overlap = Math.max(0, Math.min(nX + nW, gX + gW) - Math.max(nX, gX));
  const y_overlap = Math.max(0, Math.min(nY + nH, gY + gH) - Math.max(nY, gY));
  
  const overlapArea = x_overlap * y_overlap;
  const nodeArea = nW * nH;

  // Heuristic: Overlap must be significant (>20% of dragged node area)
  return overlapArea > 0 && overlapArea > (nodeArea * 0.2);
};

// Helper: 拓扑排序，确保 Parent 在 Child 前面
export const sortNodesTopologically = (nodes: SynniaNode[]): SynniaNode[] => {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const childrenMap = new Map<string, string[]>();
  const roots: string[] = [];

  nodes.forEach(node => {
    if (!node.parentId || !nodeMap.has(node.parentId)) {
      roots.push(node.id);
    } else {
      const existing = childrenMap.get(node.parentId) || [];
      existing.push(node.id);
      childrenMap.set(node.parentId, existing);
    }
  });

  // 根节点排序：Group 优先
  roots.sort((a, b) => {
    const nodeA = nodeMap.get(a)!;
    const nodeB = nodeMap.get(b)!;
    if (nodeA.type === NodeType.GROUP && nodeB.type !== NodeType.GROUP) return -1;
    if (nodeA.type !== NodeType.GROUP && nodeB.type === NodeType.GROUP) return 1;
    return 0;
  });

  const result: SynniaNode[] = [];
  const queue = [...roots];

  while (queue.length > 0) {
    const id = queue.shift()!;
    const node = nodeMap.get(id);
    if (node) {
      result.push(node);
      const children = childrenMap.get(id);
      if (children) {
        // 子节点排序：Group 优先
        children.sort((a, b) => {
          const nodeA = nodeMap.get(a)!;
          const nodeB = nodeMap.get(b)!;
          if (nodeA.type === NodeType.GROUP && nodeB.type !== NodeType.GROUP) return -1;
          if (nodeA.type !== NodeType.GROUP && nodeB.type === NodeType.GROUP) return 1;
          return 0;
        });
        
        children.forEach(childId => queue.push(childId));
      }
    }
  }

  return result;
};

// Helper: 递归获取所有子孙节点
export const getDescendants = (nodes: SynniaNode[], parentId: string): SynniaNode[] => {
    const descendants: SynniaNode[] = [];
    const children = nodes.filter(n => n.parentId === parentId);
    descendants.push(...children);
    children.forEach(child => {
        descendants.push(...getDescendants(nodes, child.id));
    });
    return descendants;
};

// Helper: Sanitize node data for clipboard/duplication (remove transient state)
export const sanitizeNodeForClipboard = (node: SynniaNode): SynniaNode => {
    const { collapsed, handlePosition, originalPosition, ...cleanData } = node.data;
    
    return {
        ...node,
        draggable: true, 
        hidden: false,   
        width: undefined,
        height: undefined,
        style: { ...node.style, width: undefined, height: undefined },
        data: { 
            ...JSON.parse(JSON.stringify(cleanData)),
            collapsed: false,
            handlePosition: 'top-bottom'
        }
    } as SynniaNode;
};
